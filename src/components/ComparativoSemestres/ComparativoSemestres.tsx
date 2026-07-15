import React, { useState, useEffect, useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { fetchAllProvaData, getSalasDeAula, getAnosProva } from '../../lib/supabase';
import { fetchAllProvaDataParceiro, getSalasDeAulaParceiro, getAnosProvaParceiro } from '../../lib/supabaseParceiro';
import { ProvaResultado, ProvaResultadoParceiro } from '../../types';
import FilterPanel from './FilterPanel';
import SemesterPerformanceChart from './SemesterPerformanceChart';
import StudentEvolutionChart from './StudentEvolutionChart';
import SkillsEvolutionChart from './SkillsEvolutionChart';
import LevelTransitionChart from './LevelTransitionChart';
import ComponentEvolutionChart from './ComponentEvolutionChart';
import EvolutionSummaryCards from './EvolutionSummaryCards';
import ComparativoSemestralCards from './ComparativoSemestralCards';

interface ComparativoSemestresProps {
  userProfile: { unidade: string } | null;
  selectedSystem: 'prova-parana' | 'parceiro';
}

export interface SemesterFilters {
  unidade?: string;
  ano_escolar?: string;
  componente?: string;
  aluno?: string;
  nivel_aprendizagem?: string;
  padrao_desempenho?: string;
  sala_id?: string;
}

const ComparativoSemestres: React.FC<ComparativoSemestresProps> = ({ userProfile, selectedSystem }) => {
  const [data, setData] = useState<(ProvaResultado | ProvaResultadoParceiro)[]>([]);
  const [loading, setLoading] = useState(true);
  const [salasDeAula, setSalasDeAula] = useState<any[]>([]);
  const [filters, setFilters] = useState<SemesterFilters>(() => ({
    unidade: userProfile?.unidade || ''
  }));
  // Períodos comparados (ano + semestre). Padrão: 1º x 2º semestre do ano mais recente.
  const [anosDisponiveis, setAnosDisponiveis] = useState<string[]>([]);
  const [periodoA, setPeriodoA] = useState<{ ano: string; sem: string }>({ ano: '', sem: '1' });
  const [periodoB, setPeriodoB] = useState<{ ano: string; sem: string }>({ ano: '', sem: '2' });

  useEffect(() => {
    if (userProfile?.unidade && filters.unidade !== userProfile.unidade) {
      setFilters(prev => ({
        ...prev,
        unidade: userProfile.unidade
      }));
    }
  }, [userProfile, filters.unidade]);

  useEffect(() => {
    loadSalasDeAula();
  }, [userProfile, selectedSystem]);

  // Anos de prova disponíveis (para os seletores de período A/B).
  useEffect(() => {
    (async () => {
      if (!userProfile?.unidade) return;
      try {
        const fn = selectedSystem === 'prova-parana' ? getAnosProva : getAnosProvaParceiro;
        const anos = await fn(userProfile.unidade);
        setAnosDisponiveis(anos);
        setPeriodoA((p) => ({ ...p, ano: p.ano && anos.includes(p.ano) ? p.ano : (anos[0] ?? '') }));
        setPeriodoB((p) => ({ ...p, ano: p.ano && anos.includes(p.ano) ? p.ano : (anos[0] ?? '') }));
      } catch (e) {
        console.error('Erro ao carregar anos de prova:', e);
      }
    })();
  }, [userProfile, selectedSystem]);

  useEffect(() => {
    loadData();
  }, [filters, selectedSystem]);

  // Remapeia os dois períodos escolhidos para semestre '1' (A) e '2' (B), para que
  // todos os gráficos (que comparam 1º x 2º semestre) passem a comparar A x B.
  const remappedData = useMemo(() => {
    const out: any[] = [];
    data.forEach((r: any) => {
      if (periodoA.ano && r.ano_prova === periodoA.ano && String(r.semestre) === periodoA.sem) {
        out.push({ ...r, semestre: '1' });
      } else if (periodoB.ano && r.ano_prova === periodoB.ano && String(r.semestre) === periodoB.sem) {
        out.push({ ...r, semestre: '2' });
      }
    });
    return out;
  }, [data, periodoA, periodoB]);

  const periodoLabel = (p: { ano: string; sem: string }) => (p.ano ? `${p.sem}º sem · ${p.ano}` : '--');
  const mesmoPeriodo = periodoA.ano === periodoB.ano && periodoA.sem === periodoB.sem;

  const loadSalasDeAula = async () => {
    if (!userProfile?.unidade) return;

    try {
      const fetchSalasFn = selectedSystem === 'prova-parana' ? getSalasDeAula : getSalasDeAulaParceiro;
      const salas = await fetchSalasFn(userProfile.unidade);
      setSalasDeAula(salas || []);
    } catch (error) {
      console.error('Erro ao carregar salas de aula:', error);
      setSalasDeAula([]);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const fetchFn = selectedSystem === 'prova-parana' ? fetchAllProvaData : fetchAllProvaDataParceiro;
      const result = await fetchFn({
        unidade: filters.unidade,
        ano_escolar: filters.ano_escolar,
        componente: filters.componente,
        nome_aluno: filters.aluno,
        ...(selectedSystem === 'prova-parana'
          ? { nivel_aprendizagem: filters.nivel_aprendizagem }
          : { padrao_desempenho: filters.padrao_desempenho }
        )
      });

      let filteredData = result || [];

      if (filters.sala_id && filteredData.length > 0) {
        const sala = salasDeAula.find(s => s.id === filters.sala_id);
        if (sala) {
          const alunosSala = new Set(
            (selectedSystem === 'prova-parana'
              ? sala.sala_de_aula_alunos
              : sala.sala_de_aula_alunos_parceiros
            )?.map((a: any) => a.nome_aluno) || []
          );
          filteredData = filteredData.filter(item => alunosSala.has(item.nome_aluno));
        }
      }

      setData(filteredData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-6"></div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Carregando Comparativo de Semestres</h3>
          <p className="text-sm text-gray-600">
            Analisando evolução entre semestres - {selectedSystem === 'prova-parana' ? 'Prova Paraná Recomposição' : 'Avaliação Parceiro da Escola'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`${selectedSystem === 'prova-parana' ? 'bg-blue-100' : 'bg-green-100'} p-2 rounded-lg`}>
            <Calendar className={`w-6 h-6 ${selectedSystem === 'prova-parana' ? 'text-blue-600' : 'text-green-600'}`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Comparativo de Semestres</h1>
            <p className="text-gray-600">
              Análise de evolução entre períodos (Ano + Semestre) - {selectedSystem === 'prova-parana' ? 'Prova Paraná Recomposição' : 'Avaliação Parceiro da Escola'}
            </p>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          {userProfile?.unidade}
        </div>
      </div>

      <FilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        userProfile={userProfile}
        selectedSystem={selectedSystem}
        salasDeAula={salasDeAula}
      />

      {/* Períodos comparados (Ano + Semestre) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-end gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Período A
            </span>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ano</label>
              <select
                value={periodoA.ano}
                onChange={(e) => setPeriodoA((p) => ({ ...p, ano: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                {anosDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Semestre</label>
              <select
                value={periodoA.sem}
                onChange={(e) => setPeriodoA((p) => ({ ...p, sem: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">1º</option>
                <option value="2">2º</option>
              </select>
            </div>
          </div>

          <span className="text-gray-400 font-medium mb-2">vs</span>

          <div className="flex items-end gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Período B
            </span>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Ano</label>
              <select
                value={periodoB.ano}
                onChange={(e) => setPeriodoB((p) => ({ ...p, ano: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
              >
                {anosDisponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Semestre</label>
              <select
                value={periodoB.sem}
                onChange={(e) => setPeriodoB((p) => ({ ...p, sem: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
              >
                <option value="1">1º</option>
                <option value="2">2º</option>
              </select>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Nos gráficos abaixo, <strong className="text-blue-700">1º Semestre</strong> = Período A ({periodoLabel(periodoA)}) e{' '}
          <strong className="text-green-700">2º Semestre</strong> = Período B ({periodoLabel(periodoB)}).
          {mesmoPeriodo && <span className="text-amber-600"> Selecione períodos diferentes para comparar.</span>}
        </p>
      </div>

      <EvolutionSummaryCards data={remappedData} selectedSystem={selectedSystem} />

      <div className="grid lg:grid-cols-2 gap-6">
        <SemesterPerformanceChart data={remappedData} selectedSystem={selectedSystem} />
        <ComponentEvolutionChart data={remappedData} selectedSystem={selectedSystem} />
        <LevelTransitionChart data={remappedData} selectedSystem={selectedSystem} />
        <SkillsEvolutionChart data={remappedData} selectedSystem={selectedSystem} />
      </div>

      {filters.aluno && (
        <StudentEvolutionChart 
          data={remappedData} 
          selectedSystem={selectedSystem}
          studentName={filters.aluno}
        />
      )}

          <div className="space-y-2">
      <h2 className="text-xl font-bold text-gray-900">Alunos (1º x 2º semestre)</h2>
      <p className="text-sm text-gray-600">
        Clique no card do aluno para expandir os componentes e ver o match das habilidades.
      </p>
      <ComparativoSemestralCards data={remappedData} />
    </div>
    </div>
  );
};

export default ComparativoSemestres;