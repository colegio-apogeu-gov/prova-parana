import React from 'react';
import { BarChart3 } from 'lucide-react';
import { ProvaResultado } from '../../types';

interface PerformanceByGradeChartProps {
  data: ProvaResultado[];
  selectedSystem: 'prova-parana' | 'parceiro';
}

const PerformanceByGradeChart: React.FC<PerformanceByGradeChartProps> = ({ data, selectedSystem }) => {
const gradeData = React.useMemo(() => {
  const grades =
    selectedSystem === 'prova-parana'
      ? { '9º ano': [], '3º ano': [] }
      : { '8º ano': [], '2º ano': [] };

  data.forEach(item => {
    if (item.avaliado && item.ano_escolar in grades) {
      grades[item.ano_escolar].push(item.percentual);
    }
  });

  return Object.entries(grades).map(([grade, percentuals]) => ({
    grade,
    average:
      percentuals.length > 0
        ? percentuals.reduce((a, b) => a + b, 0) / percentuals.length
        : 0,
    count: percentuals.length,
  }));
}, [data, selectedSystem]);


  const maxAverage = Math.max(...gradeData.map(item => item.average), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-100 p-2 rounded-lg">
          <BarChart3 className="w-5 h-5 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Performance por Ano Escolar
        </h3>
      </div>

      <div className="space-y-4">
        {gradeData.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {item.grade}
              </span>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-900">
                  {item.average.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  ({item.count/2} alunos)
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  index === 0 ? 'bg-gradient-to-r from-blue-400 to-blue-600' : 'bg-gradient-to-r from-green-400 to-green-600'
                }`}
                style={{ width: `${(item.average / maxAverage) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {gradeData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado disponível</p>
        </div>
      )}
    </div>
  );
};

export default PerformanceByGradeChart;