import React from 'react';
import { Users } from 'lucide-react';
import { ProvaResultado } from '../../types';

interface ClassPerformanceChartProps {
  data: ProvaResultado[];
}

const ClassPerformanceChart: React.FC<ClassPerformanceChartProps> = ({ data }) => {
  const classData = React.useMemo(() => {
    const classes: Record<string, number[]> = {};
    
    data.forEach(item => {
      if (item.avaliado && item.turma) {
        if (!classes[item.turma]) {
          classes[item.turma] = [];
        }
        classes[item.turma].push(item.percentual);
      }
    });

    return Object.entries(classes)
      .map(([turma, percentuals]) => ({
        turma,
        average: percentuals.length > 0 ? percentuals.reduce((a, b) => a + b, 0) / percentuals.length : 0,
        count: percentuals.length
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, 8); // Top 8 turmas
  }, [data]);

  const maxAverage = Math.max(...classData.map(item => item.average), 1);

  const getColorClass = (index: number) => {
    const colors = [
      'bg-gradient-to-r from-emerald-400 to-emerald-600',
      'bg-gradient-to-r from-blue-400 to-blue-600',
      'bg-gradient-to-r from-purple-400 to-purple-600',
      'bg-gradient-to-r from-pink-400 to-pink-600',
      'bg-gradient-to-r from-orange-400 to-orange-600',
      'bg-gradient-to-r from-teal-400 to-teal-600',
      'bg-gradient-to-r from-cyan-400 to-cyan-600',
      'bg-gradient-to-r from-lime-400 to-lime-600'
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-emerald-100 p-2 rounded-lg">
          <Users className="w-5 h-5 text-emerald-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Performance por Turma
        </h3>
      </div>

      <div className="space-y-3">
        {classData.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                Turma {item.turma}
              </span>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-900">
                  {item.average.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  ({item.count} avaliações)
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getColorClass(index)}`}
                style={{ width: `${(item.average / maxAverage) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {classData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado disponível</p>
        </div>
      )}
    </div>
  );
};

export default ClassPerformanceChart;