import React, { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '../components/Breadcrumb';

interface TipoOperacao {
  id: number;
  nome: string;
  intervalo_kms: number | null;
  ativo: number;
  ordem: number;
  codigos_associados: number;
  created_at: string;
}

interface Operacao {
  id: number;
  codigo: string;
  tipo_id: number;
  tipo_nome: string;
  ativo: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

type ModalMode = 'create' | 'edit' | 'view';

const PAGE_SIZE = 10;

function formatCodigo(codigo: string): string {
  const match = codigo.match(/^(\d+)\/(\d+)(Anos?)$/i);
  if (!match) return codigo;
  const km = parseInt(match[1], 10).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const anos = parseInt(match[2], 10);
  return `${km} Km / ${anos} ${anos === 1 ? 'Ano' : 'Anos'}`;
}

function getDuracao(codigo: string): string {
  const match = codigo.match(/^(\d+)\/(\d+)(Anos?)$/i);
  if (!match) return '-';
  const anos = parseInt(match[2], 10);
  return `${anos} ${anos === 1 ? 'Ano' : 'Anos'}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function BackofficeOperacoes() {
  const [rows, setRows] = useState<Operacao[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tipos, setTipos] = useState<TipoOperacao[]>([]);

  // Operação modal
  const [opModal, setOpModal] = useState<{ open: boolean; mode: ModalMode; data: Operacao | null }>({
    open: false, mode: 'create', data: null,
  });
  const [opForm, setOpForm] = useState({ codigo: '', tipo_id: '', ativo: true, observacoes: '' });
  const [opErrors, setOpErrors] = useState<Record<string, string>>({});
  const [opSaving, setOpSaving] = useState(false);

  // Tipos modal
  const [tiposModal, setTiposModal] = useState(false);
  const [tipoEditId, setTipoEditId] = useState<number | null>(null);
  const [tipoEditNome, setTipoEditNome] = useState('');
  const [tipoEditIntervalo, setTipoEditIntervalo] = useState('');
  const [tipoEditAtivo, setTipoEditAtivo] = useState(true);
  const [tipoEditOrdem, setTipoEditOrdem] = useState('1');
  const [showNewTipo, setShowNewTipo] = useState(false);
  const [newTipoNome, setNewTipoNome] = useState('');
  const [newTipoIntervalo, setNewTipoIntervalo] = useState('');
  const [newTipoAtivo, setNewTipoAtivo] = useState(true);
  const [newTipoOrdem, setNewTipoOrdem] = useState('1');

  // Delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadOperacoes = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/operacoes?page=${p}&limit=${PAGE_SIZE}`);
      const data = await res.json();
      setRows(data.data ?? []);
      setTotal(data.total ?? 0);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTipos = useCallback(async (): Promise<TipoOperacao[]> => {
    const res = await fetch('/api/tipos-operacao');
    const data: TipoOperacao[] = await res.json();
    setTipos(data);
    return data;
  }, []);

  useEffect(() => {
    loadOperacoes(1);
    loadTipos();
  }, [loadOperacoes, loadTipos]);

  // --- Operação modal helpers ---
  const openCreateModal = async () => {
    const freshTipos = await loadTipos();
    setOpForm({ codigo: '', tipo_id: freshTipos[0] ? String(freshTipos[0].id) : '', ativo: true, observacoes: '' });
    setOpErrors({});
    setOpModal({ open: true, mode: 'create', data: null });
  };

  const openEditModal = (op: Operacao) => {
    setOpForm({ codigo: op.codigo, tipo_id: String(op.tipo_id), ativo: op.ativo === 1, observacoes: op.observacoes ?? '' });
    setOpErrors({});
    setOpModal({ open: true, mode: 'edit', data: op });
  };

  const openViewModal = (op: Operacao) => {
    setOpForm({ codigo: op.codigo, tipo_id: String(op.tipo_id), ativo: op.ativo === 1, observacoes: op.observacoes ?? '' });
    setOpErrors({});
    setOpModal({ open: true, mode: 'view', data: op });
  };

  const closeOpModal = () => setOpModal({ open: false, mode: 'create', data: null });

  const handleOpSave = async () => {
    const errors: Record<string, string> = {};
    if (!opForm.codigo.trim()) errors.codigo = 'Campo obrigatório';
    if (!opForm.tipo_id) errors.tipo_id = 'Campo obrigatório';
    setOpErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setOpSaving(true);
    try {
      const body = {
        codigo: opForm.codigo.trim(),
        tipo_id: parseInt(opForm.tipo_id, 10),
        ativo: opForm.ativo,
        observacoes: opForm.observacoes.trim() || null,
      };
      const url = opModal.mode === 'edit' ? `/api/operacoes/${opModal.data!.id}` : '/api/operacoes';
      const method = opModal.mode === 'edit' ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        closeOpModal();
        loadOperacoes(page);
      } else {
        const err = await res.json();
        setOpErrors({ submit: err.error ?? 'Erro ao guardar' });
      }
    } finally {
      setOpSaving(false);
    }
  };

  // --- Delete ---
  const handleDelete = async () => {
    if (deleteId === null) return;
    await fetch(`/api/operacoes/${deleteId}`, { method: 'DELETE' });
    setDeleteId(null);
    const newPage = rows.length === 1 && page > 1 ? page - 1 : page;
    loadOperacoes(newPage);
  };

  // --- Tipos helpers ---
  const handleTipoCreate = async () => {
    if (!newTipoNome.trim()) return;
    const res = await fetch('/api/tipos-operacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: newTipoNome.trim(),
        intervalo_kms: newTipoIntervalo ? parseInt(newTipoIntervalo, 10) : null,
        ativo: newTipoAtivo,
        ordem: newTipoOrdem ? parseInt(newTipoOrdem, 10) : 1,
      }),
    });
    if (!res.ok) { const e = await res.json(); alert(e.error); return; }
    setNewTipoNome('');
    setNewTipoIntervalo('');
    setNewTipoAtivo(true);
    setNewTipoOrdem('1');
    setShowNewTipo(false);
    loadTipos();
  };

  const handleTipoEditSave = async (id: number) => {
    if (!tipoEditNome.trim()) return;
    const res = await fetch(`/api/tipos-operacao/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: tipoEditNome.trim(),
        intervalo_kms: tipoEditIntervalo ? parseInt(tipoEditIntervalo, 10) : null,
        ativo: tipoEditAtivo,
        ordem: tipoEditOrdem ? parseInt(tipoEditOrdem, 10) : 1,
      }),
    });
    if (!res.ok) { const e = await res.json(); alert(e.error); return; }
    setTipoEditId(null);
    loadTipos();
  };

  const handleTipoDelete = async (id: number) => {
    if (!confirm('Tem a certeza que deseja eliminar este tipo? Esta acção não pode ser revertida.')) return;
    const res = await fetch(`/api/tipos-operacao/${id}`, { method: 'DELETE' });
    if (!res.ok) { const e = await res.json(); alert(e.error); return; }
    loadTipos();
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const fromRecord = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toRecord = Math.min(page * PAGE_SIZE, total);
  const viewOnly = opModal.mode === 'view';

  return (
    <div className="p-6">
      <Breadcrumb items={[
        { label: 'DSP BYD' },
        { label: 'Backoffice' },
        { label: 'Gestão de Operações' },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-brand-dark">Gestão de Operações</h1>
        <div className="flex gap-2">
          <button onClick={() => setTiposModal(true)} className="btn-secondary">Gestão de Tipos</button>
          <button onClick={openCreateModal} className="btn-primary">Nova Operação</button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Código', 'Tipo de Operação', 'Ativo', 'Observações', 'Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-brand-dark uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">A carregar...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">Nenhuma operação encontrada</td>
                </tr>
              ) : rows.map((row, i) => (
                <tr key={row.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-[#f9f9f9]'}`}>
                  <td className="px-4 py-3 font-medium">{formatCodigo(row.codigo)}</td>
                  <td className="px-4 py-3 text-xs">{row.tipo_nome ?? '-'}</td>
                  <td className="px-4 py-3">
                    {row.ativo === 1
                      ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#666', color: '#fff' }}>Sim</span>
                      : <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#ddd', color: '#666' }}>Não</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{row.observacoes ?? '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button title="Ver" onClick={() => openViewModal(row)} className="text-gray-500 hover:text-brand-dark text-base">👁</button>
                      <button title="Editar" onClick={() => openEditModal(row)} className="text-gray-500 hover:text-brand-dark text-base">✏</button>
                      <button title="Eliminar" onClick={() => setDeleteId(row.id)} className="text-gray-500 hover:text-black text-base">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Mostrando{' '}
            <span className="font-semibold text-brand-dark">{fromRecord}</span>
            {' '}a{' '}
            <span className="font-semibold text-brand-dark">{toRecord}</span>
            {' '}de{' '}
            <span className="font-semibold text-brand-dark">{total}</span>
            {' '}registos
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => loadOperacoes(1)} disabled={page === 1} className="px-2 py-1 text-xs btn-secondary disabled:opacity-40">«</button>
              <button onClick={() => loadOperacoes(page - 1)} disabled={page === 1} className="px-2 py-1 text-xs btn-secondary disabled:opacity-40">‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => loadOperacoes(p)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${p === page ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >{p}</button>
              ))}
              <button onClick={() => loadOperacoes(page + 1)} disabled={page === totalPages} className="px-2 py-1 text-xs btn-secondary disabled:opacity-40">›</button>
              <button onClick={() => loadOperacoes(totalPages)} disabled={page === totalPages} className="px-2 py-1 text-xs btn-secondary disabled:opacity-40">»</button>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Nova / Editar / Ver Operação */}
      {opModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md p-6 mx-4">
            <h2 className="text-lg font-bold text-brand-dark mb-5">
              {viewOnly ? 'Detalhe da Operação' : opModal.mode === 'edit' ? 'Editar Operação' : 'Nova Operação'}
            </h2>

            {viewOnly && opModal.data ? (
              <dl className="divide-y divide-gray-100">
                {([
                  ['Código', formatCodigo(opModal.data.codigo)],
                  ['Observações', opModal.data.observacoes ?? '-'],
                  ['Tipo', opModal.data.tipo_nome ?? '-'],
                  ['Status', opModal.data.ativo === 1 ? 'Ativo' : 'Inativo'],
                  ['Duração', getDuracao(opModal.data.codigo)],
                  ['Data de criação', formatDate(opModal.data.created_at)],
                  ['Última atualização', formatDate(opModal.data.updated_at)],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="py-2.5 flex gap-4">
                    <dt className="w-40 shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide pt-0.5">{label}</dt>
                    <dd className="text-sm text-brand-dark">
                      {label === 'Status' ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                          style={opModal.data.ativo === 1 ? { background: '#666', color: '#fff' } : { background: '#ddd', color: '#666' }}>
                          {value}
                        </span>
                      ) : value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="label">Código <span className="text-red-500">*</span></label>
                  <input
                    className="input-field"
                    value={opForm.codigo}
                    onChange={e => setOpForm(f => ({ ...f, codigo: e.target.value }))}
                  />
                  {opErrors.codigo && <p className="text-red-500 text-xs mt-1">{opErrors.codigo}</p>}
                </div>

                <div>
                  <label className="label">Tipo de Operação <span className="text-red-500">*</span></label>
                  <select
                    className="input-field"
                    value={opForm.tipo_id}
                    onChange={e => setOpForm(f => ({ ...f, tipo_id: e.target.value }))}
                  >
                    <option value="">Selecionar...</option>
                    {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  {opErrors.tipo_id && <p className="text-red-500 text-xs mt-1">{opErrors.tipo_id}</p>}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="op-ativo"
                    checked={opForm.ativo}
                    onChange={e => setOpForm(f => ({ ...f, ativo: e.target.checked }))}
                    className="w-4 h-4 accent-brand-primary"
                  />
                  <label htmlFor="op-ativo" className="text-sm text-brand-dark font-medium">Ativo</label>
                </div>

                <div>
                  <label className="label">Observações</label>
                  <textarea
                    className="input-field resize-none"
                    rows={3}
                    value={opForm.observacoes}
                    onChange={e => setOpForm(f => ({ ...f, observacoes: e.target.value }))}
                  />
                </div>

                {opErrors.submit && <p className="text-red-500 text-xs">{opErrors.submit}</p>}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={closeOpModal} className="btn-secondary">
                {viewOnly ? 'Fechar' : 'Cancelar'}
              </button>
              {!viewOnly && (
                <button onClick={handleOpSave} disabled={opSaving} className="btn-primary">
                  {opSaving ? 'A guardar...' : 'Guardar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar eliminação de operação */}
      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-sm p-6 mx-4">
            <p className="text-sm text-gray-700 mb-6">
              Tem a certeza que deseja eliminar esta operação? Esta acção não pode ser revertida.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="btn-secondary">Cancelar</button>
              <button
                onClick={handleDelete}
                className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Gestão de Tipos */}
      {tiposModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-6xl p-6 mx-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-brand-dark">Gestão de Tipos</h2>
              <button onClick={() => { setShowNewTipo(true); setNewTipoNome(''); setNewTipoIntervalo(''); setNewTipoAtivo(true); setNewTipoOrdem('1'); }} className="btn-primary text-xs">
                Novo Tipo
              </button>
            </div>

            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Intervalo (kms)', 'Label', 'Ativo', 'Ordem', 'Códigos Associados', 'Ações'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-brand-dark uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tipos.map((t, i) => (
                    <tr key={t.id} className="border-b border-gray-100">
                      {tipoEditId === t.id ? (
                        <>
                          <td className="px-3 py-2">
                            <input
                              className="input-field text-xs py-1 w-24"
                              type="number"
                              placeholder="ex: 15000"
                              value={tipoEditIntervalo}
                              onChange={e => setTipoEditIntervalo(e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="input-field text-xs py-1 w-24"
                              placeholder="ex: HEV"
                              value={tipoEditNome}
                              onChange={e => setTipoEditNome(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleTipoEditSave(t.id)}
                              autoFocus
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={tipoEditAtivo} onChange={e => setTipoEditAtivo(e.target.checked)} className="w-4 h-4 accent-brand-primary" />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="input-field text-xs py-1 w-16"
                              type="number"
                              min={1}
                              placeholder="ex: 1"
                              value={tipoEditOrdem}
                              onChange={e => setTipoEditOrdem(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleTipoEditSave(t.id)}
                            />
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-400">{t.codigos_associados}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button onClick={() => handleTipoEditSave(t.id)} className="btn-primary text-xs px-2 py-1">✓</button>
                              <button onClick={() => setTipoEditId(null)} className="btn-secondary text-xs px-2 py-1">✕</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-xs">{t.intervalo_kms != null ? t.intervalo_kms.toLocaleString('pt-PT') : '-'}</td>
                          <td className="px-3 py-2 text-sm font-medium">{t.nome}</td>
                          <td className="px-3 py-2">
                            {t.ativo === 1
                              ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#666', color: '#fff' }}>Sim</span>
                              : <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: '#ddd', color: '#666' }}>Não</span>
                            }
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">{t.ordem}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{t.codigos_associados}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-2">
                              <button
                                title="Editar"
                                onClick={() => { setTipoEditId(t.id); setTipoEditNome(t.nome); setTipoEditIntervalo(t.intervalo_kms != null ? String(t.intervalo_kms) : ''); setTipoEditAtivo(t.ativo === 1); setTipoEditOrdem(String(t.ordem ?? 1)); }}
                                className="text-gray-500 hover:text-brand-dark text-base"
                              >✏</button>
                              <button
                                title="Eliminar"
                                onClick={() => handleTipoDelete(t.id)}
                                className="text-gray-500 hover:text-black text-base"
                              >🗑</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}

                  {showNewTipo && (
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <td className="px-3 py-2">
                        <input
                          className="input-field text-xs py-1 w-24"
                          type="number"
                          placeholder="ex: 15000"
                          value={newTipoIntervalo}
                          onChange={e => setNewTipoIntervalo(e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="input-field text-xs py-1 w-24"
                          placeholder="ex: HEV"
                          value={newTipoNome}
                          onChange={e => setNewTipoNome(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleTipoCreate()}
                          autoFocus
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={newTipoAtivo} onChange={e => setNewTipoAtivo(e.target.checked)} className="w-4 h-4 accent-brand-primary" />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="input-field text-xs py-1 w-16"
                          type="number"
                          min={1}
                          placeholder="ex: 1"
                          value={newTipoOrdem}
                          onChange={e => setNewTipoOrdem(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleTipoCreate()}
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">—</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button onClick={handleTipoCreate} className="btn-primary text-xs px-2 py-1">✓</button>
                          <button onClick={() => { setShowNewTipo(false); setNewTipoNome(''); setNewTipoIntervalo(''); setNewTipoAtivo(true); }} className="btn-secondary text-xs px-2 py-1">✕</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button onClick={() => { setTiposModal(false); setTipoEditId(null); setShowNewTipo(false); setNewTipoNome(''); setNewTipoIntervalo(''); setNewTipoAtivo(true); }} className="btn-secondary">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
