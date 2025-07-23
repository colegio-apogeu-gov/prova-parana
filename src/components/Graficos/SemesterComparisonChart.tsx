import React from 'react';
import { Calendar } from 'lucide-react';
import { ProvaResultado } from '../../types';

interface SemesterComparisonChartProps {
  data: ProvaResultado[];
}

const SemesterComparisonChart: React.FC<SemesterComparisonChartProps> = ({ data }) => {
  const semesterData = React.useMemo(() => {
    const semesters = { '1': [], '2': [] } as Record<string, number[]>;
    
    data.forEach(item => {
      if (item.avaliado && item.semestre in semesters) {
        semesters[item.semestre].push(item.percentual);
      }
    });

    return Object.entries(semesters).map(([semester, percentuals]) => ({
      semester: `${semester}º Semestre`,
      average: percentuals.length > 0 ? percentuals.reduce((a, b) => a + b, 0) / percentuals.length : 0,
      count: percentuals.length
    }));
  }, [data]);

  const maxAverage = Math.max(...semesterData.map(item => item.average), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-100 p-2 rounded-lg">
          <Calendar className="w-5 h-5 text-indigo-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Comparação por Semestre
        </h3>
      </div>

      <div className="space-y-4">
        {semesterData.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {item.semester}
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
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  index === 0 ? 'bg-gradient-to-r from-indigo-400 to-indigo-600' : 'bg-gradient-to-r from-cyan-400 to-cyan-600'
                }`}
                style={{ width: `${(item.average / maxAverage) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {semesterData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado disponível</p>
        </div>
      )}
    </div>
  );
};

export default SemesterComparisonChart;