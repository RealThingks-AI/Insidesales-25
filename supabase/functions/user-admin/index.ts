
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const VALID_ROLES = ['admin', 'user', 'super_admin', 'sales_head', 'field_sales', 'inside_sales'];
const ADMIN_ROLES = ['admin', 'super_admin'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('User admin function called with method:', req.method);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: user, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated request by:', user.user.email);

    // Get role from DB only — never trust metadata
    const { data: userRoleFromDB } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.user.id)
      .single();

    const effectiveRole = userRoleFromDB?.role || 'user';
    const isAdmin = ADMIN_ROLES.includes(effectiveRole);

    console.log('User role from database:', effectiveRole, 'isAdmin:', isAdmin);

    // GET - List all users
    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers();

      if (error) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch users: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ users: data.users }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Create new user or handle specific actions
    if (req.method === 'POST') {
      const body = await req.json();
      
      // Handle password reset (admin only)
      if (body.action === 'reset-password') {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Only Admins can reset user passwords' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { userId, newPassword } = body;
        if (!userId || !newPassword) {
          return new Response(
            JSON.stringify({ error: 'User ID and new password are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { password: newPassword }
        );

        if (error) {
          return new Response(
            JSON.stringify({ error: `Password reset failed: ${error.message}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Password reset successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Handle role changes (ADMIN ONLY)
      if (body.action === 'change-role') {
        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Only Admins can change user roles' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { userId, newRole } = body;
        if (!userId || !newRole || !VALID_ROLES.includes(newRole)) {
          return new Response(
            JSON.stringify({ error: `Valid user ID and role (${VALID_ROLES.join('/')}) are required` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Admin changing role for user:', userId, 'to:', newRole);

        try {
          // Update user metadata
          const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { user_metadata: { role: newRole } }
          );

          if (updateError) {
            return new Response(
              JSON.stringify({ error: `Failed to update user metadata: ${updateError.message}` }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Update role in database
          const { error: roleError } = await supabaseAdmin.rpc('update_user_role', {
            p_user_id: userId,
            p_role: newRole
          });

          if (roleError) {
            return new Response(
              JSON.stringify({ error: `Role update failed: ${roleError.message}` }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ success: true, message: `User role updated to ${newRole}`, user: updatedUser.user }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return new Response(
            JSON.stringify({ error: `Role update failed: ${errorMessage}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Handle user creation (admin only)
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only Admins can create new users' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { email, displayName, role, password } = body;
      
      if (!email || !password || !displayName) {
        return new Response(
          JSON.stringify({ error: 'Email, password, and display name are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate role if provided
      const userRole = role && VALID_ROLES.includes(role) ? role : 'user';

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        user_metadata: { full_name: displayName },
        email_confirm: true
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: `User creation failed: ${error.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (data.user) {
        try {
          await supabaseAdmin.from('profiles').insert({
            id: data.user.id,
            full_name: displayName,
            'Email ID': email
          });

          await supabaseAdmin.from('user_roles').insert({
            user_id: data.user.id,
            role: userRole,
            assigned_by: user.user.id
          });
        } catch (err) {
          console.warn('Setup error:', err);
        }
      }

      return new Response(
        JSON.stringify({ success: true, user: data.user, message: 'User created successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT - Update user
    if (req.method === 'PUT') {
      const { userId, displayName, action } = await req.json();
      
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'User ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if ((action === 'activate' || action === 'deactivate') && !isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only Admins can activate/deactivate users' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let updateData: any = {};

      if (displayName !== undefined) {
        updateData.user_metadata = { full_name: displayName };
      }

      if (action === 'activate') {
        updateData.ban_duration = 'none';
      } else if (action === 'deactivate') {
        updateData.ban_duration = '876000h';
      }

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);

        if (error) {
          return new Response(
            JSON.stringify({ error: `User update failed: ${error.message}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      if (displayName !== undefined) {
        try {
          await supabaseAdmin.from('profiles').update({ full_name: displayName }).eq('id', userId);
        } catch (profileErr) {
          console.warn('Profile update error:', profileErr);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'User updated successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Delete user (admin only)
    if (req.method === 'DELETE') {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only Admins can delete users' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { userId } = await req.json();
      
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'User ID is required for deletion' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (userId === user.user.id) {
        return new Response(
          JSON.stringify({ error: 'Admins cannot delete their own account.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // Clean up dependent records
        await supabaseAdmin.from('deal_action_items').delete().or(`created_by.eq.${userId},assigned_to.eq.${userId}`);
        await supabaseAdmin.from('lead_action_items').delete().or(`created_by.eq.${userId},assigned_to.eq.${userId}`);
        await supabaseAdmin.from('deals').update({ created_by: user.user.id }).eq('created_by', userId);
        await supabaseAdmin.from('deals').update({ modified_by: null }).eq('modified_by', userId);
        await supabaseAdmin.from('leads').update({ created_by: user.user.id }).eq('created_by', userId);
        await supabaseAdmin.from('leads').update({ modified_by: null }).eq('modified_by', userId);
        await supabaseAdmin.from('leads').update({ contact_owner: null }).eq('contact_owner', userId);
        await supabaseAdmin.from('contacts').update({ created_by: user.user.id }).eq('created_by', userId);
        await supabaseAdmin.from('contacts').update({ modified_by: null }).eq('modified_by', userId);
        await supabaseAdmin.from('contacts').update({ contact_owner: null }).eq('contact_owner', userId);
        await supabaseAdmin.from('notifications').delete().eq('user_id', userId);
        await supabaseAdmin.from('saved_filters').delete().eq('user_id', userId);
        await supabaseAdmin.from('dashboard_preferences').delete().eq('user_id', userId);
        await supabaseAdmin.from('user_preferences').delete().eq('user_id', userId);
        await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
        await supabaseAdmin.from('user_roles').update({ assigned_by: user.user.id }).eq('assigned_by', userId);
        await supabaseAdmin.from('yearly_revenue_targets').update({ created_by: user.user.id }).eq('created_by', userId);
        await supabaseAdmin.from('profiles').delete().eq('id', userId);

        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authDeleteError) {
          return new Response(
            JSON.stringify({ error: `User deletion failed: ${authDeleteError.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: 'User deleted successfully', userId }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (deleteError: any) {
        return new Response(
          JSON.stringify({ error: `Deletion failed: ${deleteError.message || 'Unknown error'}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: `Method ${req.method} not allowed` }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Unexpected error in user-admin function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
