import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Users, Info } from 'lucide-react';
import {
  lerPlanilhaAlunos,
  planejarImportacao,
  aplicarImportacao,
  PlanilhaInvalidaError,
  PlanoImportacao,
  SalaExistente,
  SystemKey,
} from '../../lib/importAlunos';

interface ImportarAlunosModalProps {
  system: SystemKey;
  unidade: string;
  salasExistentes: SalaExistente[];
  /** Nomes de alunos que a unidade tem nas tabelas de prova. */
  carregarNomesDoBanco: () => Promise<string[]>;
  onClose: () => void;
  onImportado: () => void;
}

type Etapa = 'arquivo' | 'analisando' | 'previa' | 'importando' | 'concluido';

const ImportarAlunosModal: React.FC<ImportarAlunosModalProps> = ({
  system,
  unidade,
  salasExistentes,
  carregarNomesDoBanco,
  onClose,
  onImportado,
}) => {
  const [etapa, setEtapa] = useState<Etapa>('arquivo');
  const [erro, setErro] = useState('');
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [plano, setPlano] = useState<PlanoImportacao | null>(null);
  const [progresso, setProgresso] = useState({ feitas: 0, total: 0 });
  const [resultado, setResultado] = useState({ salasCriadas: 0, alunosInseridos: 0 });
  const [verNaoEncontrados, setVerNaoEncontrados] = useState(false);

  const handleArquivo = async (file: File) => {
    setErro('');
    setNomeArquivo(file.name);
    setEtapa('analisando');
    try {
      const [linhas, nomesDb] = await Promise.all([lerPlanilhaAlunos(file), carregarNomesDoBanco()]);
      const p = planejarImportacao({ linhas, unidadeDb: unidade, alunosDb: nomesDb, salasExistentes });
      setPlano(p);
      setEtapa('previa');
    } catch (e: any) {
      console.error(e);
      setErro(
        e instanceof PlanilhaInvalidaError
          ? e.message
          : 'Não foi possível ler a planilha. Verifique se é um .xlsx/.csv válido.'
      );
      setEtapa('arquivo');
    }
  };

  const confirmar = async () => {
    if (!plano) return;
    setEtapa('importando');
    setErro('');
    try {
      const r = await aplicarImportacao(system, unidade, plano, (feitas, total) =>
        setProgresso({ feitas, total })
      );
      setResultado(r);
      setEtapa('concluido');
      onImportado();
    } catch (e: any) {
      console.error(e);
      setErro('Erro ao criar as salas. Parte da importação pode ter sido salva — reimportar é seguro.');
      setEtapa('previa');
    }
  };

  const Stat = ({ valor, label, cor }: { valor: React.ReactNode; label: string; cor: string }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <p className={`text-2xl font-bold ${cor}`}>{valor}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              Importar alunos
            </h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            As salas são criadas com o nome da <strong>turma</strong> da planilha e recebem os alunos
            que já existem nos resultados de prova de <strong>{unidade}</strong>.
          </p>

          {erro && (
            <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* 1) Escolher arquivo */}
          {etapa === 'arquivo' && (
            <>
              <label className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/40 transition-colors">
                <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                <p className="font-medium text-gray-700">Selecione a planilha</p>
                <p className="text-sm text-gray-500 mt-1">.xlsx, .xls ou .csv</p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleArquivo(f);
                  }}
                />
              </label>
              <div className="mt-4 flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                <span>
                  Colunas obrigatórias: <strong>nome</strong>, <strong>turma</strong> e{' '}
                  <strong>unidade</strong> (<em>matricula</em> é opcional e ignorada). O nome da escola
                  não precisa ser idêntico ao do banco — a comparação é por aproximação. Linhas de
                  outras unidades são descartadas.
                </span>
              </div>
            </>
          )}

          {/* 2) Analisando */}
          {etapa === 'analisando' && (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-4" />
              <p className="text-gray-700 font-medium">Casando os alunos de {nomeArquivo}...</p>
              <p className="text-sm text-gray-500 mt-1">Isso pode levar alguns segundos.</p>
            </div>
          )}

          {/* 3) Prévia */}
          {etapa === 'previa' && plano && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <Stat valor={plano.salas.length} label="salas a preencher" cor="text-gray-900" />
                <Stat valor={plano.salasNovas} label="salas novas" cor="text-green-600" />
                <Stat valor={plano.totalNovos} label="alunos casados" cor="text-green-600" />
                <Stat
                  valor={plano.naoEncontrados.length}
                  label="não encontrados no banco"
                  cor="text-gray-400"
                />
              </div>

              {plano.totalNovos === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                  Nenhum aluno novo para importar. Ou as salas já estão completas, ou a planilha não
                  tem alunos desta unidade.
                  {plano.foraDaUnidade > 0 && (
                    <> {plano.foraDaUnidade} linha(s) são de outras escolas e foram descartadas.</>
                  )}
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-xs font-semibold text-gray-600 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" />
                    Salas que serão criadas/atualizadas
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                    {plano.salas.map((s) => (
                      <div key={s.nome} className="px-4 py-2 flex items-center justify-between gap-3">
                        <span className="text-sm text-gray-800 truncate" title={s.nome}>
                          {s.nome}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          {s.salaExistenteId ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                              já existe
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">
                              nova
                            </span>
                          )}
                          <span className="text-sm font-medium text-gray-900">+{s.novos.length}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {plano.casadosPorAproximacao.length > 0 && (
                <details className="mb-3 text-sm">
                  <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                    {plano.casadosPorAproximacao.length} nome(s) casado(s) por aproximação
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-gray-500 pl-4">
                    {plano.casadosPorAproximacao.map((c) => (
                      <li key={c.planilha}>
                        {c.planilha} → <strong className="text-gray-700">{c.banco}</strong>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {plano.naoEncontrados.length > 0 && (
                <div className="mb-4 text-sm">
                  <button
                    onClick={() => setVerNaoEncontrados((v) => !v)}
                    className="text-gray-600 hover:text-gray-800 underline underline-offset-2"
                  >
                    {verNaoEncontrados ? 'Ocultar' : 'Ver'} os {plano.naoEncontrados.length} alunos não
                    encontrados
                  </button>
                  <p className="text-xs text-gray-400 mt-1">
                    São alunos da planilha sem resultado de prova nesta unidade — normal quando não
                    fizeram esta avaliação. Eles não entram nas salas.
                  </p>
                  {verNaoEncontrados && (
                    <div className="mt-2 max-h-40 overflow-y-auto bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 space-y-0.5">
                      {plano.naoEncontrados.map((n) => (
                        <p key={n}>{n}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={confirmar}
                  disabled={plano.totalNovos === 0}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Importar {plano.totalNovos} aluno(s)
                </button>
                <button
                  onClick={() => {
                    setPlano(null);
                    setEtapa('arquivo');
                  }}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Trocar planilha
                </button>
              </div>
            </>
          )}

          {/* 4) Importando */}
          {etapa === 'importando' && (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-4" />
              <p className="text-gray-700 font-medium">
                Criando salas... {progresso.feitas}/{progresso.total}
              </p>
              <div className="mt-3 max-w-xs mx-auto h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${progresso.total ? (progresso.feitas / progresso.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* 5) Concluído */}
          {etapa === 'concluido' && (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <p className="text-lg font-semibold text-gray-900">Importação concluída</p>
              <p className="text-sm text-gray-600 mt-1">
                {resultado.salasCriadas} sala(s) criada(s) e {resultado.alunosInseridos} aluno(s)
                adicionado(s).
              </p>
              <button
                onClick={onClose}
                className="mt-5 bg-green-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportarAlunosModal;
