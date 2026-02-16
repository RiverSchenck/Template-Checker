import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import { baseURL, getAuthHeaders } from './Analytics/api';

export type Role = 'user' | 'admin';

const ROLE_CACHE_KEY_PREFIX = 'template-checker-role-';

function getCachedRole(userId: string): Role | null {
  try {
    const cached = localStorage.getItem(ROLE_CACHE_KEY_PREFIX + userId);
    return cached === 'admin' || cached === 'user' ? cached : null;
  } catch {
    return null;
  }
}

function setCachedRole(userId: string, role: Role) {
  try {
    localStorage.setItem(ROLE_CACHE_KEY_PREFIX + userId, role);
  } catch {
    // ignore
  }
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: Role | null;
  loadingRole: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const defaultContextValue: AuthContextType = {
  user: null,
  session: null,
  loading: true,
  role: null,
  loadingRole: true,
  isAdmin: false,
  signInWithGoogle: async () => {
    console.warn('signInWithGoogle was called without an AuthProvider');
  },
  signOut: async () => {
    console.warn('signOut was called without an AuthProvider');
  },
};

const AuthContext = createContext<AuthContextType>(defaultContextValue);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled) {
        setSession(session);
        setUser(session?.user ?? null);
      }
      if (!cancelled) setLoading(false);
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setRole(null);
      setLoadingRole(false);
      return;
    }
    if (!session.access_token) {
      setRole('user');
      setLoadingRole(false);
      return;
    }
    const userId = session.user?.id;
    // Use role from session (JWT app_metadata) or cache immediately so UI is ready on load
    const tokenRole = session.user?.app_metadata?.role;
    const roleFromToken =
      tokenRole === 'admin' || tokenRole === 'user' ? (tokenRole as Role) : null;
    if (roleFromToken) {
      setRole(roleFromToken);
      setLoadingRole(false);
    } else if (userId) {
      const cached = getCachedRole(userId);
      if (cached) {
        setRole(cached);
        setLoadingRole(false);
      }
    }
    const fetchMe = async () => {
      try {
        const res = await fetch(`${baseURL}/me`, {
          headers: getAuthHeaders(session.access_token),
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          const newRole = (data.role === 'admin' ? 'admin' : 'user') as Role;
          setRole(newRole);
          if (userId) setCachedRole(userId, newRole);
        } else if (!cancelled) {
          setRole('user');
          if (userId) setCachedRole(userId, 'user');
        }
      } catch {
        if (!cancelled) setRole('user');
        if (userId) setCachedRole(userId, 'user');
      } finally {
        if (!cancelled) setLoadingRole(false);
      }
    };
    fetchMe();
  }, [session?.access_token, session?.user?.id]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      role,
      loadingRole,
      isAdmin: role === 'admin',
      signInWithGoogle,
      signOut,
    }),
    [user, session, loading, role, loadingRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
