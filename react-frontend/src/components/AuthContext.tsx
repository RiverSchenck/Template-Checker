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

/** Current user from backend GET /me. Single source of truth for display and role. */
export interface CurrentUser {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: Role;
}

const ROLE_CACHE_KEY_PREFIX = 'template-checker-role-';

/** When user gets 403, we store their email here so Login can pre-fill the request form (they must still submit with "why"). */
const ACCESS_DENIED_EMAIL_KEY = 'template-checker-accessDeniedEmail';

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

function clearCachedRole(userId: string) {
  try {
    localStorage.removeItem(ROLE_CACHE_KEY_PREFIX + userId);
  } catch {
    // ignore
  }
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  /** Current user from backend /me. Use this for display (name, avatar, email) and role. */
  currentUser: CurrentUser | null;
  loading: boolean;
  role: Role | null;
  loadingRole: boolean;
  isAdmin: boolean;
  accessDenied: boolean;
  requestSubmittedForEmail: string | null;
  clearAccessDenied: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const defaultContextValue: AuthContextType = {
  user: null,
  session: null,
  currentUser: null,
  loading: true,
  role: null,
  loadingRole: true,
  isAdmin: false,
  accessDenied: false,
  requestSubmittedForEmail: null,
  clearAccessDenied: () => {},
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
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [requestSubmittedForEmail, setRequestSubmittedForEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        setSession(session);
        setUser(session.user ?? null);
        setLoading(false);
      } else {
        // Session may still be restoring from storage (e.g. on reload). Delay
        // "loading done" so onAuthStateChange can fire with the restored session
        // and we don't flash the login page.
        timeoutId = window.setTimeout(() => {
          if (!cancelled) setLoading(false);
        }, 150);
      }
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
      if (timeoutId != null) clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setCurrentUser(null);
      setRole(null);
      setLoadingRole(false);
      return;
    }
    if (!session.access_token) {
      // Session without token is invalid (e.g. stale); don't show protected app
      setCurrentUser(null);
      setSession(null);
      setUser(null);
      setRole(null);
      setLoadingRole(false);
      return;
    }
    // We have a valid session; ensure we show "Checking access..." until /me returns.
    // (If we previously had no session, loadingRole was set false; onAuthStateChange can
    // fire before getSession() returns, so we must set it true here.)
    setLoadingRole(true);
    const userId = session.user?.id;
    // Optimistic role from token or cache for UI (e.g. admin menu) — we do NOT set loadingRole
    // here; the app must not render until /me has confirmed access (see ProtectedLayout).
    const tokenRole = session.user?.app_metadata?.role;
    const roleFromToken =
      tokenRole === 'admin' || tokenRole === 'user' ? (tokenRole as Role) : null;
    if (roleFromToken) {
      setRole(roleFromToken);
    } else if (userId) {
      const cached = getCachedRole(userId);
      if (cached) {
        setRole(cached);
      }
    }
    const fetchMe = async () => {
      try {
        const res = await fetch(`${baseURL}/me`, {
          headers: getAuthHeaders(session.access_token),
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          const me: CurrentUser = {
            id: String(data.id ?? ''),
            email: data.email ?? '',
            display_name: data.display_name ?? null,
            avatar_url: data.avatar_url ?? null,
            role: data.role === 'admin' ? 'admin' : 'user',
          };
          setCurrentUser(me);
          setRole(me.role);
          if (userId) setCachedRole(userId, me.role);
        } else if (!cancelled && res.status === 403) {
          const data = await res.json().catch(() => ({}));
          if (data.allowed === false || data.error?.code === 'access_denied') {
            const emailToShow = session.user?.email ?? '';
            if (emailToShow) {
              try {
                sessionStorage.setItem(ACCESS_DENIED_EMAIL_KEY, emailToShow);
              } catch {
                // ignore
              }
            }
            setAccessDenied(true);
            setCurrentUser(null);
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setRole(null);
            if (userId) clearCachedRole(userId);
          } else {
            setRole('user');
            if (userId) setCachedRole(userId, 'user');
          }
        } else if (!cancelled) {
          setRole('user');
          if (userId) setCachedRole(userId, 'user');
        }
      } catch {
        // Strict single source: do not set currentUser on error; app will not show until 200
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
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
    if (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    setCurrentUser(null);
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = useMemo(
    () => ({
      user,
      session,
      currentUser,
      loading,
      role,
      loadingRole,
      isAdmin: role === 'admin',
      accessDenied,
      requestSubmittedForEmail,
      clearAccessDenied: () => {
        setAccessDenied(false);
        setRequestSubmittedForEmail(null);
      },
      signInWithGoogle,
      signOut,
    }),
    [user, session, currentUser, loading, role, loadingRole, accessDenied, requestSubmittedForEmail]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
