import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';

interface DetailRecord {
  id: number;
  vin: string;
  matricula: string;
  codigo_concessao: string;
  data_servico: string;
  quilometros: number;
  tipo_operacao: string;
  veiculo_modelo: string;
  veiculo_marca: string;
  veiculo_motorizacao: string;
  veiculo_data_matricula: string;
  concessao_nome: string;
  concessao_cidade: string;
  concessao_cp: string;
  concessao_pais: string;
}

function formatDate(iso: string) {
  if (!iso) return '-';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[220px_1fr] gap-6 py-3 border-b border-gray-100 last:border-0">
      <dt className="text-sm font-semibold text-brand-dark">{label}</dt>
      <dd className="text-sm text-gray-700">{value ?? '-'}</dd>
    </div>
  );
}

const BREADCRUMB = [
  { label: 'DSP', to: '/' },
  { label: 'Pesquisa', to: '/pesquisa' },
  { label: 'Detalhe' },
];

export default function DetalheRegisto() {
  const location = useLocation();
  const record = location.state?.record as DetailRecord | undefined;

  if (!record) {
    return <Navigate to="/pesquisa" replace />;
  }

  const codigoModelo = record.vin.length >= 6 ? record.vin.substring(3, 6) : '-';

  return (
    <div className="p-6">
      <Breadcrumb items={BREADCRUMB} />

      <h1 className="text-xl font-bold text-brand-dark mb-6">Serviço de Manutenção do Veículo</h1>

      <div className="bg-white rounded-lg border border-gray-200 px-8 py-2">
        <dl>
          <Field label="Matrícula" value={record.matricula} />
          <Field label="VIN" value={<span className="font-mono text-xs">{record.vin}</span>} />
          <Field label="Data de Matrícula" value={formatDate(record.veiculo_data_matricula)} />
          <Field label="Código de Modelo" value={codigoModelo} />
          <Field label="Modelo" value={record.veiculo_modelo} />
          <Field label="Código Concessionário" value={record.codigo_concessao} />
          <Field label="Nome/Descrição" value={record.concessao_nome} />
          <Field label="Cidade" value={record.concessao_cidade} />
          <Field label="Código Postal" value={record.concessao_cp} />
          <Field label="País" value={record.concessao_pais ?? 'Portugal'} />
          <Field label="Operações" value={record.tipo_operacao} />
          <Field label="Quilómetros" value={`${record.quilometros.toLocaleString('pt-PT')} Km`} />
          <Field label="Data de Serviço" value={formatDate(record.data_servico)} />
        </dl>
      </div>
    </div>
  );
}
