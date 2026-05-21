import React, { createContext, useContext, useState, useEffect } from 'react';

export type Role = 'importador' | 'concessionario';

export interface User {
  role: Role;
  nome: string;
  codigo_concessao?: string;
}

const MOCK_USERS: Record<Role, User> = {
  importador: { role: 'importador', nome: 'Utilizador 1' },
  concessionario: { role: 'concessionario', nome: 'Utilizador 1', codigo_concessao: '4711' },
};

interface AuthContextType {
  user: User;
  setRole: (role: Role) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: MOCK_USERS.importador,
  setRole: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(() => {
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role') as Role | null;
    const saved = localStorage.getItem('dsp_role') as Role | null;
    const active = (role === 'importador' || role === 'concessionario') ? role
      : (saved === 'importador' || saved === 'concessionario') ? saved
      : 'importador';
    return MOCK_USERS[active];
  });

  const setRole = (role: Role) => {
    localStorage.setItem('dsp_role', role);
    setUser(MOCK_USERS[role]);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role') as Role | null;
    if (role === 'importador' || role === 'concessionario') {
      setRole(role);
    }
  }, []);

  return <AuthContext.Provider value={{ user, setRole }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
