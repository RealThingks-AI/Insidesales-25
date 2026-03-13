import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tables that should NEVER be restored from backups (noise/session data)
const SKIP_TABLES = ['security_audit_log', 'user_sessions', 'keep_alive']

// Tables in correct deletion order (children first, parents last)
const DELETE_ORDER = [
  'deal_action_items', 'lead_action_items', 'action_items',
  'notifications', 'notification_preferences', 'saved_filters',
  'column_preferences', 'dashboard_preferences',
  'deals', 'contacts', 'leads', 'accounts',
  'user_preferences', 'yearly_revenue_targets', 'page_permissions',
  'user_roles', 'profiles'
]

// Tables in correct insertion order (parents first, children last)
const INSERT_ORDER = [
  'profiles', 'user_roles',
  'accounts', 'leads', 'contacts', 'deals',
  'lead_action_items', 'deal_action_items', 'action_items',
  'notifications', 'notification_preferences', 'saved_filters',
  'column_preferences', 'dashboard_preferences',
  'user_preferences', 'yearly_revenue_targets', 'page_permissions'
]

const BATCH_SIZE = 1000

async function fetchAllRows(client: any, table: string): Promise<any[]> {
  const allData: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await client.from(table).select('*').range(from, from + BATCH_SIZE - 1)
    if (error || !data || data.length === 0) break
    allData.push(...data)
    if (data.length < BATCH_SIZE) break
    from += BATCH_SIZE
  }
  return allData
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('MY_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { backupId } = await req.json()
    if (!backupId) {
      return new Response(JSON.stringify({ error: 'backupId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: backup, error: fetchError } = await adminClient
      .from('backups')
      .select('*')
      .eq('id', backupId)
      .single()

    if (fetchError || !backup) {
      return new Response(JSON.stringify({ error: 'Backup not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: fileData, error: downloadError } = await adminClient.storage
      .from('backups')
      .download(backup.file_path)

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: 'Failed to download backup file' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const backupContent = JSON.parse(await fileData.text())
    const backupData = backupContent.data
    if (!backupData) {
      return new Response(JSON.stringify({ error: 'Invalid backup format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ═══════════════════════════════════════════════════════════════
    // PRE-RESTORE SAFETY BACKUP
    // ═══════════════════════════════════════════════════════════════
    console.log('Creating pre-restore safety backup...')
    const tablesToRestore = Object.keys(backupData).filter(t => !SKIP_TABLES.includes(t))
    const safetyBackupData: Record<string, any[]> = {}
    const safetyManifest: Record<string, number> = {}
    let safetyTotalRecords = 0

    for (const table of tablesToRestore) {
      const data = await fetchAllRows(adminClient, table)
      safetyBackupData[table] = data
      safetyManifest[table] = data.length
      safetyTotalRecords += data.length
    }

    const safetyTimestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const safetyFileName = `pre-restore-safety-${safetyTimestamp}.json`
    const safetyFilePath = `${user.id}/${safetyFileName}`

    const safetyJson = JSON.stringify({
      version: '1.0',
      created_at: new Date().toISOString(),
      created_by: user.id,
      backup_type: 'pre_restore',
      tables: tablesToRestore,
      manifest: safetyManifest,
      data: safetyBackupData,
    }, null, 2)

    const safetySizeBytes = new Blob([safetyJson]).size

    await adminClient.storage.from('backups').upload(safetyFilePath, safetyJson, {
      contentType: 'application/json', upsert: true,
    })

    await adminClient.from('backups').insert({
      file_name: safetyFileName,
      file_path: safetyFilePath,
      backup_type: 'pre_restore',
      status: 'completed',
      created_by: user.id,
      size_bytes: safetySizeBytes,
      tables_count: tablesToRestore.length,
      records_count: safetyTotalRecords,
      manifest: safetyManifest,
    })

    console.log('Pre-restore safety backup created:', safetyFileName)

    // ═══════════════════════════════════════════════════════════════
    // RESTORE
    // ═══════════════════════════════════════════════════════════════
    const restoredTables: string[] = []
    let restoredRecords = 0

    // Delete existing data in reverse dependency order
    for (const table of DELETE_ORDER) {
      if (tablesToRestore.includes(table)) {
        const { error } = await adminClient.from(table).delete().not('id', 'is', null)
        if (error) {
          console.error(`Error clearing ${table}:`, error)
        }
      }
    }

    // Insert data in correct order
    for (const table of INSERT_ORDER) {
      if (!backupData[table] || backupData[table].length === 0) continue

      const records = backupData[table]
      for (let i = 0; i < records.length; i += 500) {
        const batch = records.slice(i, i + 500)
        const { error } = await adminClient.from(table).upsert(batch, { onConflict: 'id' })
        if (error) {
          console.error(`Error restoring ${table} batch ${i}:`, error)
        }
      }

      restoredTables.push(table)
      restoredRecords += records.length
    }

    // Also restore any tables in the backup that aren't in INSERT_ORDER
    for (const table of tablesToRestore) {
      if (INSERT_ORDER.includes(table) || !backupData[table]?.length) continue
      const records = backupData[table]
      for (let i = 0; i < records.length; i += 500) {
        const batch = records.slice(i, i + 500)
        const { error } = await adminClient.from(table).upsert(batch, { onConflict: 'id' })
        if (error) {
          console.error(`Error restoring ${table}:`, error)
        }
      }
      restoredTables.push(table)
      restoredRecords += records.length
    }

    return new Response(JSON.stringify({
      success: true,
      restoredTables,
      restoredRecords,
      safetyBackup: safetyFileName,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Restore error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
