import React from 'react';
import { useLocation } from 'react-router-dom';

const PAGE_NAMES: Record<string, string> = {
  '/pesquisa': 'Pesquisa',
  '/novo-registo': 'Novo Registo',
  '/atualizar-viaturas': 'Atualizar Viaturas',
};

export default function Breadcrumb() {
  const location = useLocation();
  const pageName = PAGE_NAMES[location.pathname] ?? 'Página';

  return (
    <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
      <span className="text-byd-dark font-semibold">DSP</span>
      <span className="text-gray-400">/</span>
      <span className="text-gray-600 font-medium">{pageName}</span>
    </div>
  );
}
