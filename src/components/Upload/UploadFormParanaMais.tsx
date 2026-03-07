import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { uploadProvaDataMais } from '../../lib/supabaseParanaMais';
import { UploadForm as UploadFormType, HABILIDADES_3_ANO, HABILIDADES_9_ANO } from '../../types';

interface UploadFormParanaMaisProps {
  userProfile: { unidade: string } | null;
}

const UploadFormParanaMais: React.FC<UploadFormParanaMaisProps> = ({ userProfile }) => {
  const [form, setForm] = useState<UploadFormType>({
    ano: 'EF',
    componente: 'LP',
    semestre: '1',
    unidade: '',
    file: null,
  });
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState<any[]>([]);

  const UNIDADES_OPCOES = [
    'ANITA CANET C E EF M',
    'ANTONIO TUPY PINHEIRO C E EF M',
    'COSTA VIANA C E EF M PROFIS N',
    'CRISTO REI C E EF M',
    'DECIO DOSSI C E DR EF M PROFIS',
    'FRANCISCO C MARTINS C E EM PROF',
    'GODOFREDO MACHADO E E EF',
    'ISABEL L S SOUZA C E PROFA EF M',
    'IVO LEAO C E EF M',
    'JOAO DE OLIVEIRA FRANCO C E EF M',
    'JOAO MAZZAROTTO C E EF M',
    'LIANE MARTA DA COSTA C E EF M',
    'PAULO FREIRE C E PROF E F M N',
    'SANTO AGOSTINHO C E EF M',
    'TARSILA DO AMARAL C E EF M',
    'TEREZA DA S RAMOS C E PROFA EF M'
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setForm({ ...form, file });
      setError('');
      setPreviewData([]);
    }
  };

  const detectAnoEscolarFromData = (worksheet: XLSX.WorkSheet): string => {
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });

    for (let i = 0; i < Math.min(5, data.length); i++) {
      const row = data[i];
      if (row && row.length > 0) {
        const rowText = row.join(' ').toLowerCase();
        if (rowText.includes('3º ano') || rowText.includes('3° ano') || rowText.includes('ensino médio')) {
          return '3º ano';
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

  const findHeaderRow = (data: any[][]): number => {
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (row && row.length > 0) {
        const rowText = row.join('|').toLowerCase();
        if ((rowText.includes('estudante') || rowText.includes('aluno') || rowText.includes('nome')) &&
            (rowText.includes('escola') || rowText.includes('turma')) &&
            (rowText.includes('h01') || rowText.includes('h1'))) {
          return i;
        }
      }
    }
    return 3;
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

  const getHabilidadeInfo = (habilidadeId: string, anoEscolar: string, componente: string) => {
    const habilidades = anoEscolar === '3º ano' ? HABILIDADES_3_ANO : HABILIDADES_9_ANO;
    const componenteHabilidades = habilidades[componente as 'LP' | 'MT'];

    if (componenteHabilidades && componenteHabilidades[habilidadeId as keyof typeof componenteHabilidades]) {
      const info = componenteHabilidades[habilidadeId as keyof typeof componenteHabilidades];
      return {
        codigo: info.codigo,
        descricao: info.descricao
      };
    }

    return {
      codigo: `${habilidadeId}_${componente}`,
      descricao: `Habilidade ${habilidadeId} - ${componente}`
    };
  };

  const processExcelData = (worksheet: XLSX.WorkSheet) => {
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: ""});

    if (data.length < 1) {
      throw new Error('Planilha não contém dados suficientes');
    }

    const anoEscolar = detectAnoEscolarFromData(worksheet);
    const componente = detectComponenteFromData(worksheet);

    const processedData: any[] = [];

    data.forEach((row: any) => {
      const nomeAluno = String(row['Estudante'] || row['Nome'] || row['ESTUDANTE'] || '').trim();
      const escola = form.unidade;
      const turma = String(row['Código da Turma'] || row['Turma'] || row['CÓDIGO DA TURMA'] || '').trim();
      const nivelAprendizagem = String(row['Níveis de Aprendizagem'] || row['Nível de Aprendizagem'] || row['Nivel'] || row['NÍVEL DE APRENDIZAGEM'] || row['NÍVEIS DE APRENDIZAGEM'] || '').trim();

      if (!nomeAluno || !escola) return;

      const baseRecord = {
        ano_escolar: anoEscolar,
        componente: componente,
        semestre: form.semestre,
        unidade: escola,
        turma: turma,
        nome_aluno: nomeAluno,
        nivel_aprendizagem: nivelAprendizagem,
      };

      Object.keys(row).forEach(columnName => {
        const habilidadeMatch = columnName.match(/^H\s?(\d{1,2})$/i);
        if (!habilidadeMatch) return;

        const habilidadeId = columnName.toUpperCase();
        const habilidadeValue = row[columnName];
        const { acertos, total, percentual } = parseHabilidadeValue(habilidadeValue);
        const habilidadeInfo = getHabilidadeInfo(habilidadeId, anoEscolar, componente);

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

  const handlePreview = async () => {
    if (!form.file) {
      setError('Por favor, selecione um arquivo');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];

          const processedData = processExcelData(worksheet);
          setPreviewData(processedData.slice(0, 10));
          setError('');
        } catch (error: any) {
          setError(`Erro ao processar arquivo: ${error.message}`);
          setPreviewData([]);
        }
      };

      reader.readAsArrayBuffer(form.file);
    } catch (error: any) {
      setError(`Erro ao ler arquivo: ${error.message}`);
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
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];

          const processedData = processExcelData(worksheet);

          if (processedData.length === 0) {
            throw new Error('Nenhum dado válido encontrado na planilha');
          }

          await uploadProvaDataMais(processedData);
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);

          setForm({
            ano: 'EF',
            componente: 'LP',
            semestre: '1',
            unidade: '',
            file: null,
          });
          setPreviewData([]);

          const fileInput = document.getElementById('file-upload-mais') as HTMLInputElement;
          if (fileInput) fileInput.value = '';

        } catch (error: any) {
          setError(`Erro ao processar dados: ${error.message}`);
        } finally {
          setUploading(false);
        }
      };

      reader.readAsArrayBuffer(form.file);
    } catch (error: any) {
      setError(`Erro ao ler arquivo: ${error.message}`);
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-orange-100 p-2 rounded-lg">
          <Upload className="w-6 h-6 text-orange-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Upload de Planilhas</h2>
          <p className="text-gray-600">Importe os dados do Paraná Mais</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unidade Escolar
            </label>
            <select
              value={form.unidade}
              onChange={(e) => setForm({ ...form, unidade: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
              Semestre
            </label>
            <select
              value={form.semestre}
              onChange={(e) => setForm({ ...form, semestre: e.target.value as '1' | '2' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="1">1º Semestre</option>
              <option value="2">2º Semestre</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ano Escolar
            </label>
            <select
              value={form.ano}
              onChange={(e) => setForm({ ...form, ano: e.target.value as 'EF' | 'EM' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
            >
              <option value="EF">EF</option>
              <option value="EM">EM</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Componente
            </label>
            <select
              value={form.componente}
              onChange={(e) => setForm({ ...form, componente: e.target.value as 'LP' | 'MT' | 'CH' | 'CN' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-50"
            >
              <option value="LP">Língua Portuguesa</option>
              <option value="MT">Matemática</option>
              <option value="CH">Ciências Humanas</option>
              <option value="CN">Ciências Naturais</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Arquivo Excel (.xlsx)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-orange-400 transition-colors">
            <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">
              Clique para selecionar ou arraste o arquivo aqui
            </p>
            <input
              id="file-upload-mais"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="file-upload-mais"
              className="bg-orange-50 text-orange-600 px-4 py-2 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors"
            >
              Selecionar Arquivo
            </label>
            {form.file && (
              <p className="mt-2 text-sm text-green-600">
                ✓ {form.file.name}
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
              Prévia dos Dados (primeiros 10 registros)
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
          className="w-full bg-orange-600 text-white py-3 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? 'Processando...' : 'Importar Dados'}
        </button>
      </form>
    </div>
  );
};

export default UploadFormParanaMais;
