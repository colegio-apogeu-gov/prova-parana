import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { uploadProvaData } from '../../lib/supabase';
import { UploadForm as UploadFormType } from '../../types';
import { parseFileName, downloadLog, UploadLogEntry, ParsedFileName } from '../../lib/bulkUploadUtils';

interface UploadFormProps {
  userProfile: { unidade: string } | null;
}

interface BulkFileEntry {
  file: File;
  parsed: ParsedFileName | null;
  error: string | null;
}

const UploadForm: React.FC<UploadFormProps> = ({ userProfile }) => {
  const [form, setForm] = useState<UploadFormType>({
    ano: '9º ano',
    componente: 'LP',
    semestre: '1',
    unidade: '',
    ano_prova: String(new Date().getFullYear()),
    file: null,
  });
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState<any[]>([]);

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<BulkFileEntry[]>([]);
  const [uploadLog, setUploadLog] = useState<UploadLogEntry[]>([]);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  const UNIDADES_OPCOES = [
    'ANITA CANET C E EF M',
    'ANTONIO TUPY PINHEIRO C E EF M',
    'CARNEIRO C E GAL EF M PROFIS',
    'COSTA VIANA C E EF M PROFIS N',
    'CRISTO REI C E EF M',
    'DECIO DOSSI C E DR EF M PROFIS',
    'FRANCISCO C MARTINS C E EM PROF',
    'GILDO A SCHUCK C E PROF EF M ETI N',
    'GODOFREDO MACHADO E E EF',
    'HOMERO B DE BARROS C E EFM ETI',
    'ISABEL L S SOUZA C E PROFA EF M',
    'IVO LEAO C E EF M',
    'JOAO DE OLIVEIRA FRANCO C E EF M',
    'JOAO MAZZAROTTO C E EF M',
    'LIANE MARTA DA COSTA C E EF M',
    'PAULO FREIRE C E PROF E F M N',
    'SANTO AGOSTINHO C E EF M',
    'TARSILA DO AMARAL C E EF M',
    'TEREZA DA S RAMOS C E PROFA EF M',
    'VICTOR DO AMARAL C E PROF EFM ETI PROFI'
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm({ ...form, file });
      setError('');
      setPreviewData([]);
    }
  };

  const handleBulkFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const entries: BulkFileEntry[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const parsed = parseFileName(file.name);
        entries.push({ file, parsed, error: null });
      } catch (err: any) {
        entries.push({ file, parsed: null, error: err.message });
      }
    }
    setBulkFiles(entries);
    setUploadLog([]);
    setError('');
  };

  const removeBulkFile = (index: number) => {
    setBulkFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const detectAnoEscolarFromData = (worksheet: XLSX.WorkSheet): string => {
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });

    for (let i = 0; i < Math.min(5, data.length); i++) {
      const row = data[i];
      if (row && (row as any[]).length > 0) {
        const rowText = Object.values(row as any).join(' ').toLowerCase();
        if (rowText.includes('3º ano') || rowText.includes('3° ano') || rowText.includes('ensino médio')) {
          return '3º ano';
        }
        if (rowText.includes('6º ano') || rowText.includes('6° ano')) {
          return '6º ano';
        }
        if (rowText.includes('9º ano') || rowText.includes('9° ano') || rowText.includes('ensino fundamental')) {
          return '9º ano';
        }
      }
    }

    return form.ano;
  };

  const detectComponenteFromData = (worksheet: XLSX.WorkSheet): string => {
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    for (let i = 0; i < Math.min(5, data.length); i++) {
      const row = data[i];
      if (row && row.length > 0) {
        const rowText = row.join(' ').toLowerCase();
        if (rowText.includes('matemática') || rowText.includes('matematica') || rowText.includes('mt')) {
          return 'MT';
        }
        if (rowText.includes('língua portuguesa') || rowText.includes('lingua portuguesa') || rowText.includes('lp') || rowText.includes('português')) {
          return 'LP';
        }
      }
    }

    return form.componente;
  };

  const parseHabilidadeValue = (value: any): { acertos: number; total: number; percentual: number } => {
    if (!value || value === '' || value === null || value === undefined) {
      return { acertos: 0, total: 0, percentual: 0 };
    }

    const stringValue = String(value).trim();

    const fractionMatch = stringValue.match(/(\d+)\s*\/\s*(\d+)/);
    if (fractionMatch) {
      const acertos = parseInt(fractionMatch[1]);
      const total = parseInt(fractionMatch[2]);
      const percentual = total > 0 ? Math.min(100, Math.max(0, (acertos / total) * 100)) : 0;
      return { acertos, total, percentual };
    }

    const decimalValue = parseFloat(stringValue);
    if (!isNaN(decimalValue) && decimalValue >= 0 && decimalValue <= 1) {
      return { acertos: Math.round(decimalValue * 100), total: 100, percentual: decimalValue * 100 };
    }

    const percentMatch = stringValue.match(/(\d+(?:\.\d+)?)\s*%/);
    if (percentMatch) {
      const percentual = Math.min(100, Math.max(0, parseFloat(percentMatch[1])));
      return { acertos: Math.round(percentual), total: 100, percentual };
    }

    if (!isNaN(decimalValue)) {
      if (decimalValue <= 100) {
        const percentual = Math.min(100, Math.max(0, decimalValue));
        return { acertos: Math.round(percentual), total: 100, percentual };
      }
    }

    return { acertos: 0, total: 0, percentual: 0 };
  };

  const processExcelData = (worksheet: XLSX.WorkSheet, overrides?: { unidade: string; anoEscolar: string; componente: string; semestre: string; anoProva: string }) => {
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: ""});

    if (data.length < 1) {
      throw new Error('Planilha nao contem dados suficientes');
    }

    const anoEscolar = overrides?.anoEscolar || detectAnoEscolarFromData(worksheet);
    const componente = overrides?.componente || detectComponenteFromData(worksheet);
    const unidade = overrides?.unidade || form.unidade;
    const semestre = overrides?.semestre || form.semestre;
    const anoProva = overrides?.anoProva || form.ano_prova;

    const processedData: any[] = [];

    data.forEach((row: any) => {
      const nomeAluno = String(row['Estudante'] || row['Nome'] || row['ESTUDANTE'] || '').trim();
      const escola = unidade;
      const turma = String(row['Código da Turma'] || row['Turma'] || row['CÓDIGO DA TURMA'] || '').trim();
      const nivelAprendizagem = String(row['Níveis de Aprendizagem'] || row['Nível de Aprendizagem'] || row['Nivel'] || row['NÍVEL DE APRENDIZAGEM'] || row['NÍVEIS DE APRENDIZAGEM'] || '').trim();

      if (!nomeAluno || !escola) return;

      const baseRecord = {
        ano_escolar: anoEscolar,
        componente: componente,
        semestre: semestre,
        unidade: escola,
        turma: turma,
        nome_aluno: nomeAluno,
        nivel_aprendizagem: nivelAprendizagem,
        ano_prova: anoProva,
      };

      Object.keys(row).forEach(columnName => {
        const habilidadeMatch = columnName.match(/^H\s?(\d{1,2})$/i);
        if (!habilidadeMatch) return;

        const habilidadeId = columnName.toUpperCase();
        const habilidadeValue = row[columnName];
        const { acertos, total, percentual } = parseHabilidadeValue(habilidadeValue);

        processedData.push({
          ...baseRecord,
          avaliado: total > 0,
          habilidade_id: habilidadeId,
          habilidade_codigo: "",
          descricao_habilidade: "",
          acertos,
          total,
          percentual
        });
      });
    });

    return processedData;
  };

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
      reader.readAsArrayBuffer(file);
    });
  };

  const processFileToWorksheet = (file: File): Promise<XLSX.WorkSheet> => {
    return new Promise(async (resolve, reject) => {
      try {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const buffer = await readFileAsArrayBuffer(file);
        const data = new Uint8Array(buffer);

        if (ext === 'csv') {
          const text = new TextDecoder('utf-8').decode(data);
          const workbook = XLSX.read(text, { type: 'string' });
          resolve(workbook.Sheets[workbook.SheetNames[0]]);
        } else {
          const workbook = XLSX.read(data, { type: 'array' });
          resolve(workbook.Sheets[workbook.SheetNames[0]]);
        }
      } catch (err: any) {
        reject(err);
      }
    });
  };

  const handlePreview = async () => {
    if (!form.file) {
      setError('Por favor, selecione um arquivo');
      return;
    }

    try {
      const worksheet = await processFileToWorksheet(form.file);
      const processedData = processExcelData(worksheet);
      setPreviewData(processedData.slice(0, 10));
      setError('');
    } catch (error: any) {
      setError(`Erro ao processar arquivo: ${error.message}`);
      setPreviewData([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.file) {
      setError('Por favor, selecione um arquivo');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const worksheet = await processFileToWorksheet(form.file);
      const processedData = processExcelData(worksheet);

      if (processedData.length === 0) {
        throw new Error('Nenhum dado valido encontrado na planilha');
      }

      await uploadProvaData(processedData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      setForm({
        ano: '9º ano',
        componente: 'LP',
        semestre: '1',
        unidade: '',
        ano_prova: String(new Date().getFullYear()),
        file: null,
      });
      setPreviewData([]);

      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error: any) {
      setError(`Erro ao processar dados: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleBulkSubmit = async () => {
    const validFiles = bulkFiles.filter((f) => f.parsed !== null);
    if (validFiles.length === 0) {
      setError('Nenhum arquivo valido para processar');
      return;
    }

    setUploading(true);
    setError('');
    setUploadLog([]);
    setBulkProgress({ current: 0, total: validFiles.length });

    const log: UploadLogEntry[] = [];

    for (let i = 0; i < bulkFiles.length; i++) {
      const entry = bulkFiles[i];
      setBulkProgress({ current: i + 1, total: bulkFiles.length });

      if (!entry.parsed) {
        log.push({
          fileName: entry.file.name,
          status: 'erro',
          unidade: '',
          anoProva: '',
          semestre: '',
          anoEscolar: '',
          componente: '',
          registrosInseridos: 0,
          mensagemErro: entry.error || 'Nome de arquivo invalido',
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      try {
        const worksheet = await processFileToWorksheet(entry.file);
        const processedData = processExcelData(worksheet, {
          unidade: entry.parsed.unidade,
          anoEscolar: entry.parsed.anoEscolar,
          componente: entry.parsed.componente,
          semestre: entry.parsed.semestre,
          anoProva: entry.parsed.anoProva,
        });

        if (processedData.length === 0) {
          throw new Error('Nenhum dado valido encontrado na planilha');
        }

        await uploadProvaData(processedData);

        log.push({
          fileName: entry.file.name,
          status: 'sucesso',
          unidade: entry.parsed.unidade,
          anoProva: entry.parsed.anoProva,
          semestre: entry.parsed.semestre,
          anoEscolar: entry.parsed.anoEscolar,
          componente: entry.parsed.componente,
          registrosInseridos: processedData.length,
          mensagemErro: '',
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        log.push({
          fileName: entry.file.name,
          status: 'erro',
          unidade: entry.parsed.unidade,
          anoProva: entry.parsed.anoProva,
          semestre: entry.parsed.semestre,
          anoEscolar: entry.parsed.anoEscolar,
          componente: entry.parsed.componente,
          registrosInseridos: 0,
          mensagemErro: err.message || 'Erro desconhecido',
          timestamp: new Date().toISOString(),
        });
      }
    }

    setUploadLog(log);
    setBulkProgress(null);
    setUploading(false);

    const sucessos = log.filter((l) => l.status === 'sucesso').length;
    if (sucessos === log.length) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    }
  };

  const successCount = uploadLog.filter((l) => l.status === 'sucesso').length;
  const errorCount = uploadLog.filter((l) => l.status === 'erro').length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Upload className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Upload de Planilhas</h2>
            <p className="text-gray-600">Importe os dados da Prova Parana</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Modo:</span>
          <button
            type="button"
            onClick={() => { setBulkMode(false); setBulkFiles([]); setUploadLog([]); }}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${!bulkMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Individual
          </button>
          <button
            type="button"
            onClick={() => { setBulkMode(true); setPreviewData([]); setError(''); }}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${bulkMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Em Massa
          </button>
        </div>
      </div>

      {!bulkMode ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unidade Escolar
              </label>
              <select
                value={form.unidade}
                onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Selecione a unidade</option>
                {UNIDADES_OPCOES.map((unidade) => (
                  <option key={unidade} value={unidade}>
                    {unidade}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ano Prova
              </label>
              <input
                type="number"
                min="2000"
                max="2100"
                value={form.ano_prova}
                onChange={(e) => setForm({ ...form, ano_prova: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Semestre
              </label>
              <select
                value={form.semestre}
                onChange={(e) => setForm({ ...form, semestre: e.target.value as '1' | '2' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="1">1o Semestre</option>
                <option value="2">2o Semestre</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ano Escolar
              </label>
              <select
                value={form.ano}
                onChange={(e) => setForm({ ...form, ano: e.target.value as '9º ano' | '6º ano' | '3º ano' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              >
                <option value="9º ano">9o ano</option>
                <option value="6º ano">6o ano</option>
                <option value="3º ano">3o ano</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Componente
              </label>
              <select
                value={form.componente}
                onChange={(e) => setForm({ ...form, componente: e.target.value as 'LP' | 'MT' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              >
                <option value="LP">Lingua Portuguesa</option>
                <option value="MT">Matematica</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Arquivo Excel (.xlsx, .xls) ou CSV (.csv)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                Clique para selecionar ou arraste o arquivo aqui
              </p>
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
              >
                Selecionar Arquivo
              </label>
              {form.file && (
                <p className="mt-2 text-sm text-green-600">
                  {form.file.name}
                </p>
              )}
            </div>
          </div>

          {form.file && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handlePreview}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Visualizar Dados
              </button>
            </div>
          )}

          {previewData.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Previa dos Dados (primeiros 10 registros)
              </h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-2 py-1 text-left">Aluno</th>
                      <th className="px-2 py-1 text-left">Turma</th>
                      <th className="px-2 py-1 text-left">Habilidade</th>
                      <th className="px-2 py-1 text-left">Acertos</th>
                      <th className="px-2 py-1 text-left">Total</th>
                      <th className="px-2 py-1 text-left">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, index) => (
                      <tr key={index} className="border-t border-gray-200">
                        <td className="px-2 py-1">{row.nome_aluno}</td>
                        <td className="px-2 py-1">{row.turma}</td>
                        <td className="px-2 py-1">{row.habilidade_id}</td>
                        <td className="px-2 py-1">{row.acertos}</td>
                        <td className="px-2 py-1">{row.total}</td>
                        <td className="px-2 py-1">{row.percentual.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-600">Dados importados com sucesso!</p>
            </div>
          )}

          <button
            type="submit"
            disabled={uploading || !form.file}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? 'Processando...' : 'Importar Dados'}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-1">Formato do nome do arquivo</h4>
            <p className="text-sm text-blue-800">
              NOMEDAESCOLA_ANOPROVA_SEMESTRE_ANOESCOLAR_COMPONENTE
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Exemplo: ANITACANET_2025_1_9ANO_LP.xlsx | PAULOFREIRE_2025_2_3ANO_MT.csv
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecionar Arquivos (.xlsx, .xls, .csv)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                Selecione multiplos arquivos de uma vez
              </p>
              <input
                id="file-upload-bulk"
                type="file"
                accept=".xlsx,.xls,.csv"
                multiple
                onChange={handleBulkFilesChange}
                className="hidden"
              />
              <label
                htmlFor="file-upload-bulk"
                className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
              >
                Selecionar Arquivos
              </label>
            </div>
          </div>

          {bulkFiles.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">
                  Arquivos selecionados ({bulkFiles.length})
                </h4>
                <div className="flex gap-2 text-xs">
                  <span className="text-green-700 bg-green-100 px-2 py-0.5 rounded">
                    {bulkFiles.filter(f => f.parsed).length} validos
                  </span>
                  {bulkFiles.filter(f => f.error).length > 0 && (
                    <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded">
                      {bulkFiles.filter(f => f.error).length} com erro
                    </span>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-gray-100">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Arquivo</th>
                      <th className="px-2 py-1.5 text-left">Escola</th>
                      <th className="px-2 py-1.5 text-left">Ano Prova</th>
                      <th className="px-2 py-1.5 text-left">Sem.</th>
                      <th className="px-2 py-1.5 text-left">Ano Escolar</th>
                      <th className="px-2 py-1.5 text-left">Comp.</th>
                      <th className="px-2 py-1.5 text-left">Status</th>
                      <th className="px-2 py-1.5 text-left"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkFiles.map((entry, index) => (
                      <tr key={index} className={`border-t border-gray-200 ${entry.error ? 'bg-red-50' : ''}`}>
                        <td className="px-2 py-1.5 font-mono text-[11px] max-w-[200px] truncate" title={entry.file.name}>
                          {entry.file.name}
                        </td>
                        <td className="px-2 py-1.5">{entry.parsed?.unidade || '-'}</td>
                        <td className="px-2 py-1.5">{entry.parsed?.anoProva || '-'}</td>
                        <td className="px-2 py-1.5">{entry.parsed?.semestre || '-'}</td>
                        <td className="px-2 py-1.5">{entry.parsed?.anoEscolar || '-'}</td>
                        <td className="px-2 py-1.5">{entry.parsed?.componente || '-'}</td>
                        <td className="px-2 py-1.5">
                          {entry.parsed ? (
                            <span className="text-green-700">OK</span>
                          ) : (
                            <span className="text-red-600" title={entry.error || ''}>{entry.error?.slice(0, 30)}...</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <button type="button" onClick={() => removeBulkFile(index)} className="text-gray-400 hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {bulkProgress && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">Processando...</span>
                <span className="text-sm text-blue-700">{bulkProgress.current} / {bulkProgress.total}</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {uploadLog.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">Resultado do Upload</h4>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2 text-xs">
                    <span className="text-green-700 bg-green-100 px-2 py-0.5 rounded">
                      {successCount} sucesso
                    </span>
                    {errorCount > 0 && (
                      <span className="text-red-700 bg-red-100 px-2 py-0.5 rounded">
                        {errorCount} erro(s)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadLog(uploadLog)}
                    className="flex items-center gap-1 text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar Log
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-gray-100">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Arquivo</th>
                      <th className="px-2 py-1.5 text-left">Status</th>
                      <th className="px-2 py-1.5 text-left">Registros</th>
                      <th className="px-2 py-1.5 text-left">Mensagem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadLog.map((entry, index) => (
                      <tr key={index} className={`border-t border-gray-200 ${entry.status === 'erro' ? 'bg-red-50' : 'bg-green-50'}`}>
                        <td className="px-2 py-1.5 font-mono text-[11px] max-w-[200px] truncate" title={entry.fileName}>
                          {entry.fileName}
                        </td>
                        <td className="px-2 py-1.5">
                          {entry.status === 'sucesso' ? (
                            <span className="text-green-700 font-medium">Sucesso</span>
                          ) : (
                            <span className="text-red-600 font-medium">Erro</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">{entry.registrosInseridos}</td>
                        <td className="px-2 py-1.5 text-red-600 max-w-[300px] truncate" title={entry.mensagemErro}>
                          {entry.mensagemErro}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-600">Todos os arquivos foram importados com sucesso!</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleBulkSubmit}
            disabled={uploading || bulkFiles.length === 0}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? `Processando... (${bulkProgress?.current || 0}/${bulkProgress?.total || 0})` : `Importar ${bulkFiles.filter(f => f.parsed).length} Arquivo(s)`}
          </button>
        </div>
      )}
    </div>
  );
};

export default UploadForm;
