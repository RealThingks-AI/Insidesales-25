import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function getGraphAccessToken(): Promise<string> {
  const tenantId = Deno.env.get('AZURE_EMAIL_TENANT_ID')!;
  const clientId = Deno.env.get('AZURE_EMAIL_CLIENT_ID')!;
  const clientSecret = Deno.env.get('AZURE_EMAIL_CLIENT_SECRET')!;

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to get Graph token: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

    const { recipientEmail, recipientName, subject, body, contactId, accountId, campaignId } = await req.json();

    if (!recipientEmail || !subject || !body || !campaignId) {
      return new Response(JSON.stringify({ error: 'Missing required fields: recipientEmail, subject, body, campaignId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const senderEmail = Deno.env.get('AZURE_SENDER_EMAIL')!;
    const graphToken = await getGraphAccessToken();

    const emailPayload = {
      message: {
        subject,
        body: { contentType: 'HTML', content: body },
        toRecipients: [{ emailAddress: { address: recipientEmail, name: recipientName || recipientEmail } }],
      },
      saveToSentItems: false,
    };

    const graphRes = await fetch(`https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${graphToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!graphRes.ok) {
      const errText = await graphRes.text();
      console.error(`Graph sendMail failed: ${graphRes.status} ${errText}`);
      return new Response(JSON.stringify({ error: 'Failed to send email', details: errText }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role for cross-table inserts
    const serviceClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Record in email_history
    await serviceClient.from('email_history').insert({
      recipient_email: recipientEmail,
      recipient_name: recipientName || null,
      sender_email: senderEmail,
      subject,
      body,
      status: 'sent',
      sent_by: userId,
      contact_id: contactId || null,
      account_id: accountId || null,
    });

    // Record in campaign_communications
    await serviceClient.from('campaign_communications').insert({
      campaign_id: campaignId,
      communication_type: 'Email',
      contact_id: contactId || null,
      account_id: accountId || null,
      subject,
      body,
      email_status: 'Sent',
      email_type: 'Initial Outreach',
      owner: userId,
      created_by: userId,
    });

    // Update campaign contact stage to "Email Sent" if contactId provided
    if (contactId) {
      await serviceClient
        .from('campaign_contacts')
        .update({ stage: 'Email Sent' })
        .eq('campaign_id', campaignId)
        .eq('contact_id', contactId)
        .eq('stage', 'Not Contacted');
    }

    console.log(`[OK] Campaign email sent to ${recipientEmail} for campaign ${campaignId}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[ERROR] send-campaign-email:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
