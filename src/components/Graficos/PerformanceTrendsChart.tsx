import React from 'react';
import { TrendingUp } from 'lucide-react';
import { ProvaResultado } from '../../types';

interface PerformanceTrendsChartProps {
  data: ProvaResultado[];
}

const PerformanceTrendsChart: React.FC<PerformanceTrendsChartProps> = ({ data }) => {
  const trendsData = React.useMemo(() => {
    // Agrupa por faixas de performance
    const ranges = {
      'Excelente (90-100%)': 0,
      'Bom (70-89%)': 0,
      'Regular (50-69%)': 0,
      'Insuficiente (0-49%)': 0
    };

    const uniqueStudents = new Set<string>();
    
    data.forEach(item => {
      if (item.avaliado) {
        const studentKey = `${item.nome_aluno}-${item.turma}-${item.componente}-${item.semestre}`;
        if (!uniqueStudents.has(studentKey)) {
          uniqueStudents.add(studentKey);
          
          if (item.percentual >= 90) {
            ranges['Excelente (90-100%)']++;
          } else if (item.percentual >= 70) {
            ranges['Bom (70-89%)']++;
          } else if (item.percentual >= 50) {
            ranges['Regular (50-69%)']++;
          } else {
            ranges['Insuficiente (0-49%)']++;
          }
        }
      }
    });

    const total = Object.values(ranges).reduce((a, b) => a + b, 0);
    
    return Object.entries(ranges).map(([range, count]) => ({
      range,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    }));
  }, [data]);

  const getColorClass = (range: string) => {
    if (range.includes('Excelente')) return 'bg-gradient-to-r from-green-400 to-green-600';
    if (range.includes('Bom')) return 'bg-gradient-to-r from-blue-400 to-blue-600';
    if (range.includes('Regular')) return 'bg-gradient-to-r from-yellow-400 to-yellow-600';
    return 'bg-gradient-to-r from-red-400 to-red-600';
  };

  const maxCount = Math.max(...trendsData.map(item => item.count), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-pink-100 p-2 rounded-lg">
          <TrendingUp className="w-5 h-5 text-pink-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Distribuição por Faixa de Performance
        </h3>
      </div>

      <div className="space-y-3">
        {trendsData.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {item.range}
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
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getColorClass(item.range)}`}
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {trendsData.every(item => item.count === 0) && (
        <div className="text-center py-8 text-gray-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado disponível</p>
        </div>
      )}
    </div>
  );
};

export default PerformanceTrendsChart;