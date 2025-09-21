import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { uploadProvaDataParceiro } from '../../lib/supabaseParceiro';
import { UploadFormParceiro as UploadFormParceiroType } from '../../types';

interface UploadFormParceiroProps {
  userProfile: { unidade: string } | null;
}

const UploadFormParceiro: React.FC<UploadFormParceiroProps> = ({ userProfile }) => {
  const [form, setForm] = useState<UploadFormParceiroType>({
    ano: '8º ano',
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
        if (rowText.includes('2º ano') || rowText.includes('2° ano') || rowText.includes('ensino médio')) {
          return '2º ano';
        }
        if (rowText.includes('8º ano') || rowText.includes('8° ano') || rowText.includes('ensino fundamental')) {
          return '8º ano';
        }
      }
    }
    
    return form.ano; // Fallback para o valor selecionado no formulário
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
    
    return form.componente; // Fallback para o valor selecionado no formulário
  };

  const parseHabilidadeValue = (value: any): { acertos: number; total: number; percentual: number } => {
    if (!value || value === '' || value === null || value === undefined) {
      return { acertos: 0, total: 0, percentual: 0 };
    }

    const stringValue = String(value).trim();
    
    // Formato "acertos / total" ou "acertos/total"
    const fractionMatch = stringValue.match(/(\d+)\s*\/\s*(\d+)/);
    if (fractionMatch) {
      const acertos = parseInt(fractionMatch[1]);
      const total = parseInt(fractionMatch[2]);
      const percentual = total > 0 ? Math.min(100, Math.max(0, (acertos / total) * 100)) : 0;
      return { acertos, total, percentual };
    }

    // Formato decimal (0.75 = 75%)
    const decimalValue = parseFloat(stringValue);
    if (!isNaN(decimalValue) && decimalValue >= 0 && decimalValue <= 1) {
      return { acertos: Math.round(decimalValue * 100), total: 100, percentual: decimalValue * 100 };
    }

    // Formato percentual (75% = 75)
    const percentMatch = stringValue.match(/(\d+(?:\.\d+)?)\s*%/);
    if (percentMatch) {
      const percentual = Math.min(100, Math.max(0, parseFloat(percentMatch[1])));
      return { acertos: Math.round(percentual), total: 100, percentual };
    }

    // Valor numérico simples (assume que é percentual se <= 100, senão é acertos de 100)
    if (!isNaN(decimalValue)) {
      if (decimalValue <= 100) {
        const percentual = Math.min(100, Math.max(0, decimalValue));
        return { acertos: Math.round(percentual), total: 100, percentual };
      }
    }

    return { acertos: 0, total: 0, percentual: 0 };
  };

  const processExcelData = (worksheet: XLSX.WorkSheet) => {
    // Lê os dados como objetos, pulando as 2 primeiras linhas e preenchendo células vazias
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: ""});
    
    if (data.length < 1) {
      throw new Error('Planilha não contém dados suficientes');
    }

    // Detecta automaticamente ano escolar e componente das primeiras linhas
    const anoEscolar = detectAnoEscolarFromData(worksheet);
    const componente = detectComponenteFromData(worksheet);

    const processedData: any[] = [];
    
    // Processa cada linha de dados
    data.forEach((row: any) => {
      // Identifica as colunas principais
      const nomeAluno = String(row['Estudante'] || row['Nome'] || row['ESTUDANTE'] || '').trim();
      const escola = form.unidade; // Usa o valor selecionado no formulário
      const turma = String(row['Código da Turma'] || row['Turma'] || row['CÓDIGO DA TURMA'] || '').trim();
      const padraoDesempenho = String(row['Padrão de Desempenho'] || row['PADRÃO DE DESEMPENHO'] || '').trim();
      const proficiencia = String(row['Proficiência'] || row['PROFICIÊNCIA'] || '').trim();
      
      // Pula linhas sem nome de aluno ou escola
      if (!nomeAluno || !escola) return;
      
      // Dados base para todas as habilidades deste aluno
      const baseRecord = {
        ano_escolar: anoEscolar,
        componente: componente,
        semestre: form.semestre,
        unidade: escola,
        turma: turma,
        nome_aluno: nomeAluno,
        padrao_desempenho: padraoDesempenho,
        proficiencia: proficiencia,
        ano_escolar_resultados: anoEscolar,
      };

      // Determina o número máximo de habilidades baseado no componente
      const maxHabilidades = componente === 'LP' ? 13 : 22;

      // Identifica e processa todas as colunas de habilidades (H01, H02, etc.)
      for (let i = 1; i <= maxHabilidades; i++) {
        const habilidadeId = `H${i.toString().padStart(2, '0')}`;
        const columnName = `H ${i.toString().padStart(2, '0')}`;
        const habilidadeValue = row[columnName] || row[habilidadeId];
        
        if (habilidadeValue !== undefined) {
          const { acertos, total, percentual } = parseHabilidadeValue(habilidadeValue);
          
          processedData.push({
            ...baseRecord,
            avaliado: total > 0,
            habilidade_id: habilidadeId,
            habilidade_codigo: `${habilidadeId}_${componente}`,
            descricao_habilidade: `Habilidade ${habilidadeId} - ${componente}`,
            acertos,
            total,
            percentual
          });
        }
      }
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
          setPreviewData(processedData.slice(0, 10)); // Mostra apenas os primeiros 10 registros
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

          await uploadProvaDataParceiro(processedData);
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
          
          // Reset form
          setForm({
            ano: '8º ano',
            componente: 'LP',
            semestre: '1',
            unidade: '',
            file: null,
          });
          setPreviewData([]);
          
          // Reset file input
          const fileInput = document.getElementById('file-upload') as HTMLInputElement;
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
        <div className="bg-green-100 p-2 rounded-lg">
          <Upload className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Upload de Planilhas - Avaliação Parceiro da Escola</h2>
          <p className="text-gray-600">Importe os dados da Avaliação Parceiro da Escola</p>
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
              onChange={(e) => setForm({ ...form, ano: e.target.value as '8º ano' | '2º ano' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
            >
              <option value="8º ano">8º ano</option>
              <option value="2º ano">2º ano</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Componente
            </label>
            <select
              value={form.componente}
              onChange={(e) => setForm({ ...form, componente: e.target.value as 'LP' | 'MT' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50"
            >
              <option value="LP">Língua Portuguesa</option>
              <option value="MT">Matemática</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Arquivo Excel (.xlsx)
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-400 transition-colors">
            <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">
              Clique para selecionar ou arraste o arquivo aqui
            </p>
            <input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="file-upload"
              className="bg-green-50 text-green-600 px-4 py-2 rounded-lg cursor-pointer hover:bg-green-100 transition-colors"
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
                    <th className="px-2 py-1 text-left">Proficiência</th>
                    <th className="px-2 py-1 text-left">Padrão</th>
                    <th className="px-2 py-1 text-left">%</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, index) => (
                    <tr key={index} className="border-t border-gray-200">
                      <td className="px-2 py-1">{row.nome_aluno}</td>
                      <td className="px-2 py-1">{row.turma}</td>
                      <td className="px-2 py-1">{row.habilidade_id}</td>
                      <td className="px-2 py-1">{row.proficiencia}</td>
                      <td className="px-2 py-1">{row.padrao_desempenho}</td>
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
          className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? 'Processando...' : 'Importar Dados'}
        </button>
      </form>
    </div>
  );
};

export default UploadFormParceiro;