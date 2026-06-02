import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, Minus, BarChart3, Users, Target } from 'lucide-react';
import { fetchAllProvaData, getAnosProva } from '../../lib/supabase';
import { fetchAllProvaDataParceiro, getAnosProvaParceiro } from '../../lib/supabaseParceiro';
import { fetchAllProvaDataMais, getAnosProvaMais } from '../../lib/supabaseMais';
import { UserProfile } from '../../types';

interface ComparacaoAnualProps {
  userProfile: UserProfile | null;
  selectedSystem: 'prova-parana' | 'parceiro' | 'parana-mais';
}

interface AnoEscolarStats {
  anoEscolar: string;
  componente: string;
  totalAlunos: number;
  alunosAvaliados: number;
  mediaPercentual: number;
  totalAcertos: number;
  totalQuestoes: number;
}

interface ComparisonRow {
  anoEscolar: string;
  componente: string;
  ano1Stats: AnoEscolarStats | null;
  ano2Stats: AnoEscolarStats | null;
  delta: number | null;
  trend: 'up' | 'down' | 'flat' | 'n/a';
}

function computeStats(rows: any[], anoEscolar: string, componente: string): AnoEscolarStats {
  const filtered = rows.filter(
    (r) => r.ano_escolar === anoEscolar && r.componente === componente && r.avaliado
  );

  const alunosUnicos = new Set(filtered.map((r) => r.nome_aluno));
  const totalAcertos = filtered.reduce((sum, r) => sum + (Number(r.acertos) || 0), 0);
  const totalQuestoes = filtered.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
  const mediaPercentual = totalQuestoes > 0 ? (totalAcertos / totalQuestoes) * 100 : 0;

  return {
    anoEscolar,
    componente,
    totalAlunos: alunosUnicos.size,
    alunosAvaliados: alunosUnicos.size,
    mediaPercentual,
    totalAcertos,
    totalQuestoes,
  };
}

const ComparacaoAnual: React.FC<ComparacaoAnualProps> = ({ userProfile, selectedSystem }) => {
  const [anosDisponiveis, setAnosDisponiveis] = useState<string[]>([]);
  const [anoBase, setAnoBase] = useState<string>('');
  const [anoComparacao, setAnoComparacao] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingAnos, setLoadingAnos] = useState(true);
  const [comparisons, setComparisons] = useState<ComparisonRow[]>([]);
  const [filterComponente, setFilterComponente] = useState<string>('');
  const [filterAnoEscolar, setFilterAnoEscolar] = useState<string>('');

  const systemColor = selectedSystem === 'prova-parana' ? 'blue' : selectedSystem === 'parceiro' ? 'green' : 'orange';
  const systemTitle =
    selectedSystem === 'prova-parana'
      ? 'Prova Parana Recomposicao'
      : selectedSystem === 'parceiro'
      ? 'Avaliacao Parceiro da Escola'
      : 'Parana Mais';

  useEffect(() => {
    loadAnos();
  }, [selectedSystem, userProfile]);

  const loadAnos = async () => {
    setLoadingAnos(true);
    try {
      let anos: string[] = [];
      const unidade = userProfile?.unidade;

      if (selectedSystem === 'prova-parana') {
        anos = await getAnosProva(unidade);
      } else if (selectedSystem === 'parceiro') {
        anos = await getAnosProvaParceiro(unidade);
      } else {
        anos = await getAnosProvaMais(unidade);
      }

      setAnosDisponiveis(anos);
      if (anos.length >= 2) {
        setAnoComparacao(anos[0]);
        setAnoBase(anos[1]);
      } else if (anos.length === 1) {
        setAnoComparacao(anos[0]);
        setAnoBase('');
      }
    } catch (error) {
      console.error('Erro ao carregar anos:', error);
    } finally {
      setLoadingAnos(false);
    }
  };

  const loadComparison = async () => {
    if (!anoBase || !anoComparacao) return;

    setLoading(true);
    setComparisons([]);

    try {
      const baseFilters: any = { ano_prova: anoBase };
      const compFilters: any = { ano_prova: anoComparacao };

      if (userProfile?.unidade) {
        baseFilters.unidade = userProfile.unidade;
        compFilters.unidade = userProfile.unidade;
      }

      let dataAno1: any[] = [];
      let dataAno2: any[] = [];

      if (selectedSystem === 'prova-parana') {
        [dataAno1, dataAno2] = await Promise.all([
          fetchAllProvaData(baseFilters),
          fetchAllProvaData(compFilters),
        ]);
      } else if (selectedSystem === 'parceiro') {
        [dataAno1, dataAno2] = await Promise.all([
          fetchAllProvaDataParceiro(baseFilters),
          fetchAllProvaDataParceiro(compFilters),
        ]);
      } else {
        [dataAno1, dataAno2] = await Promise.all([
          fetchAllProvaDataMais(baseFilters),
          fetchAllProvaDataMais(compFilters),
        ]);
      }

      const anosEscolaresSet = new Set<string>();
      const componentesSet = new Set<string>();

      [...dataAno1, ...dataAno2].forEach((r) => {
        if (r.ano_escolar) anosEscolaresSet.add(r.ano_escolar);
        if (r.componente) componentesSet.add(r.componente);
      });

      const anosEscolares = Array.from(anosEscolaresSet).sort();
      const componentes = Array.from(componentesSet).sort();

      const rows: ComparisonRow[] = [];

      for (const ae of anosEscolares) {
        for (const comp of componentes) {
          const s1 = computeStats(dataAno1, ae, comp);
          const s2 = computeStats(dataAno2, ae, comp);

          const hasS1 = s1.totalQuestoes > 0;
          const hasS2 = s2.totalQuestoes > 0;

          const delta = hasS1 && hasS2 ? s2.mediaPercentual - s1.mediaPercentual : null;
          let trend: 'up' | 'down' | 'flat' | 'n/a' = 'n/a';
          if (delta !== null) {
            if (delta > 0.5) trend = 'up';
            else if (delta < -0.5) trend = 'down';
            else trend = 'flat';
          }

          rows.push({
            anoEscolar: ae,
            componente: comp,
            ano1Stats: hasS1 ? s1 : null,
            ano2Stats: hasS2 ? s2 : null,
            delta,
            trend,
          });
        }
      }

      setComparisons(rows);
    } catch (error) {
      console.error('Erro ao carregar dados comparativos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (anoBase && anoComparacao && anoBase !== anoComparacao) {
      loadComparison();
    }
  }, [anoBase, anoComparacao, selectedSystem]);

  const filteredComparisons = comparisons.filter((row) => {
    if (filterComponente && row.componente !== filterComponente) return false;
    if (filterAnoEscolar && row.anoEscolar !== filterAnoEscolar) return false;
    return true;
  });

  const availableAnosEscolares = Array.from(new Set(comparisons.map((r) => r.anoEscolar))).sort();
  const availableComponentes = Array.from(new Set(comparisons.map((r) => r.componente))).sort();

  const overallDelta = (() => {
    const valid = filteredComparisons.filter((r) => r.delta !== null);
    if (valid.length === 0) return null;
    return valid.reduce((sum, r) => sum + (r.delta || 0), 0) / valid.length;
  })();

  const totalAlunosAno1 = filteredComparisons.reduce((sum, r) => sum + (r.ano1Stats?.totalAlunos || 0), 0);
  const totalAlunosAno2 = filteredComparisons.reduce((sum, r) => sum + (r.ano2Stats?.totalAlunos || 0), 0);

  const TrendIcon = ({ trend, size = 'w-5 h-5' }: { trend: string; size?: string }) => {
    if (trend === 'up') return <TrendingUp className={`${size} text-green-600`} />;
    if (trend === 'down') return <TrendingDown className={`${size} text-red-600`} />;
    if (trend === 'flat') return <Minus className={`${size} text-gray-500`} />;
    return <Minus className={`${size} text-gray-300`} />;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className={`bg-${systemColor}-100 p-2 rounded-lg`}>
            <Calendar className={`w-6 h-6 text-${systemColor}-600`} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Comparacao Anual</h2>
            <p className="text-gray-600 text-sm">
              Compare o desempenho medio por ano escolar entre diferentes anos - {systemTitle}
            </p>
          </div>
        </div>

        {loadingAnos ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : anosDisponiveis.length < 2 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
            <p className="text-sm text-yellow-800">
              Sao necessarios dados de pelo menos 2 anos diferentes para realizar a comparacao.
              {anosDisponiveis.length === 1 && ` Atualmente ha dados apenas de ${anosDisponiveis[0]}.`}
              {anosDisponiveis.length === 0 && ' Nenhum dado encontrado.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ano Base</label>
                <select
                  value={anoBase}
                  onChange={(e) => setAnoBase(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Selecione</option>
                  {anosDisponiveis.map((ano) => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ano Comparacao</label>
                <select
                  value={anoComparacao}
                  onChange={(e) => setAnoComparacao(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Selecione</option>
                  {anosDisponiveis.map((ano) => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ano Escolar</label>
                <select
                  value={filterAnoEscolar}
                  onChange={(e) => setFilterAnoEscolar(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Todos</option>
                  {availableAnosEscolares.map((ae) => (
                    <option key={ae} value={ae}>{ae}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Componente</label>
                <select
                  value={filterComponente}
                  onChange={(e) => setFilterComponente(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Todos</option>
                  {availableComponentes.map((c) => (
                    <option key={c} value={c}>{c === 'LP' ? 'Lingua Portuguesa' : c === 'MT' ? 'Matematica' : c}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-sm text-gray-500">Carregando dados comparativos...</p>
                </div>
              </div>
            ) : comparisons.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-500 font-medium">Variacao Media Geral</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {overallDelta !== null ? (
                        <>
                          <span className={`text-2xl font-bold ${overallDelta > 0 ? 'text-green-700' : overallDelta < 0 ? 'text-red-700' : 'text-gray-700'}`}>
                            {overallDelta > 0 ? '+' : ''}{overallDelta.toFixed(1)}%
                          </span>
                          <TrendIcon trend={overallDelta > 0.5 ? 'up' : overallDelta < -0.5 ? 'down' : 'flat'} />
                        </>
                      ) : (
                        <span className="text-2xl font-bold text-gray-400">--</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{anoBase} para {anoComparacao}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-500 font-medium">Alunos Avaliados ({anoBase})</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900">{totalAlunosAno1.toLocaleString()}</span>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-500 font-medium">Alunos Avaliados ({anoComparacao})</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900">{totalAlunosAno2.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Ano Escolar</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Componente</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">Media {anoBase}</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">Alunos {anoBase}</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">Media {anoComparacao}</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">Alunos {anoComparacao}</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">Variacao</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">Tendencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredComparisons.map((row, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900">{row.anoEscolar}</td>
                            <td className="px-4 py-3 text-gray-700">
                              {row.componente === 'LP' ? 'Lingua Portuguesa' : row.componente === 'MT' ? 'Matematica' : row.componente}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {row.ano1Stats ? (
                                <span className="font-medium">{row.ano1Stats.mediaPercentual.toFixed(1)}%</span>
                              ) : (
                                <span className="text-gray-400">--</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600">
                              {row.ano1Stats?.totalAlunos || '--'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {row.ano2Stats ? (
                                <span className="font-medium">{row.ano2Stats.mediaPercentual.toFixed(1)}%</span>
                              ) : (
                                <span className="text-gray-400">--</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600">
                              {row.ano2Stats?.totalAlunos || '--'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {row.delta !== null ? (
                                <span className={`font-semibold ${row.delta > 0 ? 'text-green-700' : row.delta < 0 ? 'text-red-700' : 'text-gray-600'}`}>
                                  {row.delta > 0 ? '+' : ''}{row.delta.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-gray-400">--</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center">
                                <TrendIcon trend={row.trend} size="w-4 h-4" />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {filteredComparisons.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Visualizacao Comparativa</h3>
                    <div className="space-y-3">
                      {filteredComparisons.map((row, idx) => {
                        const maxVal = Math.max(
                          row.ano1Stats?.mediaPercentual || 0,
                          row.ano2Stats?.mediaPercentual || 0,
                          1
                        );
                        const barMax = Math.min(100, Math.ceil(maxVal / 10) * 10 + 10);

                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="w-32 text-xs font-medium text-gray-700 text-right shrink-0">
                              {row.anoEscolar} - {row.componente}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 w-8">{anoBase}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                                  <div
                                    className="absolute top-0 left-0 h-full bg-blue-400 rounded-full transition-all duration-500"
                                    style={{ width: `${((row.ano1Stats?.mediaPercentual || 0) / barMax) * 100}%` }}
                                  />
                                  <span className="absolute right-2 top-0 h-full flex items-center text-[10px] font-medium text-gray-700">
                                    {row.ano1Stats ? `${row.ano1Stats.mediaPercentual.toFixed(1)}%` : '--'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 w-8">{anoComparacao}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                                  <div
                                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${
                                      row.trend === 'up' ? 'bg-green-400' : row.trend === 'down' ? 'bg-red-400' : 'bg-gray-400'
                                    }`}
                                    style={{ width: `${((row.ano2Stats?.mediaPercentual || 0) / barMax) * 100}%` }}
                                  />
                                  <span className="absolute right-2 top-0 h-full flex items-center text-[10px] font-medium text-gray-700">
                                    {row.ano2Stats ? `${row.ano2Stats.mediaPercentual.toFixed(1)}%` : '--'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="w-16 text-right shrink-0">
                              {row.delta !== null ? (
                                <span className={`text-xs font-semibold ${row.delta > 0 ? 'text-green-700' : row.delta < 0 ? 'text-red-700' : 'text-gray-500'}`}>
                                  {row.delta > 0 ? '+' : ''}{row.delta.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">--</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : anoBase && anoComparacao && anoBase !== anoComparacao ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                Nenhum dado encontrado para os anos selecionados.
              </div>
            ) : anoBase === anoComparacao && anoBase ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-sm text-yellow-800">Selecione dois anos diferentes para comparar.</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparacaoAnual;
