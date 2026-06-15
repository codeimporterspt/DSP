import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/pesquisa', label: 'Pesquisa' },
  { to: '/novo-registo', label: 'Novo Registo' },
  { to: '/atualizar-viaturas', label: 'Atualizar Viaturas', importadorOnly: true },
];

export default function Sidebar() {
  const { user, setRole } = useAuth();
  const location = useLocation();
  const [backofficeOpen, setBackofficeOpen] = useState(false);

  useEffect(() => {
    if (location.pathname.startsWith('/backoffice')) setBackofficeOpen(true);
  }, [location.pathname]);

  return (
    <aside className="w-56 min-h-screen bg-brand-dark flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-white font-black text-2xl tracking-tight">DSP</span>
        </div>
        <p className="text-white/40 text-xs mt-0.5">Digital Service Passport</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4">
        {navItems.map(item => {
          if (item.importadorOnly && user.role !== 'importador') return null;
          const active = location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center px-5 py-3 text-sm font-medium transition-colors ${
                active
                  ? 'bg-white text-brand-dark'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              {item.label}
            </NavLink>
          );
        })}

        {user.role === 'importador' && (
          <>
            <button
              onClick={() => setBackofficeOpen(o => !o)}
              className={`w-full flex items-center justify-between px-5 py-3 text-sm font-medium transition-colors ${
                location.pathname.startsWith('/backoffice')
                  ? 'bg-white text-brand-dark'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>Backoffice</span>
              <span className="text-xs">{backofficeOpen ? '▾' : '▸'}</span>
            </button>
            {backofficeOpen && (
              <NavLink
                to="/backoffice/operacoes"
                className={({ isActive }) =>
                  `flex items-center pl-9 pr-5 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white font-medium'
                      : 'text-white/50 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                Gestão de Operações
              </NavLink>
            )}
          </>
        )}
      </nav>

      {/* Role switcher */}
      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-white/40 text-xs mb-1 uppercase tracking-wide">Utilizador</p>
        <p className="text-white text-xs font-medium truncate">{user.nome}</p>
        <p className="text-white/50 text-xs mb-3 capitalize">{user.role}</p>
        <div className="flex gap-1">
          <button
            onClick={() => setRole('importador')}
            className={`flex-1 text-xs py-1 rounded transition-colors ${
              user.role === 'importador' ? 'bg-white text-brand-dark' : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            Importador
          </button>
          <button
            onClick={() => setRole('concessionario')}
            className={`flex-1 text-xs py-1 rounded transition-colors ${
              user.role === 'concessionario' ? 'bg-white text-brand-dark' : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            Concess.
          </button>
        </div>
      </div>
    </aside>
  );
}
