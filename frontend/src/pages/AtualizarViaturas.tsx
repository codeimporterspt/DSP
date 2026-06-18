import React, { useRef, useState, useEffect, useCallback } from 'react';
import Breadcrumb from '../components/Breadcrumb';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface UploadResult {
  inserted: number;
  updated: number;
  errors: string[];
  warnings?: string[];
  metaFilters?: string;
}

interface ImportRecord {
  id: number;
  tipo: string;
  filename: string;
  inserted: number;
  updated: number;
  error_count: number;
  errors: string | null;
  warnings: string | null;
  meta_filters: string | null;
  created_at: string;
}

export default function AtualizarViaturas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Upload modal
  const [uploadModal, setUploadModal] = useState(false);
  const [tipoUpload, setTipoUpload] = useState('Motordata');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // History
  const [history, setHistory] = useState<ImportRecord[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const HISTORY_PAGE_SIZE = 10;

  const loadHistory = useCallback(async (p: number) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/upload/history?page=${p}&limit=${HISTORY_PAGE_SIZE}`);
      const data = await res.json();
      setHistory(data.data ?? []);
      setHistoryTotal(data.total ?? 0);
      setHistoryPage(p);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(1); }, [loadHistory]);

  if (user.role !== 'importador') {
    return (
      <div className="p-6">
        <Breadcrumb />
        <div className="bg-gray-100 border border-gray-300 rounded-lg p-6 text-center">
          <p className="text-gray-800 font-medium">Acesso restrito a importadores.</p>
          <button onClick={() => navigate('/pesquisa')} className="btn-primary mt-3 text-xs">Voltar à Pesquisa</button>
        </div>
      </div>
    );
  }

  const handleUpload = async (file: File, tipo: string) => {
    setUploadModal(false);
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tipo_upload', tipo);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setResult({ inserted: 0, updated: 0, errors: [data.error ?? 'Erro desconhecido'] });
        return;
      }
      setResult(data);
      loadHistory(1);
    } catch {
      setResult({ inserted: 0, updated: 0, errors: ['Erro de rede ao enviar ficheiro'] });
    } finally {
      setUploading(false);
      setSelectedFile(null);
    }
  };

  const openUploadModal = () => {
    setTipoUpload('Motordata');
    setSelectedFile(null);
    setUploadModal(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setSelectedFile(f);
      setTipoUpload('Motordata');
      setUploadModal(true);
    }
  };

  const handleTemplateDownload = async () => {
    const res = await fetch('/api/template');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_viaturas.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <Breadcrumb />
      <h1 className="text-xl font-bold text-brand-dark mb-6">Atualizar Viaturas</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-brand-dark mb-2">Upload de Ficheiro</h2>
        <p className="text-xs text-gray-500 mb-4">
          Aceita exportações <strong>Motordata</strong> (.csv) e ficheiros <strong>Novas Viaturas</strong> (.xlsx).
          Selecione o tipo de upload para ver as opções disponíveis.
        </p>

        <div
          className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${dragOver ? 'border-gray-800 bg-gray-100' : 'border-gray-300 hover:border-gray-600 hover:bg-gray-50'}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={openUploadModal}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-gray-800 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">A processar ficheiro...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="text-3xl text-gray-300">📂</div>
              <p className="text-sm font-medium text-brand-dark">Arraste o ficheiro aqui ou clique para selecionar</p>
              <p className="text-xs text-gray-400">.xlsx ou .csv — máx. 5 MB</p>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); openUploadModal(); }}
                className="btn-primary mt-2"
              >
                Upload de Ficheiro
              </button>
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className={`rounded-lg border p-5 ${result.errors.length > 0 || (result.warnings?.length ?? 0) > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
          <h3 className="font-semibold text-brand-dark mb-3 text-sm">Resultado do Upload</h3>

          {result.metaFilters && (
            <p className="text-xs text-gray-400 mb-3 font-mono truncate" title={result.metaFilters}>
              Filtros: {result.metaFilters}
            </p>
          )}

          <div className="flex gap-6 mb-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{result.inserted}</p>
              <p className="text-xs text-gray-500">Viaturas inseridas</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
              <p className="text-xs text-gray-500">Viaturas atualizadas</p>
            </div>
            {result.errors.length > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-700">{result.errors.length}</p>
                <p className="text-xs text-gray-500">Erros</p>
              </div>
            )}
          </div>

          {(result.warnings?.length ?? 0) > 0 && (
            <div className="bg-orange-50 rounded border border-orange-300 p-3 mb-3">
              <p className="text-xs font-semibold text-orange-700 mb-1">Atenção:</p>
              <ul className="list-disc list-inside space-y-1">
                {result.warnings!.map((w, i) => (
                  <li key={i} className="text-xs text-orange-700">{w}</li>
                ))}
              </ul>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="bg-white rounded border border-gray-300 p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Erros encontrados:</p>
              <ul className="list-disc list-inside space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs text-gray-600">{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Histórico de Importações */}
      <div className="bg-white rounded-lg border border-gray-200 mt-6">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-brand-dark">Histórico de Importações</h2>
          <button onClick={() => loadHistory(historyPage)} className="text-xs text-gray-400 hover:text-brand-dark">↺ Atualizar</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Data / Hora', 'Tipo', 'Ficheiro', 'Inseridas', 'Atualizadas', 'Erros', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-brand-dark uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-xs">A carregar...</td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-xs">Nenhuma importação registada</td></tr>
              ) : history.map(rec => {
                const isExpanded = expandedRow === rec.id;
                const errors: string[]   = rec.errors   ? JSON.parse(rec.errors)   : [];
                const warnings: string[] = rec.warnings ? JSON.parse(rec.warnings) : [];
                const hasDetail = errors.length > 0 || warnings.length > 0;
                const dt = new Date(rec.created_at.replace(' ', 'T'));
                const dateStr = isNaN(dt.getTime()) ? rec.created_at
                  : dt.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    + ' ' + dt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

                return (
                  <React.Fragment key={rec.id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{dateStr}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${rec.tipo === 'Motordata' ? 'bg-gray-100 text-gray-700' : 'bg-blue-50 text-blue-700'}`}>
                          {rec.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-700 max-w-[180px] truncate" title={rec.filename}>{rec.filename}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-green-700">{rec.inserted}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-blue-700">{rec.updated}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-gray-700">{rec.error_count < 0 ? '—' : rec.error_count}</td>
                      <td className="px-4 py-2.5">
                        {hasDetail && (
                          <button
                            onClick={() => setExpandedRow(isExpanded ? null : rec.id)}
                            className="text-xs text-gray-400 hover:text-brand-dark"
                          >
                            {isExpanded ? '▲ Fechar' : '▼ Detalhe'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <td colSpan={7} className="px-6 py-3">
                          {rec.meta_filters && (
                            <p className="text-xs text-gray-400 font-mono mb-2 truncate" title={rec.meta_filters}>Filtros: {rec.meta_filters}</p>
                          )}
                          {warnings.length > 0 && (
                            <div className="mb-2">
                              <p className="text-xs font-semibold text-orange-600 mb-1">Avisos:</p>
                              <ul className="list-disc list-inside space-y-0.5">
                                {warnings.map((w, i) => <li key={i} className="text-xs text-orange-700">{w}</li>)}
                              </ul>
                            </div>
                          )}
                          {errors.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-1">Erros ({errors.length}):</p>
                              <ul className="list-disc list-inside space-y-0.5">
                                {errors.slice(0, 20).map((e, i) => <li key={i} className="text-xs text-gray-600">{e}</li>)}
                                {errors.length > 20 && <li className="text-xs text-gray-400">... e mais {errors.length - 20} erros</li>}
                              </ul>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Paginação */}
        {historyTotal > HISTORY_PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              {(historyPage - 1) * HISTORY_PAGE_SIZE + 1}–{Math.min(historyPage * HISTORY_PAGE_SIZE, historyTotal)} de {historyTotal}
            </p>
            <div className="flex gap-1">
              <button onClick={() => loadHistory(historyPage - 1)} disabled={historyPage === 1} className="px-2 py-1 text-xs btn-secondary disabled:opacity-40">‹</button>
              <button onClick={() => loadHistory(historyPage + 1)} disabled={historyPage * HISTORY_PAGE_SIZE >= historyTotal} className="px-2 py-1 text-xs btn-secondary disabled:opacity-40">›</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Upload */}
      {uploadModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-gray-200 w-full max-w-md p-6 mx-4">
            <h2 className="text-lg font-bold text-brand-dark mb-5">Upload de Ficheiro</h2>

            <div className="space-y-4">
              <div>
                <label className="label">Tipo de Upload <span className="text-red-500">*</span></label>
                <select
                  className="input-field"
                  value={tipoUpload}
                  onChange={e => setTipoUpload(e.target.value)}
                >
                  <option value="Motordata">Motordata</option>
                  <option value="Novas Viaturas">Novas Viaturas</option>
                </select>
              </div>

              <div>
                <label className="label">Ficheiro <span className="text-red-500">*</span></label>
                {tipoUpload === 'Novas Viaturas' && (
                  <p className="text-xs text-gray-500 mb-2">
                    Colunas esperadas: Matrícula, VIN, Data de Matrícula, Modelo, Marca.{' '}
                    <button
                      type="button"
                      onClick={handleTemplateDownload}
                      className="text-gray-800 hover:underline font-medium"
                    >
                      Descarregar template
                    </button>
                  </p>
                )}
                {tipoUpload === 'Motordata' && (
                  <p className="text-xs text-gray-500 mb-2">
                    Exportação direta do Motordata (.csv). Encoding Windows-1252, delimitador ponto e vírgula.
                  </p>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept={tipoUpload === 'Motordata' ? '.csv,.txt' : '.xlsx,.csv'}
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) setSelectedFile(f);
                    e.target.value = '';
                  }}
                />
                <div
                  className="input-field flex items-center justify-between cursor-pointer"
                  onClick={() => fileRef.current?.click()}
                >
                  <span className={selectedFile ? 'text-brand-dark text-sm' : 'text-gray-400 text-sm'}>
                    {selectedFile ? selectedFile.name : tipoUpload === 'Motordata' ? 'Selecionar ficheiro (.csv)' : 'Selecionar ficheiro (.xlsx ou .csv)'}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">Procurar</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setUploadModal(false); setSelectedFile(null); }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={() => { if (selectedFile) handleUpload(selectedFile, tipoUpload); }}
                disabled={!selectedFile}
                className="btn-primary disabled:opacity-40"
              >
                Carregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
