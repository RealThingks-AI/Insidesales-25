
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

type Theme = 'light' | 'dark' | 'system';

export const useThemePreferences = () => {
  const isInitialLoad = useRef(true);
  const [theme, setThemeState] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    return savedTheme || 'light';
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  // Get actual theme based on system preference
  const getEffectiveTheme = useCallback((currentTheme: Theme): 'light' | 'dark' => {
    if (currentTheme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return currentTheme;
  }, []);

  // Apply theme to DOM
  const applyTheme = useCallback((newTheme: Theme) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(getEffectiveTheme(newTheme));
  }, [getEffectiveTheme]);

  // Listen for system theme changes when using system theme
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => applyTheme('system');

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, applyTheme]);

  // Load user preferences from database
  const loadUserPreferences = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('theme')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const userTheme = (data?.theme as Theme) || 'light';
      setThemeState(userTheme);
      localStorage.setItem('theme', userTheme);
      applyTheme(userTheme);
    } catch (error) {
      console.error('Error loading theme preferences:', error);
      const fallbackTheme = (localStorage.getItem('theme') as Theme) || 'light';
      setThemeState(fallbackTheme);
      applyTheme(fallbackTheme);
    } finally {
      setLoading(false);
      isInitialLoad.current = false;
    }
  };

  // Save theme preference to database
  const saveThemePreference = async (newTheme: Theme) => {
    const isInitial = isInitialLoad.current;
    
    if (!user) {
      localStorage.setItem('theme', newTheme);
      setThemeState(newTheme);
      applyTheme(newTheme);
      return;
    }

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          { user_id: user.id, theme: newTheme },
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      localStorage.setItem('theme', newTheme);
      setThemeState(newTheme);
      applyTheme(newTheme);

      // Only show toast for user-initiated changes, not initial load
      if (!isInitial) {
        const themeLabel = newTheme === 'system' ? 'System' : newTheme.charAt(0).toUpperCase() + newTheme.slice(1);
        toast({
          title: "Theme Updated",
          description: `Theme changed to ${themeLabel}.`,
        });
      }
    } catch (error) {
      console.error('Error saving theme preference:', error);
      toast({
        title: "Error",
        description: "Failed to save theme preference. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Load preferences when user changes or component mounts
  useEffect(() => {
    loadUserPreferences();
  }, [user]);

  // Apply theme when it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  return {
    theme,
    setTheme: saveThemePreference,
    loading,
    effectiveTheme: getEffectiveTheme(theme),
  };
};
