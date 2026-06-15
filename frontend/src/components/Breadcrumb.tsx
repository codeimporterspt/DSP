import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const PAGE_NAMES: Record<string, string> = {
  '/pesquisa': 'Pesquisa',
  '/novo-registo': 'Novo Registo',
  '/atualizar-viaturas': 'Atualizar Viaturas',
};

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export default function Breadcrumb({ items }: { items?: BreadcrumbItem[] }) {
  const location = useLocation();

  if (!items) {
    const pageName = PAGE_NAMES[location.pathname] ?? 'Página';
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <span className="text-brand-dark font-semibold">DSP BYD</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-600 font-medium">{pageName}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm mb-6">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-gray-400">/</span>}
            {item.to && !isLast ? (
              <Link to={item.to} className="text-gray-500 hover:text-brand-dark transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-bold text-brand-dark' : 'text-gray-500'}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
