import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Retry helper for transient errors
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  delayMs = 500
): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorStatus = (error as { status?: number })?.status;
      const errorName = (error as { name?: string })?.name;
      // Retry on network errors or 503
      if (i < maxRetries && (errorStatus === 503 || errorName === 'AuthRetryableFetchError')) {
        console.log(`Retrying auth call (attempt ${i + 1})...`);
        await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('User admin function called with method:', req.method);

    // Create admin client with service role key for full access
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

    // Verify the user making the request is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Use retry logic for getUser call to handle transient network errors
    let user;
    let authError;
    try {
      const result = await withRetry(() => supabaseAdmin.auth.getUser(token));
      user = result.data;
      authError = result.error;
    } catch (error) {
      console.error('Authentication error after retries:', error);
      return new Response(
        JSON.stringify({ error: 'Authentication service temporarily unavailable. Please try again.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (authError || !user?.user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated request by:', user.user.email);

    // Check user's role from both metadata and database
    const userRole = user.user.user_metadata?.role || 'user';
    const { data: userRoleFromDB } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.user.id)
      .single();

    const effectiveRole = userRoleFromDB?.role || userRole;
    const isAdmin = effectiveRole === 'admin';

    console.log('User role from metadata:', userRole);
    console.log('User role from database:', userRoleFromDB?.role || 'no role found');
    console.log('Effective role:', effectiveRole, 'isAdmin:', isAdmin);

    // GET - List all users (allow all authenticated users to view)
    if (req.method === 'GET') {
      console.log('Fetching users list...');
      
      const { data, error } = await supabaseAdmin.auth.admin.listUsers();

      if (error) {
        console.error('Error listing users:', error);
        return new Response(
          JSON.stringify({ error: `Failed to fetch users: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Users fetched successfully:', data?.users?.length || 0);
      return new Response(
        JSON.stringify({ users: data.users }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // POST - Create new user or handle specific actions
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('POST request body:', JSON.stringify(body, null, 2));
      
      // Handle password reset with new password (admin only)
      if (body.action === 'reset-password') {
        if (!isAdmin) {
          console.log('Non-admin user attempted password reset:', user.user.email);
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

        console.log('Resetting password for user:', userId);

        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { password: newPassword }
        );

        if (error) {
          console.error('Error resetting password:', error);
          return new Response(
            JSON.stringify({ error: `Password reset failed: ${error.message}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Password reset successfully');
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Password reset successfully'
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Handle role changes (ADMIN ONLY)
      if (body.action === 'change-role') {
        if (!isAdmin) {
          console.log('Non-admin user attempted role change:', user.user.email, 'for user:', body.userId);
          return new Response(
            JSON.stringify({ error: 'Only Admins can change user roles' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { userId, newRole } = body;
        if (!userId || !newRole || !['admin', 'manager', 'user'].includes(newRole)) {
          return new Response(
            JSON.stringify({ error: 'Valid user ID and role (admin/manager/user) are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Admin changing role for user:', userId, 'to:', newRole, 'by:', user.user.email);

        try {
          // First, update the user metadata in Supabase Auth
          const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { 
              user_metadata: { 
                role: newRole 
              } 
            }
          );

          if (updateError) {
            console.error('Error updating user metadata:', updateError);
            return new Response(
              JSON.stringify({ error: `Failed to update user metadata: ${updateError.message}` }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Then, use our upsert function to update the role in the database
          const { error: roleError } = await supabaseAdmin.rpc('update_user_role', {
            p_user_id: userId,
            p_role: newRole
          });

          if (roleError) {
            console.error('Error updating role in database:', roleError);
            return new Response(
              JSON.stringify({ error: `Role update failed: ${roleError.message}` }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Clear user's cached permissions immediately so role change takes effect instantly
          const { error: cacheError } = await supabaseAdmin
            .from('user_access_cache')
            .delete()
            .eq('user_id', userId);

          if (cacheError) {
            console.warn('Failed to clear user cache (non-critical):', cacheError);
          }

          console.log('Role updated successfully in both auth and database by admin:', user.user.email);
          return new Response(
            JSON.stringify({ 
              success: true,
              message: `User role updated to ${newRole}`,
              user: updatedUser.user
            }),
            { 
              status: 200, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        } catch (error: unknown) {
          console.error('Error in change-role:', error);
          return new Response(
            JSON.stringify({ error: `Role update failed: ${error instanceof Error ? error.message : 'Unknown error'}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Handle user creation (admin only)
      if (!isAdmin) {
        console.log('Non-admin user attempted user creation:', user.user.email);
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

      console.log('Admin creating user:', email, 'with role:', role || 'user');

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        user_metadata: {
          full_name: displayName
        },
        email_confirm: true
      });

      if (error) {
        console.error('Error creating user:', error);
        return new Response(
          JSON.stringify({ error: `User creation failed: ${error.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create profile record and set role
      if (data.user) {
        try {
          // Create profile
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
              id: data.user.id,
              full_name: displayName,
              'Email ID': email
            });

          if (profileError) {
            console.warn('Profile creation failed:', profileError);
          } else {
            console.log('Profile created successfully for:', email);
          }

          // Set user role
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .insert({
              user_id: data.user.id,
              role: role || 'user',
              assigned_by: user.user.id
            });

          if (roleError) {
            console.warn('Role assignment failed:', roleError);
          } else {
            console.log('Role assigned successfully:', role || 'user');
          }

        } catch (err) {
          console.warn('Setup error:', err);
        }
      }

      console.log('User created successfully:', data.user?.email);
      return new Response(
        JSON.stringify({ 
          success: true,
          user: data.user,
          message: 'User created successfully'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // PUT - Update user (including activation/deactivation)
    if (req.method === 'PUT') {
      const { userId, displayName, action } = await req.json();
      
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'User ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if this is a restricted action that requires admin privileges
      if (action === 'activate' || action === 'deactivate') {
        if (!isAdmin) {
          console.log('Non-admin user attempted user status change:', user.user.email, 'action:', action);
          return new Response(
            JSON.stringify({ error: 'Only Admins can activate/deactivate users' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      console.log('Updating user:', userId, 'action:', action, 'displayName:', displayName);

      // Prepare update data for auth.users
      let updateData: any = {};

      // Handle display name updates (allow all authenticated users for their own profile updates)
      if (displayName !== undefined) {
        updateData.user_metadata = { full_name: displayName };
      }

      // Handle user activation/deactivation (admin only)
      if (action === 'activate') {
        updateData.ban_duration = 'none';
        console.log('Admin activating user:', userId);
      } else if (action === 'deactivate') {
        updateData.ban_duration = '876000h'; // ~100 years
        console.log('Admin deactivating user:', userId);
      }

      // Update auth user if needed
      if (Object.keys(updateData).length > 0) {
        console.log('Update data prepared:', JSON.stringify(updateData, null, 2));

        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          updateData
        );

        if (error) {
          console.error('Error updating user:', error);
          return new Response(
            JSON.stringify({ error: `User update failed: ${error.message}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Update profile if display name changed
      if (displayName !== undefined) {
        try {
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ full_name: displayName })
            .eq('id', userId);

          if (profileError) {
            console.warn('Profile update failed:', profileError);
          } else {
            console.log('Profile updated successfully for user:', userId);
          }
        } catch (profileErr) {
          console.warn('Profile update error:', profileErr);
        }
      }

      console.log('User updated successfully:', userId);
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'User updated successfully'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // DELETE - Delete user (admin only)
    if (req.method === 'DELETE') {
      if (!isAdmin) {
        console.log('Non-admin user attempted user deletion:', user.user.email);
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

      console.log('Admin deleting user:', userId);

      try {
        // First, clean up all references to this user in public tables
        // Set NULL for columns that reference auth.users with ON DELETE SET NULL
        console.log('Cleaning up user references before deletion...');
        
        // Clean up deals table
        await supabaseAdmin.from('deals').update({ created_by: null }).eq('created_by', userId);
        await supabaseAdmin.from('deals').update({ modified_by: null }).eq('modified_by', userId);
        
        // Clean up leads table
        await supabaseAdmin.from('leads').update({ created_by: null }).eq('created_by', userId);
        await supabaseAdmin.from('leads').update({ modified_by: null }).eq('modified_by', userId);
        await supabaseAdmin.from('leads').update({ contact_owner: null }).eq('contact_owner', userId);
        
        // Clean up contacts table
        await supabaseAdmin.from('contacts').update({ created_by: null }).eq('created_by', userId);
        await supabaseAdmin.from('contacts').update({ modified_by: null }).eq('modified_by', userId);
        await supabaseAdmin.from('contacts').update({ contact_owner: null }).eq('contact_owner', userId);
        
        // Clean up deal_action_items table
        await supabaseAdmin.from('deal_action_items').update({ created_by: null }).eq('created_by', userId);
        await supabaseAdmin.from('deal_action_items').update({ assigned_to: null }).eq('assigned_to', userId);
        
        // Clean up lead_action_items table
        await supabaseAdmin.from('lead_action_items').update({ created_by: null }).eq('created_by', userId);
        await supabaseAdmin.from('lead_action_items').update({ assigned_to: null }).eq('assigned_to', userId);
        
        // Clean up user_roles assigned_by
        await supabaseAdmin.from('user_roles').update({ assigned_by: null }).eq('assigned_by', userId);
        
        // Clean up security_audit_log
        await supabaseAdmin.from('security_audit_log').update({ user_id: null }).eq('user_id', userId);
        
        // Clean up yearly_revenue_targets
        await supabaseAdmin.from('yearly_revenue_targets').update({ created_by: null }).eq('created_by', userId);
        
        console.log('User references cleaned up, now deleting auth user...');

        // Delete the auth user (cascade will handle remaining records like profiles, user_roles, etc.)
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authDeleteError) {
          console.error('Error deleting auth user:', authDeleteError);
          return new Response(
            JSON.stringify({ 
              error: `User deletion failed: ${authDeleteError.message}` 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('User deleted successfully by admin:', user.user.email);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'User deleted successfully',
            userId: userId 
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );

      } catch (deleteError: any) {
        console.error('Unexpected error during user deletion:', deleteError);
        return new Response(
          JSON.stringify({ 
            error: `Deletion failed: ${deleteError.message || 'Unknown error'}` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ error: `Method ${req.method} not allowed` }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Unexpected error in user-admin function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message || 'An unexpected error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
