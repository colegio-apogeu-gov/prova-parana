import React from 'react';
import { Award } from 'lucide-react';
import { ProvaResultado } from '../../types';

interface SkillsPerformanceChartProps {
  data: ProvaResultado[];
}

const SkillsPerformanceChart: React.FC<SkillsPerformanceChartProps> = ({ data }) => {
  const skillsData = React.useMemo(() => {
    const skills: Record<string, { 
      total_acertos: number; 
      total_questoes: number; 
      count: number;
      habilidade_codigo: string;
      descricao_habilidade: string;
    }> = {};
    
    data.forEach(item => {
      if (item.avaliado && item.habilidade_id) {
        if (!skills[item.habilidade_id]) {
          skills[item.habilidade_id] = { 
            total_acertos: 0, 
            total_questoes: 0, 
            count: 0,
            habilidade_codigo: item.habilidade_codigo,
            descricao_habilidade: item.descricao_habilidade
          };
        }
        skills[item.habilidade_id].total_acertos += item.acertos;
        skills[item.habilidade_id].total_questoes += item.total;
        skills[item.habilidade_id].count += 1;
      }
    });

    return Object.entries(skills)
      .map(([skill, data]) => ({
        skill,
        habilidade_codigo: data.habilidade_codigo,
        descricao: data.descricao_habilidade,
        average: data.total_questoes > 0 ? (data.total_acertos / data.total_questoes) * 100 : 0,
        count: data.count
      }))
      .sort((a, b) => a.average - b.average)
      .slice(0, 10); // Top 10 piores habilidades
  }, [data]);

  const getPerformanceColor = (average: number) => {
    if (average >= 70) return 'bg-gradient-to-r from-green-400 to-green-600';
    if (average >= 50) return 'bg-gradient-to-r from-yellow-400 to-yellow-600';
    return 'bg-gradient-to-r from-red-400 to-red-600';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-red-100 p-2 rounded-lg">
          <Award className="w-5 h-5 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Habilidades com Menor Performance
        </h3>
      </div>

      <div className="space-y-3">
        {skillsData.map((item, index) => (
          <div key={index} className="p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {item.habilidade_codigo} - {item.skill}
                </p>
                <p className="text-xs text-gray-600 line-clamp-2">
                  {item.descricao}
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-700 ml-2">
                {item.average.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getPerformanceColor(item.average)}`}
                style={{ width: `${Math.min(item.average, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {skillsData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado disponível</p>
        </div>
      )}
    </div>
  );
};

export default SkillsPerformanceChart;