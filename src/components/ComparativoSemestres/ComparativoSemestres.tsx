import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, Minus, Users, Target, BookOpen } from 'lucide-react';
import { fetchAllProvaData } from '../../lib/supabase';
import { fetchAllProvaDataParceiro } from '../../lib/supabaseParceiro';
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
}

const ComparativoSemestres: React.FC<ComparativoSemestresProps> = ({ userProfile, selectedSystem }) => {
  const [data, setData] = useState<(ProvaResultado | ProvaResultadoParceiro)[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SemesterFilters>(() => ({
    unidade: userProfile?.unidade || ''
  }));

  useEffect(() => {
    if (userProfile?.unidade && filters.unidade !== userProfile.unidade) {
      setFilters(prev => ({
        ...prev,
        unidade: userProfile.unidade
      }));
    }
  }, [userProfile, filters.unidade]);

  useEffect(() => {
    loadData();
  }, [filters, selectedSystem]);

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
      
      setData(result || []);
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
              Análise de evolução entre 1º e 2º semestre - {selectedSystem === 'prova-parana' ? 'Prova Paraná Recomposição' : 'Avaliação Parceiro da Escola'}
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
      />

      <EvolutionSummaryCards data={data} selectedSystem={selectedSystem} />

      <div className="grid lg:grid-cols-2 gap-6">
        <SemesterPerformanceChart data={data} selectedSystem={selectedSystem} />
        <ComponentEvolutionChart data={data} selectedSystem={selectedSystem} />
        <LevelTransitionChart data={data} selectedSystem={selectedSystem} />
        <SkillsEvolutionChart data={data} selectedSystem={selectedSystem} />
      </div>

      {filters.aluno && (
        <StudentEvolutionChart 
          data={data} 
          selectedSystem={selectedSystem}
          studentName={filters.aluno}
        />
      )}

          <div className="space-y-2">
      <h2 className="text-xl font-bold text-gray-900">Alunos (1º x 2º semestre)</h2>
      <p className="text-sm text-gray-600">
        Clique no card do aluno para expandir os componentes e ver o match das habilidades.
      </p>
      <ComparativoSemestralCards data={data} />
    </div>
    </div>
  );
};

export default ComparativoSemestres;