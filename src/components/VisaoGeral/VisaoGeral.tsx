import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import FilterPanel from './FilterPanel';
import ProficiencyGauge from './ProficiencyGauge';
import { getProficiencyData } from '../../lib/supabase';
import { getProficiencyDataParceiro } from '../../lib/supabaseParceiro';

interface VisaoGeralProps {
  userProfile: UserProfile | null;
  selectedSystem: 'prova-parana' | 'parceiro';
}

interface Filters {
  componente: string;
  regional: string;
  unidade: string;
  ano_escolar: string;
}

const VisaoGeral: React.FC<VisaoGeralProps> = ({ userProfile, selectedSystem }) => {
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    componente: '',
    regional: '',
    unidade: '',
    ano_escolar: ''
  });

  const [proficiencyData, setProficiencyData] = useState({
    unidade1Avaliacao: { value: 0, label: 'Unidade - 1ª Avaliação', defasagem: 0, intermediario: 0, adequado: 0 },
    unidade2Avaliacao: { value: 0, label: 'Unidade - 2ª Avaliação', defasagem: 0, intermediario: 0, adequado: 0 },
    regional: { value: 0, label: 'Regional', defasagem: 0, intermediario: 0, adequado: 0 },
    redeToda: { value: 0, label: 'Rede Toda', defasagem: 0, intermediario: 0, adequado: 0 }
  });

  const isProvaParana = selectedSystem === 'prova-parana';

  useEffect(() => {
    if (userProfile) {
      setFilters(prev => ({
        ...prev,
        unidade: userProfile.unidade || '',
        regional: userProfile.regional || ''
      }));
    }
  }, [userProfile]);

  useEffect(() => {
    loadProficiencyData();
  }, [filters, selectedSystem]);

  const calculateProficiency = (data: any[]) => {
    const uniqueStudents = new Map<string, { totalAcertos: number; totalPossivel: number }>();

    data.forEach(item => {
      if (!item.avaliado) return;

      const key = item.nome_aluno;
      if (!uniqueStudents.has(key)) {
        uniqueStudents.set(key, { totalAcertos: 0, totalPossivel: 0 });
      }

      const student = uniqueStudents.get(key)!;
      student.totalAcertos += item.acertos || 0;
      student.totalPossivel += item.total || 0;
    });

    if (uniqueStudents.size === 0) return { proficiency: 0, defasagem: 0, intermediario: 0, adequado: 0 };

    let totalProficiency = 0;
    let defasagem = 0;
    let intermediario = 0;
    let adequado = 0;

    uniqueStudents.forEach(student => {
      if (student.totalPossivel > 0) {
        const proficiency = (student.totalAcertos / student.totalPossivel) * 100;
        totalProficiency += proficiency;

        if (proficiency < 30) {
          defasagem++;
        } else if (proficiency < 71) {
          intermediario++;
        } else {
          adequado++;
        }
      }
    });

    return {
      proficiency: totalProficiency / uniqueStudents.size,
      defasagem,
      intermediario,
      adequado
    };
  };

  const loadProficiencyData = async () => {
    setLoading(true);
    try {
      const fetchFunction = isProvaParana ? getProficiencyData : getProficiencyDataParceiro;
      const baseFilters: any = {};
      if (filters.componente) baseFilters.componente = filters.componente;
      if (filters.ano_escolar) baseFilters.ano_escolar = filters.ano_escolar;

      const [unidade1Data, unidade2Data, regionalData, redeTodaData] = await Promise.all([
        fetchFunction({
          ...baseFilters,
          semestre: 1,
          unidade: filters.unidade || userProfile?.unidade
        }),
        fetchFunction({
          ...baseFilters,
          semestre: 2,
          unidade: filters.unidade || userProfile?.unidade
        }),
        fetchFunction({
          ...baseFilters,
          regional: filters.regional || userProfile?.regional
        }),
        fetchFunction(baseFilters)
      ]);

      const unidade1Stats = calculateProficiency(unidade1Data);
      const unidade2Stats = calculateProficiency(unidade2Data);
      const regionalStats = calculateProficiency(regionalData);
      const redeTodaStats = calculateProficiency(redeTodaData);

      setProficiencyData({
        unidade1Avaliacao: {
          value: unidade1Stats.proficiency,
          label: 'Unidade - 1ª Avaliação',
          defasagem: unidade1Stats.defasagem,
          intermediario: unidade1Stats.intermediario,
          adequado: unidade1Stats.adequado
        },
        unidade2Avaliacao: {
          value: unidade2Stats.proficiency,
          label: 'Unidade - 2ª Avaliação',
          defasagem: unidade2Stats.defasagem,
          intermediario: unidade2Stats.intermediario,
          adequado: unidade2Stats.adequado
        },
        regional: {
          value: regionalStats.proficiency,
          label: 'Regional',
          defasagem: regionalStats.defasagem,
          intermediario: regionalStats.intermediario,
          adequado: regionalStats.adequado
        },
        redeToda: {
          value: redeTodaStats.proficiency,
          label: 'Rede Toda',
          defasagem: redeTodaStats.defasagem,
          intermediario: redeTodaStats.intermediario,
          adequado: redeTodaStats.adequado
        }
      });
    } catch (error) {
      console.error('Erro ao carregar dados de proficiência:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProficiencyLevel = (value: number): string => {
    if (value < 30) return 'Defasagem';
    if (value < 71) return 'Aprendizado Intermediário';
    return 'Aprendizado Adequado';
  };

  const getProficiencyColor = (value: number): string => {
    if (value < 30) return '#ef4444';
    if (value < 71) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Visão Geral - Proficiência dos Alunos</h1>
      </div>

      <FilterPanel
        filters={filters}
        onFilterChange={setFilters}
        selectedSystem={selectedSystem}
        userProfile={userProfile}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando dados...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
              {proficiencyData.unidade1Avaliacao.label}
            </h3>
            <ProficiencyGauge
              value={proficiencyData.unidade1Avaliacao.value}
              color={getProficiencyColor(proficiencyData.unidade1Avaliacao.value)}
            />
            <div className="text-center mt-4">
              <p className="text-sm text-gray-600">Nível de Proficiência</p>
              <p className="text-lg font-semibold" style={{ color: getProficiencyColor(proficiencyData.unidade1Avaliacao.value) }}>
                {getProficiencyLevel(proficiencyData.unidade1Avaliacao.value)}
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-gray-700">Defasagem</span>
                </div>
                <span className="font-semibold text-gray-900">{proficiencyData.unidade1Avaliacao.defasagem} alunos</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-gray-700">Intermediário</span>
                </div>
                <span className="font-semibold text-gray-900">{proficiencyData.unidade1Avaliacao.intermediario} alunos</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-700">Adequado</span>
                </div>
                <span className="font-semibold text-gray-900">{proficiencyData.unidade1Avaliacao.adequado} alunos</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
              {proficiencyData.unidade2Avaliacao.label}
            </h3>
            <ProficiencyGauge
              value={proficiencyData.unidade2Avaliacao.value}
              color={getProficiencyColor(proficiencyData.unidade2Avaliacao.value)}
            />
            <div className="text-center mt-4">
              <p className="text-sm text-gray-600">Nível de Proficiência</p>
              <div className="flex items-center justify-center gap-2">
                <p className="text-lg font-semibold" style={{ color: getProficiencyColor(proficiencyData.unidade2Avaliacao.value) }}>
                  {getProficiencyLevel(proficiencyData.unidade2Avaliacao.value)}
                </p>
                {(() => {
                  const diff = proficiencyData.unidade2Avaliacao.value - proficiencyData.unidade1Avaliacao.value;
                  const diffTotal = (proficiencyData.unidade2Avaliacao.adequado + proficiencyData.unidade2Avaliacao.intermediario + proficiencyData.unidade2Avaliacao.defasagem) -
                                    (proficiencyData.unidade1Avaliacao.adequado + proficiencyData.unidade1Avaliacao.intermediario + proficiencyData.unidade1Avaliacao.defasagem);
                  if (Math.abs(diff) < 0.1) return null;
                  const isPositive = diff > 0;
                  return (
                    <span className={`text-sm font-semibold flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      ({isPositive ? '+' : ''}{diff.toFixed(1)}%)
                      {diffTotal !== 0 && (
                        <span className="ml-1">
                          ({isPositive ? '+' : ''}{diffTotal} {Math.abs(diffTotal) === 1 ? 'aluno' : 'alunos'})
                        </span>
                      )}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-gray-700">Defasagem</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{proficiencyData.unidade2Avaliacao.defasagem} alunos</span>
                  {(() => {
                    const diff = proficiencyData.unidade2Avaliacao.defasagem - proficiencyData.unidade1Avaliacao.defasagem;
                    if (diff === 0) return null;
                    const isPositive = diff < 0;
                    return (
                      <span className={`text-xs font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        ({diff > 0 ? '+' : ''}{diff})
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-gray-700">Intermediário</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{proficiencyData.unidade2Avaliacao.intermediario} alunos</span>
                  {(() => {
                    const diff = proficiencyData.unidade2Avaliacao.intermediario - proficiencyData.unidade1Avaliacao.intermediario;
                    if (diff === 0) return null;
                    return (
                      <span className={`text-xs font-semibold ${diff > 0 ? 'text-orange-600' : 'text-orange-400'}`}>
                        ({diff > 0 ? '+' : ''}{diff})
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-700">Adequado</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{proficiencyData.unidade2Avaliacao.adequado} alunos</span>
                  {(() => {
                    const diff = proficiencyData.unidade2Avaliacao.adequado - proficiencyData.unidade1Avaliacao.adequado;
                    if (diff === 0) return null;
                    const isPositive = diff > 0;
                    return (
                      <span className={`text-xs font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        ({diff > 0 ? '+' : ''}{diff})
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
              {proficiencyData.regional.label}
            </h3>
            <ProficiencyGauge
              value={proficiencyData.regional.value}
              color={getProficiencyColor(proficiencyData.regional.value)}
            />
            <div className="text-center mt-4">
              <p className="text-sm text-gray-600">Nível de Proficiência</p>
              <p className="text-lg font-semibold" style={{ color: getProficiencyColor(proficiencyData.regional.value) }}>
                {getProficiencyLevel(proficiencyData.regional.value)}
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-gray-700">Defasagem</span>
                </div>
                <span className="font-semibold text-gray-900">{proficiencyData.regional.defasagem} alunos</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-gray-700">Intermediário</span>
                </div>
                <span className="font-semibold text-gray-900">{proficiencyData.regional.intermediario} alunos</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-700">Adequado</span>
                </div>
                <span className="font-semibold text-gray-900">{proficiencyData.regional.adequado} alunos</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
              {proficiencyData.redeToda.label}
            </h3>
            <ProficiencyGauge
              value={proficiencyData.redeToda.value}
              color={getProficiencyColor(proficiencyData.redeToda.value)}
            />
            <div className="text-center mt-4">
              <p className="text-sm text-gray-600">Nível de Proficiência</p>
              <p className="text-lg font-semibold" style={{ color: getProficiencyColor(proficiencyData.redeToda.value) }}>
                {getProficiencyLevel(proficiencyData.redeToda.value)}
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-gray-700">Defasagem</span>
                </div>
                <span className="font-semibold text-gray-900">{proficiencyData.redeToda.defasagem} alunos</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-gray-700">Intermediário</span>
                </div>
                <span className="font-semibold text-gray-900">{proficiencyData.redeToda.intermediario} alunos</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-700">Adequado</span>
                </div>
                <span className="font-semibold text-gray-900">{proficiencyData.redeToda.adequado} alunos</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisaoGeral;
