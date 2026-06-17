import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

interface Vehicle {
  id: number;
  vin: string;
  matricula: string;
  data_matricula: string;
  modelo: string;
  marca: string;
  motorizacao: 'EV' | 'PHEV';
}

interface Dealer {
  id: number;
  codigo_concessao: string;
  nome: string;
  cidade: string;
  codigo_postal: string;
  pais: string;
}

interface Operacao {
  id: number;
  codigo: string;
  observacoes: string | null;
}

export default function NovoRegisto() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [modal, setModal] = useState<{ title: string; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [searchMat, setSearchMat] = useState('');
  const [searchVin, setSearchVin] = useState('');
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  // Step 2
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);

  // Step 3
  const [dataServico, setDataServico] = useState(() => new Date().toISOString().split('T')[0]);
  const [quilometros, setQuilometros] = useState('');
  const [tipoOperacao, setTipoOperacao] = useState('');
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);

  useEffect(() => {
    if (step === 2) {
      if (user.role === 'importador') {
        fetch('/api/dealers').then(r => r.json()).then(setDealers);
      } else {
        fetch(`/api/dealers/${user.codigo_concessao}`).then(r => r.json()).then((d: Dealer) => {
          setSelectedDealer(d);
        });
      }
    }
    if (step === 3 && vehicle) {
      const kmInterval = vehicle.motorizacao === 'EV' ? 30000 : 15000;
      fetch('/api/tipos-operacao')
        .then(r => r.json())
        .then((tipos: Array<{ id: number; intervalo_kms: number; ativo: number }>) => {
          const tipo = tipos.find(t => t.intervalo_kms === kmInterval && t.ativo === 1);
          if (!tipo) return;
          fetch(`/api/operacoes?tipo_id=${tipo.id}&ativo=1&limit=200`)
            .then(r => r.json())
            .then(data => setOperacoes(data.data ?? []));
        });
    }
  }, [step, user, vehicle]);

  const handleVehicleSearch = async () => {
    if (!searchMat.trim() && !searchVin.trim()) return;
    const params = new URLSearchParams();
    if (searchMat.trim()) params.set('matricula', searchMat.trim());
    if (searchVin.trim()) params.set('vin', searchVin.trim());
    const res = await fetch(`/api/vehicles/search?${params}`);
    if (!res.ok) {
      setModal({ title: 'Viatura não encontrada', message: 'Não foi encontrado viaturas com os dados fornecidos.' });
      setVehicle(null);
      return;
    }
    const data = await res.json();
    setVehicle(data);
  };

  const handleDealerSelect = (codigo: string) => {
    const d = dealers.find(x => x.codigo_concessao === codigo) ?? null;
    setSelectedDealer(d);
  };

  const handleSubmit = async () => {
    if (!vehicle || !selectedDealer || !dataServico || !quilometros || !tipoOperacao) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/revisoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin: vehicle.vin,
          matricula: vehicle.matricula,
          codigo_concessao: selectedDealer.codigo_concessao,
          data_servico: dataServico,
          quilometros: parseInt(quilometros, 10),
          tipo_operacao: tipoOperacao,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setModal({ title: 'Erro', message: err.error ?? 'Erro ao submeter registo.' });
        return;
      }
      setModal({ title: 'Sucesso', message: 'Registo de serviço criado com sucesso!' });
      setTimeout(() => navigate('/pesquisa'), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <Breadcrumb />
      <h1 className="text-xl font-bold text-brand-dark mb-6">Novo Registo</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-8">
        {[1, 2, 3].map((s, idx) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${step === s ? 'bg-gray-900 text-white' : step > s ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step === s ? 'bg-white text-gray-900' : step > s ? 'bg-gray-600 text-white' : 'bg-gray-300 text-gray-500'}`}>
                {step > s ? '✓' : s}
              </span>
              {s === 1 ? 'Dados Viatura' : s === 2 ? 'Dados Concessionário' : 'Dados Serviço'}
            </div>
            {idx < 2 && <div className="flex-1 h-0.5 bg-gray-200" />}
          </React.Fragment>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Step 1 */}
        {step === 1 && (
          <div>
            <h2 className="text-base font-semibold text-brand-dark mb-4">Dados da Viatura</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Matrícula</label>
                <input className="input-field" placeholder="Ex: 00-AA-01" value={searchMat}
                  onChange={e => setSearchMat(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { vehicle ? setStep(2) : handleVehicleSearch(); } }} />
              </div>
              <div>
                <label className="label">VIN</label>
                <input className="input-field" placeholder="Ex: LGXCE4CB4P2000001" value={searchVin}
                  onChange={e => setSearchVin(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { vehicle ? setStep(2) : handleVehicleSearch(); } }} />
              </div>
            </div>
            <div className="flex gap-2 mb-6">
              <button onClick={handleVehicleSearch} className="btn-primary">Pesquisar</button>
              <button onClick={() => { setSearchMat(''); setSearchVin(''); setVehicle(null); }} className="btn-secondary">Limpar</button>
            </div>

            {vehicle && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                <p className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-3">Viatura Encontrada</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Matrícula', value: vehicle.matricula },
                    { label: 'VIN', value: vehicle.vin },
                    { label: 'Data de Matrícula', value: vehicle.data_matricula },
                    { label: 'Modelo', value: vehicle.modelo },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="label">{f.label}</label>
                      <div className="input-field bg-gray-100 text-gray-700 cursor-not-allowed">{f.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={() => setStep(2)}
                disabled={!vehicle}
                className="btn-primary disabled:opacity-40"
              >
                Próximo Passo →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <h2 className="text-base font-semibold text-brand-dark mb-4">Dados do Concessionário</h2>

            {user.role === 'importador' && (
              <div className="mb-4">
                <label className="label">Selecione um concessionário</label>
                <select
                  className="input-field"
                  value={selectedDealer?.codigo_concessao ?? ''}
                  onChange={e => handleDealerSelect(e.target.value)}
                >
                  <option value="">-- Selecione --</option>
                  {dealers.map(d => (
                    <option key={d.codigo_concessao} value={d.codigo_concessao}>{d.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedDealer && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Concessionário', value: selectedDealer.nome },
                    { label: 'Código Concessionário', value: selectedDealer.codigo_concessao },
                    { label: 'Cidade', value: selectedDealer.cidade },
                    { label: 'Código Postal', value: selectedDealer.codigo_postal },
                    { label: 'País', value: selectedDealer.pais },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="label">{f.label}</label>
                      <div className="input-field bg-gray-100 text-gray-700 cursor-not-allowed">{f.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between mt-4">
              <button onClick={() => setStep(1)} className="btn-secondary">← Passo Anterior</button>
              <button onClick={() => setStep(3)} disabled={!selectedDealer} className="btn-primary disabled:opacity-40">
                Próximo Passo →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div>
            <h2 className="text-base font-semibold text-brand-dark mb-4">Dados do Serviço</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="label">Data de Serviço</label>
                <input
                  type="date"
                  className="input-field"
                  value={dataServico}
                  onChange={e => setDataServico(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Quilómetros</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="Km's atuais"
                  value={quilometros}
                  onChange={e => setQuilometros(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !submitting && dataServico && quilometros && tipoOperacao) handleSubmit(); }}
                  min={0}
                />
              </div>
              <div>
                <label className="label">
                  Tipo de Operação
                  {vehicle && <span className="ml-1 text-gray-500 font-normal normal-case tracking-normal">({vehicle.motorizacao})</span>}
                </label>
                <select
                  className="input-field"
                  value={tipoOperacao}
                  onChange={e => setTipoOperacao(e.target.value)}
                >
                  <option value="">-- Selecione --</option>
                  {operacoes.map(o => {
                    const label = o.observacoes ?? o.codigo;
                    return <option key={o.id} value={label}>{label}</option>;
                  })}
                </select>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="btn-secondary">← Passo Anterior</button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !dataServico || !quilometros || !tipoOperacao}
                className="btn-primary disabled:opacity-40"
              >
                {submitting ? 'A submeter...' : 'Submeter'}
              </button>
            </div>
          </div>
        )}
      </div>

      {modal && <Modal title={modal.title} message={modal.message} onClose={() => setModal(null)} />}
    </div>
  );
}
