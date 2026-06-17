import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';
import { useAuth } from '../context/AuthContext';

interface ServiceRecord {
  id: number;
  vin: string;
  matricula: string;
  codigo_concessao: string;
  data_servico: string;
  quilometros: number;
  tipo_operacao: string;
  created_at: string;
  veiculo_modelo: string;
  veiculo_marca: string;
  veiculo_motorizacao: string;
  veiculo_data_matricula: string;
  concessao_nome: string;
  concessao_cidade: string;
  concessao_cp: string;
  concessao_pais: string;
}

interface EditState {
  id: number;
  codigo_concessao: string;
  data_servico: string;
  quilometros: string;
  tipo_operacao: string;
}

const PAGE_SIZE = 10;

export default function Pesquisa() {
  const [matricula, setMatricula] = useState('');
  const [vin, setVin] = useState('');
  const [results, setResults] = useState<ServiceRecord[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const doSearch = useCallback(async (p: number) => {
    if (!matricula.trim() && !vin.trim()) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (matricula.trim()) params.set('matricula', matricula.trim());
      if (vin.trim()) params.set('vin', vin.trim());
      params.set('page', String(p));
      params.set('limit', String(PAGE_SIZE));
      const res = await fetch(`/api/revisoes?${params}`);
      const data = await res.json();
      setResults(data.data ?? []);
      setTotal(data.total ?? 0);
      setPage(p);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [matricula, vin]);

  const handleSearch = () => { setPage(1); doSearch(1); };
  const handleClear = () => { setMatricula(''); setVin(''); setResults(null); setTotal(0); setPage(1); setSelectedIds(new Set()); };

  const handleGeneratePdf = async () => {
    const searchVin = vin.trim() || results?.[0]?.vin;
    if (!searchVin) return;
    const res = await fetch(`/api/revisoes/${searchVin}/pdf`);
    if (!res.ok) { alert('Erro ao gerar PDF'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disp = res.headers.get('Content-Disposition') ?? '';
    const match = disp.match(/filename="([^"]+)"/);
    a.download = match ? match[1] : `DSP_${searchVin}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canDelete = (r: ServiceRecord) =>
    user.role === 'importador' || r.codigo_concessao === user.codigo_concessao;

  const handleDelete = async (id: number) => {
    await fetch(`/api/revisoes/${id}`, { method: 'DELETE' });
    doSearch(page);
    setDeleteConfirm(null);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    await fetch('/api/revisoes/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    setBulkDeleteConfirm(false);
    doSearch(page);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectableIds = (results ?? []).filter(canDelete).map(r => r.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        selectableIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => new Set([...prev, ...selectableIds]));
    }
  };

  const handleEditSave = async () => {
    if (!editState) return;
    await fetch(`/api/revisoes/${editState.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo_concessao: editState.codigo_concessao,
        data_servico: editState.data_servico,
        quilometros: parseInt(editState.quilometros, 10),
        tipo_operacao: editState.tipo_operacao,
      }),
    });
    setEditState(null);
    doSearch(page);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6">
      <Breadcrumb />
      <h1 className="text-xl font-bold text-brand-dark mb-6">Pesquisa de Registos</h1>

      {/* Search form */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Matrícula</label>
            <input
              className="input-field"
              placeholder="Ex: 00-AA-01"
              value={matricula}
              onChange={e => setMatricula(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div>
            <label className="label">VIN</label>
            <input
              className="input-field"
              placeholder="Ex: LGXCE4CB4P2000001"
              value={vin}
              onChange={e => setVin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSearch} disabled={loading} className="btn-primary">
            {loading ? 'A pesquisar...' : 'Pesquisar'}
          </button>
          <button onClick={handleClear} className="btn-secondary">Limpar</button>
        </div>
      </div>

      {/* Results */}
      {results !== null && (
        <div className="bg-white rounded-lg border border-gray-200">
          {results.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">
              Não existem registos a mostrar
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <p className="text-sm text-gray-500">
                  Mostrando <span className="font-semibold text-brand-dark">{(page - 1) * PAGE_SIZE + 1}</span> até{' '}
                  <span className="font-semibold text-brand-dark">{Math.min(page * PAGE_SIZE, total)}</span> de{' '}
                  <span className="font-semibold text-brand-dark">{total}</span> Registos
                </p>
                <div className="flex gap-2">
                  {selectedIds.size > 0 && (
                    <button onClick={() => setBulkDeleteConfirm(true)} className="btn-secondary text-xs text-red-600 border-red-300 hover:bg-red-50">
                      Eliminar selecionados ({selectedIds.size})
                    </button>
                  )}
                  <button onClick={handleGeneratePdf} className="btn-primary text-xs">
                    Gerar Ficheiro
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="cursor-pointer"
                          title="Selecionar todos"
                        />
                      </th>
                      {['Matrícula', 'VIN', 'Modelo', 'Código CSS', 'Concessionário', 'Tipo de Operações', 'Quilómetros', 'Data de Serviço', 'Ação'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-brand-dark uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <React.Fragment key={r.id}>
                        <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 w-8">
                            {canDelete(r) && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(r.id)}
                                onChange={() => toggleSelect(r.id)}
                                onClick={e => e.stopPropagation()}
                                className="cursor-pointer"
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium">{r.matricula}</td>
                          <td className="px-4 py-3 text-xs text-gray-600 font-mono">{r.vin}</td>
                          <td className="px-4 py-3 text-xs">{r.veiculo_modelo ?? '-'}</td>
                          <td className="px-4 py-3 text-xs">{r.codigo_concessao}</td>
                          <td className="px-4 py-3 text-xs">{r.concessao_nome ?? '-'}</td>
                          <td className="px-4 py-3 text-xs">{r.tipo_operacao}</td>
                          <td className="px-4 py-3 text-xs">{r.quilometros.toLocaleString('pt-PT')} Km</td>
                          <td className="px-4 py-3 text-xs">{r.data_servico}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                title="Ver"
                                onClick={() => navigate('/pesquisa/detalhe', { state: { record: r } })}
                                className="text-gray-500 hover:text-brand-dark text-base"
                              >👁</button>
                              {(user.role === 'importador' || r.codigo_concessao === user.codigo_concessao) && (<>
                              <button
                                title="Editar"
                                onClick={() => setEditState({ id: r.id, codigo_concessao: r.codigo_concessao, data_servico: r.data_servico, quilometros: String(r.quilometros), tipo_operacao: r.tipo_operacao })}
                                className="text-gray-500 hover:text-brand-dark text-base"
                              >✏</button>
                              <button
                                title="Eliminar"
                                onClick={() => setDeleteConfirm(r.id)}
                                className="text-gray-500 hover:text-black text-base"
                              >🗑</button>
                              </>)}
                            </div>
                          </td>
                        </tr>
                        {editState?.id === r.id && (
                          <tr className="bg-blue-50 border-b border-blue-100">
                            <td colSpan={10} className="px-4 py-4">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                                <div>
                                  <label className="label">Data de Serviço</label>
                                  <input type="date" className="input-field" value={editState.data_servico}
                                    onChange={e => setEditState(s => s && ({ ...s, data_servico: e.target.value }))} />
                                </div>
                                <div>
                                  <label className="label">Quilómetros</label>
                                  <input type="number" className="input-field" value={editState.quilometros}
                                    onChange={e => setEditState(s => s && ({ ...s, quilometros: e.target.value }))} />
                                </div>
                                <div>
                                  <label className="label">Tipo de Operação</label>
                                  <input className="input-field" value={editState.tipo_operacao}
                                    onChange={e => setEditState(s => s && ({ ...s, tipo_operacao: e.target.value }))} />
                                </div>
                                <div>
                                  <label className="label">Código Concessionário</label>
                                  <input className="input-field" value={editState.codigo_concessao}
                                    onChange={e => setEditState(s => s && ({ ...s, codigo_concessao: e.target.value }))} />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={handleEditSave} className="btn-primary text-xs">Guardar</button>
                                <button onClick={() => setEditState(null)} className="btn-secondary text-xs">Cancelar</button>
                              </div>
                            </td>
                          </tr>
                        )}
                        {deleteConfirm === r.id && (
                          <tr className="bg-gray-100 border-b border-gray-200">
                            <td colSpan={10} className="px-4 py-3">
                              <p className="text-sm text-gray-700 mb-2">Tem a certeza que deseja eliminar este registo?</p>
                              <div className="flex gap-2">
                                <button onClick={() => handleDelete(r.id)} className="btn-primary text-xs">Eliminar</button>
                                <button onClick={() => setDeleteConfirm(null)} className="btn-secondary text-xs">Cancelar</button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 px-5 py-3 border-t border-gray-100">
                  <button onClick={() => doSearch(1)} disabled={page === 1} className="px-2 py-1 text-xs btn-secondary disabled:opacity-40">«</button>
                  <button onClick={() => doSearch(page - 1)} disabled={page === 1} className="px-2 py-1 text-xs btn-secondary disabled:opacity-40">‹</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => doSearch(p)}
                      className={`px-3 py-1 text-xs rounded transition-colors ${p === page ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                    >{p}</button>
                  ))}
                  <button onClick={() => doSearch(page + 1)} disabled={page === totalPages} className="px-2 py-1 text-xs btn-secondary disabled:opacity-40">›</button>
                  <button onClick={() => doSearch(totalPages)} disabled={page === totalPages} className="px-2 py-1 text-xs btn-secondary disabled:opacity-40">»</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {bulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-sm p-6 mx-4">
            <h2 className="text-base font-bold text-brand-dark mb-3">Eliminar registos</h2>
            <p className="text-sm text-gray-600 mb-5">
              Tem a certeza que deseja eliminar <span className="font-semibold">{selectedIds.size}</span> registo{selectedIds.size !== 1 ? 's' : ''}? Esta ação não pode ser revertida.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setBulkDeleteConfirm(false)} className="btn-secondary text-xs">Cancelar</button>
              <button onClick={handleBulkDelete} className="btn-primary text-xs bg-red-600 border-red-600 hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
