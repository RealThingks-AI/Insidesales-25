import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface ZohoAccount {
  zcrm_id: string
  accountName: string
}

interface ZohoContact {
  contactName: string
  accountNameId: string // "Account Name.id" from Zoho
  email: string
}

interface LinkResult {
  contactId: string
  contactName: string
  email: string | null
  matchedVia: 'email' | 'name' | null
  zohoAccountName: string | null
  crmAccountName: string | null
  status: 'linked' | 'no_zoho_match' | 'no_account_link' | 'no_crm_account' | 'already_linked' | 'error'
  error?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Auth check
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify user is admin
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check admin role
    const { data: roleData } = await supabaseAuth.from('user_roles').select('role').eq('user_id', user.id).single()
    if (!roleData || roleData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { zohoAccounts, zohoContacts, dryRun = true } = body as {
      zohoAccounts: ZohoAccount[]
      zohoContacts: ZohoContact[]
      dryRun: boolean
    }

    console.log(`[link-contacts-accounts] Starting. Zoho accounts: ${zohoAccounts.length}, Zoho contacts: ${zohoContacts.length}, dryRun: ${dryRun}`)

    if (!zohoAccounts?.length || !zohoContacts?.length) {
      return new Response(JSON.stringify({ error: 'Both zohoAccounts and zohoContacts are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use service role client for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Build Zoho account lookup: zcrm_id -> account name
    const zohoAccountMap = new Map<string, string>()
    for (const acc of zohoAccounts) {
      if (acc.zcrm_id && acc.accountName) {
        zohoAccountMap.set(acc.zcrm_id.trim(), acc.accountName.trim())
      }
    }
    console.log(`[link-contacts-accounts] Zoho account map built: ${zohoAccountMap.size} entries`)

    // Step 2: Build Zoho contact lookup maps
    // email -> { contactName, accountName }
    // name -> { contactName, accountName }
    const zohoContactByEmail = new Map<string, { contactName: string; accountName: string }>()
    const zohoContactByName = new Map<string, { contactName: string; accountName: string }>()

    let zohoContactsWithAccount = 0
    let zohoContactsWithoutAccount = 0

    for (const zc of zohoContacts) {
      const accountName = zc.accountNameId ? zohoAccountMap.get(zc.accountNameId.trim()) : null
      
      if (!accountName) {
        zohoContactsWithoutAccount++
        continue
      }

      zohoContactsWithAccount++
      const entry = { contactName: zc.contactName?.trim() || '', accountName }

      if (zc.email?.trim()) {
        zohoContactByEmail.set(zc.email.trim().toLowerCase(), entry)
      }
      if (zc.contactName?.trim()) {
        zohoContactByName.set(zc.contactName.trim().toLowerCase(), entry)
      }
    }

    console.log(`[link-contacts-accounts] Zoho contacts with account link: ${zohoContactsWithAccount}, without: ${zohoContactsWithoutAccount}`)
    console.log(`[link-contacts-accounts] Email lookup entries: ${zohoContactByEmail.size}, Name lookup entries: ${zohoContactByName.size}`)

    // Step 3: Fetch all CRM accounts (paginated)
    const crmAccountMap = new Map<string, string>() // lowercase account_name -> actual account_name
    let accountOffset = 0
    const PAGE_SIZE = 1000

    while (true) {
      const { data: accounts, error: accErr } = await supabase
        .from('accounts')
        .select('account_name')
        .range(accountOffset, accountOffset + PAGE_SIZE - 1)
      
      if (accErr) {
        console.error('[link-contacts-accounts] Error fetching accounts:', accErr)
        throw new Error(`Failed to fetch accounts: ${accErr.message}`)
      }

      if (!accounts || accounts.length === 0) break

      for (const acc of accounts) {
        if (acc.account_name) {
          crmAccountMap.set(acc.account_name.trim().toLowerCase(), acc.account_name.trim())
        }
      }

      if (accounts.length < PAGE_SIZE) break
      accountOffset += PAGE_SIZE
    }

    console.log(`[link-contacts-accounts] CRM accounts loaded: ${crmAccountMap.size}`)

    // Step 4: Fetch all CRM contacts (paginated)
    const allContacts: { id: string; contact_name: string; email: string | null; company_name: string | null }[] = []
    let contactOffset = 0

    while (true) {
      const { data: contacts, error: contErr } = await supabase
        .from('contacts')
        .select('id, contact_name, email, company_name')
        .range(contactOffset, contactOffset + PAGE_SIZE - 1)

      if (contErr) {
        console.error('[link-contacts-accounts] Error fetching contacts:', contErr)
        throw new Error(`Failed to fetch contacts: ${contErr.message}`)
      }

      if (!contacts || contacts.length === 0) break
      allContacts.push(...contacts)

      if (contacts.length < PAGE_SIZE) break
      contactOffset += PAGE_SIZE
    }

    console.log(`[link-contacts-accounts] CRM contacts loaded: ${allContacts.length}`)

    // Step 5: Match and link
    const results: LinkResult[] = []
    const updateBatch: { id: string; company_name: string }[] = []

    for (const contact of allContacts) {
      const result: LinkResult = {
        contactId: contact.id,
        contactName: contact.contact_name,
        email: contact.email,
        matchedVia: null,
        zohoAccountName: null,
        crmAccountName: null,
        status: 'no_zoho_match',
      }

      // Skip if already has a company_name
      if (contact.company_name && contact.company_name.trim() !== '') {
        result.status = 'already_linked'
        result.crmAccountName = contact.company_name
        results.push(result)
        continue
      }

      // Try email match first
      let zohoEntry = null
      if (contact.email?.trim()) {
        zohoEntry = zohoContactByEmail.get(contact.email.trim().toLowerCase())
        if (zohoEntry) result.matchedVia = 'email'
      }

      // Fallback: name match
      if (!zohoEntry && contact.contact_name?.trim()) {
        zohoEntry = zohoContactByName.get(contact.contact_name.trim().toLowerCase())
        if (zohoEntry) result.matchedVia = 'name'
      }

      if (!zohoEntry) {
        result.status = 'no_zoho_match'
        results.push(result)
        continue
      }

      result.zohoAccountName = zohoEntry.accountName

      // Find CRM account with matching name
      const crmAccountName = crmAccountMap.get(zohoEntry.accountName.trim().toLowerCase())
      
      if (!crmAccountName) {
        result.status = 'no_crm_account'
        results.push(result)
        continue
      }

      result.crmAccountName = crmAccountName
      result.status = 'linked'
      updateBatch.push({ id: contact.id, company_name: crmAccountName })
      results.push(result)
    }

    // Step 6: Execute updates (if not dry run)
    // Group by company_name to minimize DB calls
    let updatedCount = 0
    let updateErrors = 0

    if (!dryRun && updateBatch.length > 0) {
      // Group contact IDs by company_name for bulk updates
      const groupedByCompany = new Map<string, string[]>()
      for (const item of updateBatch) {
        const ids = groupedByCompany.get(item.company_name) || []
        ids.push(item.id)
        groupedByCompany.set(item.company_name, ids)
      }

      console.log(`[link-contacts-accounts] Grouped into ${groupedByCompany.size} unique company names for bulk update`)

      const BULK_BATCH_SIZE = 200 // IDs per .in() call
      let processed = 0

      for (const [companyName, contactIds] of groupedByCompany) {
        // Split large ID arrays into chunks for the .in() filter
        for (let i = 0; i < contactIds.length; i += BULK_BATCH_SIZE) {
          const idChunk = contactIds.slice(i, i + BULK_BATCH_SIZE)
          
          const { error: updateErr, count } = await supabase
            .from('contacts')
            .update({ company_name: companyName })
            .in('id', idChunk)

          if (updateErr) {
            console.error(`[link-contacts-accounts] Bulk update error for "${companyName}":`, updateErr)
            updateErrors += idChunk.length
            for (const id of idChunk) {
              const r = results.find(r => r.contactId === id)
              if (r) { r.status = 'error'; r.error = updateErr.message }
            }
          } else {
            updatedCount += idChunk.length
          }
        }

        processed += contactIds.length
        if (processed % 500 < contactIds.length) {
          console.log(`[link-contacts-accounts] Bulk progress: ${processed}/${updateBatch.length}`)
        }
      }
    }

    // Build summary
    const summary = {
      totalContacts: allContacts.length,
      alreadyLinked: results.filter(r => r.status === 'already_linked').length,
      willLink: results.filter(r => r.status === 'linked').length,
      noZohoMatch: results.filter(r => r.status === 'no_zoho_match').length,
      noAccountLink: results.filter(r => r.status === 'no_account_link').length,
      noCrmAccount: results.filter(r => r.status === 'no_crm_account').length,
      errors: results.filter(r => r.status === 'error').length,
      matchedByEmail: results.filter(r => r.matchedVia === 'email').length,
      matchedByName: results.filter(r => r.matchedVia === 'name').length,
      dryRun,
      updatedCount,
      updateErrors,
      zohoStats: {
        totalAccounts: zohoAccountMap.size,
        totalContacts: zohoContacts.length,
        contactsWithAccountLink: zohoContactsWithAccount,
        contactsWithoutAccountLink: zohoContactsWithoutAccount,
      }
    }

    console.log(`[link-contacts-accounts] Summary:`, JSON.stringify(summary))

    // Return unmatched contacts for review (limit to first 100)
    const unmatchedSample = results
      .filter(r => r.status === 'no_zoho_match' || r.status === 'no_crm_account')
      .slice(0, 100)
      .map(r => ({
        contactName: r.contactName,
        email: r.email,
        status: r.status,
        zohoAccountName: r.zohoAccountName,
      }))

    return new Response(JSON.stringify({
      success: true,
      summary,
      unmatchedSample,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const error = err instanceof Error ? err : new Error('Unknown error');
    console.error('[link-contacts-accounts] Fatal error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
