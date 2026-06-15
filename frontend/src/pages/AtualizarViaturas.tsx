import React, { useRef, useState } from 'react';
import Breadcrumb from '../components/Breadcrumb';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface UploadResult {
  inserted: number;
  updated: number;
  errors: string[];
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
          Aceita ficheiros <strong>.xlsx</strong> ou <strong>.csv</strong> com as colunas: Matrícula, VIN, Data de Matrícula, Modelo, Marca.{' '}
          <button onClick={handleTemplateDownload} className="text-gray-800 hover:underline font-medium">
            Descarregar template aqui
          </button>
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
        <div className={`rounded-lg border p-5 ${result.errors.length === 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <h3 className="font-semibold text-brand-dark mb-3 text-sm">Resultado do Upload</h3>
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
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.csv"
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
                    {selectedFile ? selectedFile.name : 'Selecionar ficheiro (.xlsx ou .csv)'}
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
