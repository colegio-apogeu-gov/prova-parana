import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import FilterPanel from './FilterPanel';
import ProficiencyGauge from './ProficiencyGauge';
import { getProficiencyData, getProficiencyDataset } from '../../lib/supabase';
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
    regional1Avaliacao: { value: 0, label: 'Regional - 1ª Avaliação', defasagem: 0, intermediario: 0, adequado: 0 },
    regional2Avaliacao: { value: 0, label: 'Regional - 2ª Avaliação', defasagem: 0, intermediario: 0, adequado: 0 },
    redeToda1Avaliacao: { value: 0, label: 'Rede Toda - 1ª Avaliação', defasagem: 0, intermediario: 0, adequado: 0 },
    redeToda2Avaliacao: { value: 0, label: 'Rede Toda - 2ª Avaliação', defasagem: 0, intermediario: 0, adequado: 0 }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const isParana = selectedSystem === 'prova-parana';
    const tableName = isParana ? 'prova_resultados' : 'prova_resultados_parceiro';

    // -----------------------------------------
    // 1) REDE TODA (independente de filtros)
    //    Só aplica componente/ano_escolar
    // -----------------------------------------
    const redeScope: any = {};
    if (filters.componente) redeScope.componente = filters.componente;
    if (filters.ano_escolar) redeScope.ano_escolar = filters.ano_escolar;

    const datasetRede = await getProficiencyDataset(redeScope, tableName);

    // Separação por semestre (rede toda)
    const redeSem1 = datasetRede.filter(d => String(d.semestre) === '1');
    const redeSem2 = datasetRede.filter(d => String(d.semestre) === '2');

    // -----------------------------------------
    // 2) ESCOPO DA TELA (para Unidade/Regional)
    //    - Se houver UNIDADE -> dataset por unidade
    //    - Senão, se houver REGIONAL -> dataset por regional
    //    - Senão -> reaproveita dataset da rede
    // -----------------------------------------
    let datasetScoped = datasetRede;
    if (filters.unidade) {
      datasetScoped = await getProficiencyDataset(
        { ...redeScope, unidade: filters.unidade },
        tableName
      );
    } else if (filters.regional) {
      datasetScoped = await getProficiencyDataset(
        { ...redeScope, regional: filters.regional },
        tableName
      );
    }

    // Subconjuntos por semestre (escopo)
    const scopeSem1 = datasetScoped.filter(d => String(d.semestre) === '1');
    const scopeSem2 = datasetScoped.filter(d => String(d.semestre) === '2');

    // -----------------------------------------
    // 3) Montagem dos datasets de cada gráfico
    // -----------------------------------------

    // Unidade: se houver unidade, já está restrito; se não, usa a rede toda
    const unidade1Data = filters.unidade ? scopeSem1 : redeSem1;
    const unidade2Data = filters.unidade ? scopeSem2 : redeSem2;

    // Regional: ignora unidade (usa dataset DA REDE filtrado por regional se houver)
    const regional1Data = filters.regional
      ? redeSem1.filter(d => d.regional === filters.regional)
      : redeSem1;
    const regional2Data = filters.regional
      ? redeSem2.filter(d => d.regional === filters.regional)
      : redeSem2;

    // Rede toda: sempre dataset global (independente de filtros)
    const redeToda1Data = redeSem1;
    const redeToda2Data = redeSem2;

    // -----------------------------------------
    // 4) Cálculo de proficiência
    // -----------------------------------------
    const unidade1Stats = calculateProficiency(unidade1Data);
    const unidade2Stats = calculateProficiency(unidade2Data);
    const regional1Stats = calculateProficiency(regional1Data);
    const regional2Stats = calculateProficiency(regional2Data);
    const redeToda1Stats = calculateProficiency(redeToda1Data);
    const redeToda2Stats = calculateProficiency(redeToda2Data);

    // Coerção para evitar NaN
    setProficiencyData({
      unidade1Avaliacao: {
        value: Number(unidade1Stats.proficiency) || 0,
        label: 'Unidade - 1ª Avaliação',
        defasagem: Number(unidade1Stats.defasagem) || 0,
        intermediario: Number(unidade1Stats.intermediario) || 0,
        adequado: Number(unidade1Stats.adequado) || 0
      },
      unidade2Avaliacao: {
        value: Number(unidade2Stats.proficiency) || 0,
        label: 'Unidade - 2ª Avaliação',
        defasagem: Number(unidade2Stats.defasagem) || 0,
        intermediario: Number(unidade2Stats.intermediario) || 0,
        adequado: Number(unidade2Stats.adequado) || 0
      },
      regional1Avaliacao: {
        value: Number(regional1Stats.proficiency) || 0,
        label: 'Regional - 1ª Avaliação',
        defasagem: Number(regional1Stats.defasagem) || 0,
        intermediario: Number(regional1Stats.intermediario) || 0,
        adequado: Number(regional1Stats.adequado) || 0
      },
      regional2Avaliacao: {
        value: Number(regional2Stats.proficiency) || 0,
        label: 'Regional - 2ª Avaliação',
        defasagem: Number(regional2Stats.defasagem) || 0,
        intermediario: Number(regional2Stats.intermediario) || 0,
        adequado: Number(regional2Stats.adequado) || 0
      },
      redeToda1Avaliacao: {
        value: Number(redeToda1Stats.proficiency) || 0,
        label: 'Rede Toda - 1ª Avaliação',
        defasagem: Number(redeToda1Stats.defasagem) || 0,
        intermediario: Number(redeToda1Stats.intermediario) || 0,
        adequado: Number(redeToda1Stats.adequado) || 0
      },
      redeToda2Avaliacao: {
        value: Number(redeToda2Stats.proficiency) || 0,
        label: 'Rede Toda - 2ª Avaliação',
        defasagem: Number(redeToda2Stats.defasagem) || 0,
        intermediario: Number(redeToda2Stats.intermediario) || 0,
        adequado: Number(redeToda2Stats.adequado) || 0
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

const safeN = (x: any) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};

const TrendBadge = ({
  curr,
  prev,
  betterWhen, // 'down' | 'up'  -> down = melhora quando cai; up = melhora quando sobe
}: {
  curr: number;
  prev: number;
  betterWhen: 'down' | 'up';
}) => {
  const current = safeN(curr);
  const previous = safeN(prev);

  const rawDelta = current - previous;                      // delta matemático
  const improved = betterWhen === 'down' ? rawDelta < 0     // queda = melhor
                                         : rawDelta > 0;    // aumento = melhor

  const amount = Math.abs(rawDelta);                        // mostramos sempre o módulo
  if (amount === 0) return null;                            // não mostra nada se igual

  const sign = improved ? '+' : '−';                        // + para melhora, − para piora
  const colorClass = improved ? 'text-green-600' : 'text-red-600';

  return (
    <span className={`text-xs font-semibold ${colorClass}`}>
      ({sign}{amount})
    </span>
  );
};

const Card = ({
  title, value, def, inter, adeq, compareTo
}: {
  title: string;
  value: number;
  def: number;
  inter: number;
  adeq: number;
  compareTo?: { value: number; def: number; inter: number; adeq: number };
}) => {
  const v = safeN(value);
  const d = safeN(def);
  const i = safeN(inter);
  const a = safeN(adeq);

  const cv = compareTo ? safeN(compareTo.value) : 0;
  const cd = compareTo ? safeN(compareTo.def)   : 0;
  const ci = compareTo ? safeN(compareTo.inter) : 0;
  const ca = compareTo ? safeN(compareTo.adeq)  : 0;

  const total = d + i + a;
  const totalCompare = cd + ci + ca;
  const diffPct = compareTo ? (v - cv) : 0;
  const diffTotal = compareTo ? (total - totalCompare) : 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">{title}</h3>

      <ProficiencyGauge value={v} color={getProficiencyColor(v)} />

      <div className="text-center mt-4">
        <p className="text-sm text-gray-600">Nível de Proficiência</p>
        <div className="flex items-center justify-center gap-2">
          <p className="text-lg font-semibold" style={{ color: getProficiencyColor(v) }}>
            {getProficiencyLevel(v)}
          </p>
          {compareTo && Math.abs(diffPct) >= 0.1 && (
            <span className={`text-sm font-semibold ${diffPct > 0 ? 'text-green-600' : 'text-red-600'}`}>
              ({diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)
              {totalCompare !== total && Number.isFinite(diffTotal) && (
                <span className="ml-1">
                  ({diffTotal > 0 ? '+' : ''}{diffTotal} {Math.abs(diffTotal) === 1 ? 'aluno' : 'alunos'})
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {/* Defasagem: queda é verde (melhora), aumento é vermelho */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-gray-700">Defasagem</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">
              {d} {Math.abs(d) === 1 ? 'aluno' : 'alunos'}
            </span>
            {compareTo && <TrendBadge curr={d} prev={cd} betterWhen="down" />}
          </div>
        </div>

        {/* Intermediário: queda é verde (melhora), aumento é vermelho */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-gray-700">Intermediário</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">
              {i} {Math.abs(i) === 1 ? 'aluno' : 'alunos'}
            </span>
            {compareTo && <TrendBadge curr={i} prev={ci} betterWhen="down" />}
          </div>
        </div>

        {/* Adequado: aumento é verde (melhora), queda é vermelho */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-700">Adequado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">
              {a} {Math.abs(a) === 1 ? 'aluno' : 'alunos'}
            </span>
            {compareTo && <TrendBadge curr={a} prev={ca} betterWhen="up" />}
          </div>
        </div>
      </div>
    </div>
  );
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
        <>
          {/* Linha 1: Unidade 1ª e 2ª */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card
              title={proficiencyData.unidade1Avaliacao.label}
              value={proficiencyData.unidade1Avaliacao.value}
              def={proficiencyData.unidade1Avaliacao.defasagem}
              inter={proficiencyData.unidade1Avaliacao.intermediario}
              adeq={proficiencyData.unidade1Avaliacao.adequado}
            />
<Card
  title={proficiencyData.unidade2Avaliacao.label}
  value={proficiencyData.unidade2Avaliacao.value}
  def={proficiencyData.unidade2Avaliacao.defasagem}
  inter={proficiencyData.unidade2Avaliacao.intermediario}
  adeq={proficiencyData.unidade2Avaliacao.adequado}
  compareTo={{
    value: proficiencyData.unidade1Avaliacao.value,
    def:   proficiencyData.unidade1Avaliacao.defasagem,
    inter: proficiencyData.unidade1Avaliacao.intermediario,
    adeq:  proficiencyData.unidade1Avaliacao.adequado
  }}
/>

          </div>

          {/* Linha 2: Regional 1ª e 2ª (substitui o gráfico único de Regional) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card
              title={proficiencyData.regional1Avaliacao.label}
              value={proficiencyData.regional1Avaliacao.value}
              def={proficiencyData.regional1Avaliacao.defasagem}
              inter={proficiencyData.regional1Avaliacao.intermediario}
              adeq={proficiencyData.regional1Avaliacao.adequado}
            />
            <Card
              title={proficiencyData.regional2Avaliacao.label}
              value={proficiencyData.regional2Avaliacao.value}
              def={proficiencyData.regional2Avaliacao.defasagem}
              inter={proficiencyData.regional2Avaliacao.intermediario}
              adeq={proficiencyData.regional2Avaliacao.adequado}
              compareTo={{
  value: proficiencyData.regional1Avaliacao.value,
  def:   proficiencyData.regional1Avaliacao.defasagem,
  inter: proficiencyData.regional1Avaliacao.intermediario,
  adeq:  proficiencyData.regional1Avaliacao.adequado
}}

            />
          </div>

          {/* Linha 3: Rede toda 1ª e 2ª (substitui o gráfico único de Rede toda) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card
              title={proficiencyData.redeToda1Avaliacao.label}
              value={proficiencyData.redeToda1Avaliacao.value}
              def={proficiencyData.redeToda1Avaliacao.defasagem}
              inter={proficiencyData.redeToda1Avaliacao.intermediario}
              adeq={proficiencyData.redeToda1Avaliacao.adequado}
            />
            <Card
              title={proficiencyData.redeToda2Avaliacao.label}
              value={proficiencyData.redeToda2Avaliacao.value}
              def={proficiencyData.redeToda2Avaliacao.defasagem}
              inter={proficiencyData.redeToda2Avaliacao.intermediario}
              adeq={proficiencyData.redeToda2Avaliacao.adequado}
              compareTo={{
  value: proficiencyData.redeToda1Avaliacao.value,
  def:   proficiencyData.redeToda1Avaliacao.defasagem,
  inter: proficiencyData.redeToda1Avaliacao.intermediario,
  adeq:  proficiencyData.redeToda1Avaliacao.adequado
}}

            />
          </div>
        </>
      )}
    </div>
  );
};

export default VisaoGeral;
