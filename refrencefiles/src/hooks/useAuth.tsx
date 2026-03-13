
import { useState, useEffect, createContext, useContext } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Enhanced cleanup for Safari compatibility
const cleanupAuthState = () => {
  try {
    // Safari-safe localStorage cleanup
    if (typeof Storage !== 'undefined' && typeof localStorage !== 'undefined') {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          try {
            localStorage.removeItem(key);
          } catch (e) {
            console.warn('Failed to remove localStorage key:', key, e);
          }
        }
      });
    }
    
    // Safari-safe sessionStorage cleanup
    if (typeof Storage !== 'undefined' && typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          try {
            sessionStorage.removeItem(key);
          } catch (e) {
            console.warn('Failed to remove sessionStorage key:', key, e);
          }
        }
      });
    }
  } catch (error) {
    console.warn('Error during auth state cleanup:', error);
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      
      // Force a fresh session to get updated user metadata
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      
      setUser(user);
      setSession(session);
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  // Generate a unique browser session ID (stored in localStorage)
  const getBrowserSessionId = (): string => {
    const storageKey = 'browser_session_id';
    try {
      let sessionId = localStorage.getItem(storageKey);
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem(storageKey, sessionId);
      }
      return sessionId;
    } catch {
      // Fallback for when localStorage is unavailable
      return crypto.randomUUID();
    }
  };

  // Helper to parse user agent
  const parseUserAgent = (ua: string) => {
    let browser = 'Unknown', os = 'Unknown';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    return { browser, os };
  };

  // Track session in database using unique browser session ID
  const trackSession = async (session: Session | null) => {
    if (!session?.user?.id) return;
    const browserSessionId = getBrowserSessionId();
    const userAgent = navigator.userAgent;
    const deviceInfo = parseUserAgent(userAgent);
    
    try {
      const { data: existing } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('session_token', browserSessionId)
        .single();
      
      if (existing) {
        await supabase.from('user_sessions')
          .update({ last_active_at: new Date().toISOString(), is_active: true })
          .eq('id', existing.id);
      } else {
        await supabase.from('user_sessions').insert({
          user_id: session.user.id,
          session_token: browserSessionId,
          user_agent: userAgent,
          device_info: deviceInfo,
          last_active_at: new Date().toISOString(),
          is_active: true
        });
      }
    } catch (error) {
      console.error('Error tracking session:', error);
    }
  };

  // Deactivate session on logout using browser session ID
  const deactivateSession = async (session: Session | null) => {
    if (!session?.user?.id) return;
    const browserSessionId = getBrowserSessionId();
    try {
      await supabase.from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', session.user.id)
        .eq('session_token', browserSessionId);
    } catch (error) {
      console.error('Error deactivating session:', error);
    }
  };

  useEffect(() => {
    let mounted = true;
    let sessionFetched = false;

    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        console.log('Auth state change:', event, session?.user?.email);
        
        if (session) {
          setSession(session);
          setUser(session.user);
        } else {
          setSession(null);
          setUser(null);
        }
        
        if (event === 'SIGNED_OUT') {
          cleanupAuthState();
          if (window.location.pathname !== '/auth') {
            window.location.replace('/auth');
          }
        }
        
        if (event === 'SIGNED_IN' && session) {
          // Track session after sign in
          setTimeout(() => trackSession(session), 0);
          if (window.location.pathname === '/auth') {
            window.location.replace('/');
          }
        }
        
        if (event === 'TOKEN_REFRESHED' && session) {
          setSession(session);
          setUser(session.user);
          // Update last active time
          setTimeout(() => trackSession(session), 0);
        }
        
        setLoading(false);
        sessionFetched = true;
      }
    );

    // Only get initial session if not already handled by auth state change
    const getInitialSession = async () => {
      if (!mounted || sessionFetched) return;
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error('Error getting session:', error);
          cleanupAuthState();
          setSession(null);
          setUser(null);
        } else if (session && !sessionFetched) {
          setSession(session);
          setUser(session.user);
          // Track initial session
          setTimeout(() => trackSession(session), 0);
        } else if (!session) {
          setSession(null);
          setUser(null);
        }
      } catch (error) {
        if (!mounted) return;
        console.error('Session retrieval failed:', error);
      } finally {
        if (mounted && !sessionFetched) {
          setLoading(false);
        }
      }
    };

    // Small delay to allow auth state change to handle session first
    const timeoutId = setTimeout(getInitialSession, 100);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // Deactivate session before sign out
      await deactivateSession(session);
      cleanupAuthState();
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) console.warn('Sign out error:', error);
      window.location.replace('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      window.location.replace('/auth');
    }
  };

  const value = {
    user,
    session,
    loading,
    signOut,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
