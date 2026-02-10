import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { StoredUserProfile } from '../types';
import { getStoredToken, getStoredUser, logout as authLogout } from '../utils/auth';

interface AuthContextType {
  hasToken: boolean;
  user: StoredUserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  hasToken: false,
  user: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [hasToken, setHasToken] = useState(false);
  const [user, setUser] = useState<StoredUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuthState = () => {
    Promise.all([getStoredToken(), getStoredUser()]).then(([token, storedUser]) => {
      setHasToken(!!token);
      setUser(storedUser ?? null);
      setLoading(false);
    });
  };

  useEffect(() => {
    refreshAuthState();
  }, []);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
    const listener = () => refreshAuthState();
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const logout = async () => {
    await authLogout();
    setHasToken(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ hasToken, user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
