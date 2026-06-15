import React, { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '../components/Breadcrumb';

interface TipoOperacao {
  id: number;
  nome: string;
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
  const [showNewTipo, setShowNewTipo] = useState(false);
  const [newTipoNome, setNewTipoNome] = useState('');

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

  const loadTipos = useCallback(async () => {
    const res = await fetch('/api/tipos-operacao');
    setTipos(await res.json());
  }, []);

  useEffect(() => {
    loadOperacoes(1);
    loadTipos();
  }, [loadOperacoes, loadTipos]);

  // --- Operação modal helpers ---
  const openCreateModal = () => {
    setOpForm({ codigo: '', tipo_id: tipos[0] ? String(tipos[0].id) : '', ativo: true, observacoes: '' });
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
      body: JSON.stringify({ nome: newTipoNome.trim() }),
    });
    if (!res.ok) { const e = await res.json(); alert(e.error); return; }
    setNewTipoNome('');
    setShowNewTipo(false);
    loadTipos();
  };

  const handleTipoEditSave = async (id: number) => {
    if (!tipoEditNome.trim()) return;
    const res = await fetch(`/api/tipos-operacao/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: tipoEditNome.trim() }),
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
                  <td className="px-4 py-3 font-medium">{row.codigo}</td>
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

            <div className="space-y-4">
              <div>
                <label className="label">Código {!viewOnly && <span className="text-red-500">*</span>}</label>
                <input
                  className="input-field"
                  value={opForm.codigo}
                  onChange={e => setOpForm(f => ({ ...f, codigo: e.target.value }))}
                  disabled={viewOnly}
                />
                {opErrors.codigo && <p className="text-red-500 text-xs mt-1">{opErrors.codigo}</p>}
              </div>

              <div>
                <label className="label">Tipo de Operação {!viewOnly && <span className="text-red-500">*</span>}</label>
                {viewOnly ? (
                  <input className="input-field" value={tipos.find(t => t.id === parseInt(opForm.tipo_id))?.nome ?? opForm.tipo_id} disabled />
                ) : (
                  <select
                    className="input-field"
                    value={opForm.tipo_id}
                    onChange={e => setOpForm(f => ({ ...f, tipo_id: e.target.value }))}
                  >
                    <option value="">Selecionar...</option>
                    {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                )}
                {opErrors.tipo_id && <p className="text-red-500 text-xs mt-1">{opErrors.tipo_id}</p>}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="op-ativo"
                  checked={opForm.ativo}
                  onChange={e => setOpForm(f => ({ ...f, ativo: e.target.checked }))}
                  disabled={viewOnly}
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
                  disabled={viewOnly}
                />
              </div>

              {opErrors.submit && <p className="text-red-500 text-xs">{opErrors.submit}</p>}
            </div>

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
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-lg p-6 mx-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-brand-dark">Gestão de Tipos</h2>
              <button onClick={() => { setShowNewTipo(true); setNewTipoNome(''); }} className="btn-primary text-xs">
                Novo Tipo
              </button>
            </div>

            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-brand-dark uppercase w-12">ID</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-brand-dark uppercase">Nome</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-brand-dark uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {tipos.map(t => (
                    <tr key={t.id} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-xs text-gray-400">{t.id}</td>
                      <td className="px-3 py-2">
                        {tipoEditId === t.id ? (
                          <div className="flex gap-1 items-center">
                            <input
                              className="input-field text-xs py-1"
                              value={tipoEditNome}
                              onChange={e => setTipoEditNome(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleTipoEditSave(t.id)}
                              autoFocus
                            />
                            <button onClick={() => handleTipoEditSave(t.id)} className="btn-primary text-xs px-2 py-1">✓</button>
                            <button onClick={() => setTipoEditId(null)} className="btn-secondary text-xs px-2 py-1">✕</button>
                          </div>
                        ) : (
                          <span className="text-sm">{t.nome}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            title="Editar"
                            onClick={() => { setTipoEditId(t.id); setTipoEditNome(t.nome); }}
                            className="text-gray-500 hover:text-brand-dark text-base"
                          >✏</button>
                          <button
                            title="Eliminar"
                            onClick={() => handleTipoDelete(t.id)}
                            className="text-gray-500 hover:text-black text-base"
                          >🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {showNewTipo && (
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-400">—</td>
                      <td className="px-3 py-2">
                        <input
                          className="input-field text-xs py-1"
                          placeholder="Nome do tipo..."
                          value={newTipoNome}
                          onChange={e => setNewTipoNome(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleTipoCreate()}
                          autoFocus
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button onClick={handleTipoCreate} className="btn-primary text-xs px-2 py-1">✓</button>
                          <button onClick={() => { setShowNewTipo(false); setNewTipoNome(''); }} className="btn-secondary text-xs px-2 py-1">✕</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button onClick={() => { setTiposModal(false); setTipoEditId(null); setShowNewTipo(false); }} className="btn-secondary">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
