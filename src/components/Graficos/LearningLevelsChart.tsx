import React from 'react';
import { Target } from 'lucide-react';
import { ProvaResultado } from '../../types';

interface LearningLevelsChartProps {
  data: ProvaResultado[];
  selectedSystem?: 'prova-parana' | 'parceiro';
}

const LearningLevelsChart: React.FC<LearningLevelsChartProps> = ({ data, selectedSystem = 'prova-parana' }) => {
  const levelsData = React.useMemo(() => {
    const levels: Record<string, number> = {};
    const uniqueStudents = new Set<string>();
    
    data.forEach(item => {
      const levelField = selectedSystem === 'prova-parana' ? item.nivel_aprendizagem : (item as any).padrao_desempenho;
      if (item.avaliado && levelField) {
        const studentKey = `${item.nome_aluno}-${item.turma}-${item.componente}-${item.semestre}`;
        if (!uniqueStudents.has(studentKey)) {
          uniqueStudents.add(studentKey);
          levels[levelField] = (levels[levelField] || 0) + 1;
        }
      }
    });

    const total = Object.values(levels).reduce((a, b) => a + b, 0);
    
    return Object.entries(levels)
      .map(([level, count]) => ({
        level,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const getColorClass = (index: number) => {
    const colors = [
      'bg-gradient-to-r from-green-400 to-green-600',
      'bg-gradient-to-r from-yellow-400 to-yellow-600',
      'bg-gradient-to-r from-red-400 to-red-600',
      'bg-gradient-to-r from-blue-400 to-blue-600',
      'bg-gradient-to-r from-purple-400 to-purple-600'
    ];
    return colors[index % colors.length];
  };

  const maxCount = Math.max(...levelsData.map(item => item.count), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-green-100 p-2 rounded-lg">
          <Target className="w-5 h-5 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          {selectedSystem === 'prova-parana' ? 'Distribuição por Nível de Aprendizagem' : 'Distribuição por Padrão de Desempenho'}
        </h3>
      </div>

      <div className="space-y-3">
        {levelsData.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {item.level}
              </span>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-900">
                  {item.count}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  ({item.percentage.toFixed(1)}%)
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${getColorClass(index)}`}
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {levelsData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado disponível</p>
        </div>
      )}
    </div>
  );
};

export default LearningLevelsChart;