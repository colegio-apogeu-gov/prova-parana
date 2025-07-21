import React, { useState, useEffect } from 'react';
import { BarChart3, Users, TrendingUp, Filter } from 'lucide-react';
import { fetchProvaData } from '../../lib/supabase';
import { DashboardFilters, ProvaResultado, PerformanceInsight } from '../../types';
import FilterPanel from './FilterPanel';
import StatsCards from './StatsCards';
import PerformanceChart from './PerformanceChart';
import SkillsAnalysis from './SkillsAnalysis';
import StudentsSection from './StudentsSection';

interface DashboardProps {
  userProfile: { unidade: string } | null;
}

const Dashboard: React.FC<DashboardProps> = ({ userProfile }) => {
  const [data, setData] = useState<ProvaResultado[]>([]);
  const [filters, setFilters] = useState<DashboardFilters>({ 
    unidade: userProfile?.unidade 
  });
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<PerformanceInsight>({
    total_alunos: 0,
    alunos_avaliados: 0,
    percentual_participacao: 0,
    distribuicao_niveis: [],
    performance_habilidades: []
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchProvaData(filters);
      setData(result || []);
      processInsights(result || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setData([]);
      processInsights([]);
    } finally {
      setLoading(false);
    }
  };

  const processInsights = (data: ProvaResultado[]) => {
    const uniqueStudents = new Set(data.map(item => `${item.nome_aluno}-${item.turma}`));
    const evaluatedStudents = new Set(
      data.filter(item => item.avaliado).map(item => `${item.nome_aluno}-${item.turma}`)
    );

    // Contar níveis de aprendizagem por aluno único (considerando componente e semestre)
    const studentLevels = new Map<string, string>();
    
    data.forEach(item => {
      if (item.nivel_aprendizagem && item.avaliado) {
        const studentKey = `${item.nome_aluno}-${item.turma}-${item.componente}-${item.semestre}`;
        studentLevels.set(studentKey, item.nivel_aprendizagem);
      }
    });
    
    const levelDistribution = Array.from(studentLevels.values()).reduce((acc, nivel) => {
      acc[nivel] = (acc[nivel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const skillsPerformance = data.reduce((acc, item) => {
      if (item.habilidade_id && item.avaliado) {
        if (!acc[item.habilidade_id]) {
          acc[item.habilidade_id] = {
            habilidade_id: item.habilidade_id,
            habilidade_codigo: item.habilidade_codigo,
            descricao: item.descricao_habilidade,
            total_acertos: 0,
            total_questoes: 0,
            count: 0
          };
        }
        acc[item.habilidade_id].total_acertos += item.acertos;
        acc[item.habilidade_id].total_questoes += item.total;
        acc[item.habilidade_id].count += 1;
      }
      return acc;
    }, {} as Record<string, any>);

    const performanceHabilidades = Object.values(skillsPerformance).map((skill: any) => ({
      habilidade_id: skill.habilidade_id,
      habilidade_codigo: skill.habilidade_codigo,
      descricao: skill.descricao,
      media_acertos: skill.total_acertos / skill.count,
      total_questoes: skill.total_questoes / skill.count,
      percentual_medio: (skill.total_acertos / skill.total_questoes) * 100
    }));

    setInsights({
      total_alunos: uniqueStudents.size,
      alunos_avaliados: evaluatedStudents.size,
      percentual_participacao: uniqueStudents.size > 0 ? (evaluatedStudents.size / uniqueStudents.size) * 100 : 0,
      distribuicao_niveis: Object.entries(levelDistribution).map(([nivel, quantidade]) => ({
        nivel,
        quantidade,
        percentual: studentLevels.size > 0 ? (quantidade / studentLevels.size) * 100 : 0
      })),
      performance_habilidades: performanceHabilidades
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-lg">
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Análise de Performance - Prova Paraná</p>
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <StatsCards insights={insights} />
          
          <div className="grid lg:grid-cols-2 gap-6">
            <PerformanceChart insights={insights} />
            <SkillsAnalysis insights={insights} />
          </div>
          
          <StudentsSection 
            filters={filters}
            userProfile={userProfile}
          />
        </>
      )}
    </div>
  );
};

export default Dashboard;