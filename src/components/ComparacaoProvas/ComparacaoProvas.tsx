import React, { useState, useEffect } from 'react';
import { GitCompare, Filter, Users, BarChart3, TrendingUp, Target } from 'lucide-react';
import { fetchAllProvaData } from '../../lib/supabase';
import { fetchAllProvaDataParceiro } from '../../lib/supabaseParceiro';
import { ProvaResultado, ProvaResultadoParceiro } from '../../types';
import FilterPanel from './FilterPanel';
import PerformanceComparisonChart from './PerformanceComparisonChart';
import ComponentComparisonChart from './ComponentComparisonChart';
import StudentComparisonChart from './StudentComparisonChart';
import LevelDistributionChart from './LevelDistributionChart';
import SkillsComparisonChart from './SkillsComparisonChart';
import ParticipationComparisonChart from './ParticipationComparisonChart';

interface ComparacaoProvasProps {
  userProfile: { unidade: string } | null;
}

export interface ComparisonFilters {
  unidade?: string;
  componente?: string;
  semestre?: string;
  // Filtros específicos para Prova Paraná
  ano_escolar_parana?: string;
  nivel_aprendizagem?: string;
  // Filtros específicos para Parceiro
  ano_escolar_parceiro?: string;
  padrao_desempenho?: string;
  // Comparação de alunos
  aluno_parana?: string;
  aluno_parceiro?: string;
}

const ComparacaoProvas: React.FC<ComparacaoProvasProps> = ({ userProfile }) => {
  const [dataParana, setDataParana] = useState<ProvaResultado[]>([]);
  const [dataParceiro, setDataParceiro] = useState<ProvaResultadoParceiro[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ComparisonFilters>(() => ({
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
    loadAllData();
  }, [filters]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Preparar filtros para cada sistema
      const paranaFilters = {
        unidade: filters.unidade,
        componente: filters.componente,
        semestre: filters.semestre,
        ano_escolar: filters.ano_escolar_parana,
        nivel_aprendizagem: filters.nivel_aprendizagem,
        nome_aluno: filters.aluno_parana
      };

      const parceiroFilters = {
        unidade: filters.unidade,
        componente: filters.componente,
        semestre: filters.semestre,
        ano_escolar: filters.ano_escolar_parceiro,
        padrao_desempenho: filters.padrao_desempenho,
        nome_aluno: filters.aluno_parceiro
      };

      // Carregar dados em paralelo
      const [paranaData, parceiroData] = await Promise.all([
        fetchAllProvaData(paranaFilters),
        fetchAllProvaDataParceiro(parceiroFilters)
      ]);

      setDataParana(paranaData || []);
      setDataParceiro(parceiroData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setDataParana([]);
      setDataParceiro([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-6"></div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Carregando Comparação</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p className="text-purple-600">⏳ Carregando dados da Prova Paraná Recomposição...</p>
            <p className="text-green-600">⏳ Carregando dados do Parceiro da Escola...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 p-2 rounded-lg">
            <GitCompare className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Comparação entre Provas</h1>
            <p className="text-gray-600">
              Análise comparativa entre Prova Paraná Recomposição e Avaliação Parceiro da Escola
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
      />

      {/* Cards de Resumo */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-600">Alunos Prova Paraná Recomposição</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {new Set(dataParana.map(item => `${item.nome_aluno}-${item.turma}`)).size}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="bg-green-100 p-2 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-600">Alunos Parceiro Escola</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {new Set(dataParceiro.map(item => `${item.nome_aluno}-${item.turma}`)).size}
            </p>
          </div>
        </div>

      </div>

      {/* Grid de Gráficos Comparativos */}
      <div className="grid lg:grid-cols-2 gap-6">
        <PerformanceComparisonChart 
          dataParana={dataParana} 
          dataParceiro={dataParceiro} 
        />
        <ComponentComparisonChart 
          dataParana={dataParana} 
          dataParceiro={dataParceiro} 
        />
        <LevelDistributionChart 
          dataParana={dataParana} 
          dataParceiro={dataParceiro} 
        />
        <ParticipationComparisonChart 
          dataParana={dataParana} 
          dataParceiro={dataParceiro} 
        />
      </div>

      {/* Gráficos de linha completa */}
      <div className="space-y-6">
        <SkillsComparisonChart 
          dataParana={dataParana} 
          dataParceiro={dataParceiro} 
        />
        
        {/* Comparação Individual de Alunos */}
        {(filters.aluno_parana || filters.aluno_parceiro) && (
          <StudentComparisonChart 
            dataParana={dataParana} 
            dataParceiro={dataParceiro}
            alunoParana={filters.aluno_parana}
            alunoParceiro={filters.aluno_parceiro}
          />
        )}
      </div>
    </div>
  );
};

export default ComparacaoProvas;