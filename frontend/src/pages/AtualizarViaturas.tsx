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

  const handleUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
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
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleUpload(f);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleUpload(f);
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
          Aceita ficheiros <strong>.xlsx</strong> ou <strong>.csv</strong> com as colunas: Matrícula, VIN, Data de Matrícula, Modelo, Marca, Motorização.{' '}
          <button onClick={handleTemplateDownload} className="text-gray-800 hover:underline font-medium">
            Descarregar template aqui
          </button>
        </p>

        <div
          className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${dragOver ? 'border-gray-800 bg-gray-100' : 'border-gray-300 hover:border-gray-600 hover:bg-gray-50'}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={handleFileChange}
          />
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
                onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
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
    </div>
  );
}
