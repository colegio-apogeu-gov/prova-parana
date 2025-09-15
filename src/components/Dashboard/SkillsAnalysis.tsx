import React from 'react';
import { Target } from 'lucide-react';
import { PerformanceInsight } from '../../types';

interface SkillsAnalysisProps {
  insights: PerformanceInsight;
}

const SkillsAnalysis: React.FC<SkillsAnalysisProps> = ({ insights }) => {
  const sortedSkills = insights.performance_habilidades
    .sort((a, b) => a.percentual_medio - b.percentual_medio)
    .slice(0, 10);

  const getPerformanceColor = (percentual: number) => {
    if (percentual >= 70) return 'bg-green-500';
    if (percentual >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-orange-100 p-2 rounded-lg">
          <Target className="w-5 h-5 text-orange-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Performance por Descritor (Percentual de Acertos)
        </h3>
      </div>

      <div className="space-y-3">
        {sortedSkills.length > 0 ? (
          sortedSkills.map((skill, index) => (
            <div key={index} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {skill.habilidade_codigo}
                  </p>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {skill.descricao}
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-700 ml-2">
                  {skill.percentual_medio.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getPerformanceColor(skill.percentual_medio)}`}
                  style={{ width: `${Math.min(skill.percentual_medio, 100)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum dado de habilidades disponível</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SkillsAnalysis;