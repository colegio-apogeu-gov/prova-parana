import React, { useState, useEffect } from 'react';
import { PieChart, BarChart3, TrendingUp, Users, Target, BookOpen, Award, Calendar } from 'lucide-react';
import { fetchProvaData, fetchAllProvaData } from '../../lib/supabase';
import { fetchProvaDataParceiro, fetchAllProvaDataParceiro } from '../../lib/supabaseParceiro';
import { ProvaResultado } from '../../types';
import PerformanceByGradeChart from './PerformanceByGradeChart';
import ComponentComparisonChart from './ComponentComparisonChart';
import LearningLevelsChart from './LearningLevelsChart';
import SkillsPerformanceChart from './SkillsPerformanceChart';
import SemesterComparisonChart from './SemesterComparisonChart';
import ClassPerformanceChart from './ClassPerformanceChart';
import ParticipationChart from './ParticipationChart';
import PerformanceTrendsChart from './PerformanceTrendsChart';

interface GraficosProps {
  userProfile: { unidade: string } | null;
  selectedSystem: 'prova-parana' | 'parceiro';
}

const Graficos: React.FC<GraficosProps> = ({ userProfile, selectedSystem }) => {
  const [data, setData] = useState<ProvaResultado[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilters, setSelectedFilters] = useState({
    ano_escolar: '',
    componente: '',
    semestre: ''
  });

  useEffect(() => {
    loadData();
  }, [selectedFilters, userProfile]);

  const loadData = async () => {
    setLoading(true);
    try {
      const filters = {
        unidade: userProfile?.unidade,
        ...Object.fromEntries(
          Object.entries(selectedFilters).filter(([_, value]) => value !== '')
        )
      };
      
      // Busca TODOS os dados sem limitação para gráficos
      const fetchFn = selectedSystem === 'prova-parana' ? fetchAllProvaData : fetchAllProvaDataParceiro;
      const result = await fetchFn(filters);
      setData(result || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Processar dados para remover duplicatas de alunos
  const processedData = React.useMemo(() => {
    const uniqueStudents = new Map<string, ProvaResultado>();
    
    data.forEach(item => {
      const studentKey = `${item.nome_aluno}-${item.turma}-${item.componente}-${item.semestre}`;
      if (!uniqueStudents.has(studentKey) || item.avaliado) {
        uniqueStudents.set(studentKey, item);
      }
    });
    
    return Array.from(uniqueStudents.values());
  }, [data, selectedSystem]);

  const updateFilter = (key: string, value: string) => {
    setSelectedFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando gráficos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 p-2 rounded-lg">
            <PieChart className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Análise Gráfica</h1>
            <p className="text-gray-600">
              Visualizações dos dados da {selectedSystem === 'prova-parana' ? 'Prova Paraná Recomposição' : 'Avaliação Parceiro da Escola'}
            </p>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          {userProfile?.unidade}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ano Escolar
            </label>
            <select
              value={selectedFilters.ano_escolar}
              onChange={(e) => updateFilter('ano_escolar', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Todos</option>
              {selectedSystem === 'prova-parana' ? (
                <>
                  <option value="9º ano">9º ano</option>
                  <option value="3º ano">3º ano</option>
                </>
              ) : (
                <>
                  <option value="8º ano">8º ano</option>
                  <option value="2º ano">2º ano</option>
                </>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Componente
            </label>
            <select
              value={selectedFilters.componente}
              onChange={(e) => updateFilter('componente', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Todos</option>
              <option value="LP">Língua Portuguesa</option>
              <option value="MT">Matemática</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Semestre
            </label>
            <select
              value={selectedFilters.semestre}
              onChange={(e) => updateFilter('semestre', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Todos</option>
              <option value="1">1º Semestre</option>
              <option value="2">2º Semestre</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid de Gráficos */}
      <div className="grid lg:grid-cols-2 gap-6">
        <PerformanceByGradeChart data={processedData} selectedSystem={selectedSystem}/>
        <ComponentComparisonChart data={processedData} selectedSystem={selectedSystem}/>
        <LearningLevelsChart data={processedData} selectedSystem={selectedSystem} />
        <SkillsPerformanceChart data={data} selectedSystem={selectedSystem}/>
        <SemesterComparisonChart data={processedData} selectedSystem={selectedSystem}/>
        
        <ParticipationChart data={data} selectedSystem={selectedSystem}/>
        <PerformanceTrendsChart data={data} selectedSystem={selectedSystem}/>
      </div>
    </div>
  );
};

export default Graficos;