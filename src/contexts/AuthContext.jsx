import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('fs_token');
    const raw   = localStorage.getItem('fs_user');
    if (token && raw) {
      try { setUser(JSON.parse(raw)); } catch {}
    }
    setLoading(false);
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('fs_token', token);
    localStorage.setItem('fs_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('fs_token');
    localStorage.removeItem('fs_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user, login, logout, loading,
      isAdmin:      user?.role === 'admin' || user?.role === 'superadmin',
      isSuperAdmin: user?.role === 'superadmin',
      isAgent:      user?.role === 'agent',
      assignedAccounts: user?.assignedAccounts || [],
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
