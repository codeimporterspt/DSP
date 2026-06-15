import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Pesquisa from './pages/Pesquisa';
import NovoRegisto from './pages/NovoRegisto';
import AtualizarViaturas from './pages/AtualizarViaturas';
import DetalheRegisto from './pages/DetalheRegisto';
import BackofficeOperacoes from './pages/BackofficeOperacoes';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

function ImportadorOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user.role === 'importador' ? <>{children}</> : <Navigate to="/pesquisa" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/pesquisa" replace />} />
            <Route path="/pesquisa" element={<Pesquisa />} />
            <Route path="/pesquisa/detalhe" element={<DetalheRegisto />} />
            <Route path="/novo-registo" element={<NovoRegisto />} />
            <Route path="/atualizar-viaturas" element={<ImportadorOnly><AtualizarViaturas /></ImportadorOnly>} />
            <Route path="/backoffice/operacoes" element={<ImportadorOnly><BackofficeOperacoes /></ImportadorOnly>} />
            <Route path="*" element={<Navigate to="/pesquisa" replace />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}
