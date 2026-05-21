import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Pesquisa from './pages/Pesquisa';
import NovoRegisto from './pages/NovoRegisto';
import AtualizarViaturas from './pages/AtualizarViaturas';

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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/pesquisa" replace />} />
            <Route path="/pesquisa" element={<Pesquisa />} />
            <Route path="/novo-registo" element={<NovoRegisto />} />
            <Route path="/atualizar-viaturas" element={<AtualizarViaturas />} />
            <Route path="*" element={<Navigate to="/pesquisa" replace />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}
