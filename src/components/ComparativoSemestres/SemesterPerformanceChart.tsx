import React from 'react';
import { BarChart3 } from 'lucide-react';
import { ProvaResultado, ProvaResultadoParceiro } from '../../types';

interface SemesterPerformanceChartProps {
  data: (ProvaResultado | ProvaResultadoParceiro)[];
  selectedSystem: 'prova-parana' | 'parceiro';
}

const SemesterPerformanceChart: React.FC<SemesterPerformanceChartProps> = ({ data, selectedSystem }) => {
  const performanceData = React.useMemo(() => {
    const semesters = { '1': [], '2': [] } as Record<string, number[]>;

    data.forEach(item => {
      if (item.avaliado && item.semestre in semesters) {
        semesters[item.semestre].push(item.percentual);
      }
    });

    return Object.entries(semesters).map(([semester, percentuals]) => ({
      semester: `${semester}º Semestre`,
      average: percentuals.length > 0 ? percentuals.reduce((a, b) => a + b, 0) / percentuals.length : 0,
      count: percentuals.length,
      students: Math.floor(percentuals.length / 2) // Aproximação considerando múltiplas habilidades por aluno
    }));
  }, [data]);

  const maxAverage = Math.max(...performanceData.map(item => item.average), 1);
  const evolution = performanceData.length === 2 ? performanceData[1].average - performanceData[0].average : 0;
  const systemColor = selectedSystem === 'prova-parana' ? 'blue' : 'green';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={`${selectedSystem === 'prova-parana' ? 'bg-blue-100' : 'bg-green-100'} p-2 rounded-lg`}>
          <BarChart3 className={`w-5 h-5 ${selectedSystem === 'prova-parana' ? 'text-blue-600' : 'text-green-600'}`} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            Performance Geral por Semestre
          </h3>
          {evolution !== 0 && (
            <p className={`text-sm ${evolution > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {evolution > 0 ? '↗' : '↘'} {Math.abs(evolution).toFixed(1)} pontos de {evolution > 0 ? 'melhoria' : 'declínio'}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {performanceData.map((item, index) => (
          <div key={item.semester} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {item.semester}
              </span>
              <div className="text-right">
                <span className="text-sm font-semibold text-gray-900">
                  {item.average.toFixed(1)}%
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  (~{item.students} alunos)
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  index === 0 
                    ? `bg-gradient-to-r from-${systemColor}-400 to-${systemColor}-500`
                    : `bg-gradient-to-r from-${systemColor}-500 to-${systemColor}-600`
                }`}
                style={{ width: `${(item.average / maxAverage) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Resumo da Evolução */}
      {performanceData.length === 2 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Evolução Geral:</span>
            <div className={`flex items-center gap-2 ${
              evolution > 0 ? 'text-green-600' : evolution < 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {evolution > 0 ? '📈' : evolution < 0 ? '📉' : '➡️'}
              <span className="font-semibold">
                {evolution >= 0 ? '+' : ''}{evolution.toFixed(1)} pontos
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {evolution > 2 ? 'Melhoria significativa entre semestres' :
             evolution < -2 ? 'Declínio significativo entre semestres' :
             'Performance estável entre semestres'}
          </p>
        </div>
      )}

      {performanceData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado disponível</p>
        </div>
      )}
    </div>
  );
};

export default SemesterPerformanceChart;