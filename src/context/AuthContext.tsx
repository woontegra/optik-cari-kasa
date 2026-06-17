import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ipc } from '@/services/ipc';
import type { Permission, SecuritySettings, UserSession } from '@/types/auth';

interface AuthContextValue {
  session: UserSession | null;
  loading: boolean;
  locked: boolean;
  security: SecuritySettings;
  login: (username: string, password: string) => Promise<UserSession>;
  logout: () => Promise<void>;
  unlock: (password: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
  touchActivity: () => void;
  loadSecurity: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [security, setSecurity] = useState<SecuritySettings>({ autoLockMinutes: 0 });
  const lastActivity = useRef(Date.now());

  const touchActivity = useCallback(() => {
    lastActivity.current = Date.now();
    if (locked) return;
  }, [locked]);

  const loadSecurity = useCallback(async () => {
    try {
      const s = await ipc.auth.getSecurity();
      setSecurity(s);
    } catch {
      setSecurity({ autoLockMinutes: 0 });
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const s = await ipc.auth.getSession();
      setSession(s);
    } catch {
      setSession(null);
    }
  }, []);

  useEffect(() => {
    Promise.all([ipc.auth.getSession(), ipc.auth.getSecurity()])
      .then(([s, sec]) => {
        setSession(s);
        setSecurity(sec);
      })
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!session || security.autoLockMinutes <= 0) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - lastActivity.current) / 60000;
      if (elapsed >= security.autoLockMinutes) {
        setLocked(true);
      }
    }, 15000);

    const onActivity = () => {
      if (!locked) lastActivity.current = Date.now();
    };
    window.addEventListener('mousedown', onActivity);
    window.addEventListener('keydown', onActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousedown', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [session, security.autoLockMinutes, locked]);

  const login = async (username: string, password: string) => {
    const s = await ipc.auth.login({ username, password });
    setSession(s);
    setLocked(false);
    lastActivity.current = Date.now();
    await loadSecurity();
    return s;
  };

  const logout = async () => {
    await ipc.auth.logout();
    setSession(null);
    setLocked(false);
  };

  const unlock = async (password: string) => {
    await ipc.auth.unlock(password);
    setLocked(false);
    lastActivity.current = Date.now();
  };

  const hasPermission = (permission: Permission) => {
    if (!session) return false;
    if (session.role === 'Yönetici') return true;
    return session.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        locked,
        security,
        login,
        logout,
        unlock,
        refreshSession,
        hasPermission,
        touchActivity,
        loadSecurity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth AuthProvider içinde kullanılmalıdır.');
  return ctx;
}
