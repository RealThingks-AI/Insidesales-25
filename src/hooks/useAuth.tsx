
import { useState, useEffect, useRef, createContext, useContext } from "react";
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

  useEffect(() => {
    let mounted = true;
    const sessionFetchedRef = { current: false };

    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        console.log('Auth state change:', event, session?.user?.email);
        
        // Safari-compatible session handling
        if (session) {
          setSession(session);
          setUser(session.user);
        } else {
          setSession(null);
          setUser(null);
        }
        
        if (event === 'SIGNED_OUT') {
          cleanupAuthState();
        }
        
        if (event === 'TOKEN_REFRESHED' && session) {
          // Update user data when token is refreshed (role changes, etc.)
          setSession(session);
          setUser(session.user);
        }
        
        setLoading(false);
        sessionFetchedRef.current = true;
      }
    );

    // Only get initial session if not already handled by auth state change
    const getInitialSession = async () => {
      if (!mounted || sessionFetchedRef.current) return;
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          console.error('Error getting session:', error);
          cleanupAuthState();
          setSession(null);
          setUser(null);
        } else if (session && !sessionFetchedRef.current) {
          setSession(session);
          setUser(session.user);
        } else if (!session) {
          setSession(null);
          setUser(null);
        }
      } catch (error) {
        if (!mounted) return;
        console.error('Session retrieval failed:', error);
      } finally {
        if (mounted && !sessionFetchedRef.current) {
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
  }, []); // Empty dependency array to prevent re-running

  const signOut = async () => {
    try {
      // Clean up auth state first
      cleanupAuthState();
      
      // Safari-compatible sign out
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) {
        console.warn('Sign out error:', error);
      }
      
      // State will be cleared by onAuthStateChange SIGNED_OUT event
      // React Router's AuthRoute handles redirect
      setSession(null);
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
      // Force clear state even if sign out fails
      setSession(null);
      setUser(null);
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
