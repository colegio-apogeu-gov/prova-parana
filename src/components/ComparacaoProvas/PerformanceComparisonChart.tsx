import React from 'react';
import { BarChart3 } from 'lucide-react';
import { ProvaResultado, ProvaResultadoParceiro } from '../../types';

interface PerformanceComparisonChartProps {
  dataParana: ProvaResultado[];
  dataParceiro: ProvaResultadoParceiro[];
}

const PerformanceComparisonChart: React.FC<PerformanceComparisonChartProps> = ({ 
  dataParana, 
  dataParceiro 
}) => {
  const comparisonData = React.useMemo(() => {
    // Processar dados Prova Paraná por ano
    const paranaByGrade = {
      '9º ano': [] as number[],
      '3º ano': [] as number[]
    };

    dataParana.forEach(item => {
      if (item.avaliado && item.ano_escolar in paranaByGrade) {
        paranaByGrade[item.ano_escolar].push(item.percentual);
      }
    });

    // Processar dados Parceiro por ano
    const parceiroByGrade = {
      '8º ano': [] as number[],
      '2º ano': [] as number[]
    };

    dataParceiro.forEach(item => {
      if (item.avaliado && item.ano_escolar in parceiroByGrade) {
        parceiroByGrade[item.ano_escolar].push(item.percentual);
      }
    });

    // Calcular médias
    const calculateAverage = (values: number[]) => 
      values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    return [
      {
        grade: '9º ano',
        system: 'Prova Paraná',
        average: calculateAverage(paranaByGrade['9º ano']),
        count: paranaByGrade['9º ano'].length,
        color: 'bg-gradient-to-r from-blue-400 to-blue-600'
      },
      {
        grade: '3º ano',
        system: 'Prova Paraná',
        average: calculateAverage(paranaByGrade['3º ano']),
        count: paranaByGrade['3º ano'].length,
        color: 'bg-gradient-to-r from-blue-500 to-blue-700'
      },
      {
        grade: '8º ano',
        system: 'Parceiro Escola',
        average: calculateAverage(parceiroByGrade['8º ano']),
        count: parceiroByGrade['8º ano'].length,
        color: 'bg-gradient-to-r from-green-400 to-green-600'
      },
      {
        grade: '2º ano',
        system: 'Parceiro Escola',
        average: calculateAverage(parceiroByGrade['2º ano']),
        count: parceiroByGrade['2º ano'].length,
        color: 'bg-gradient-to-r from-green-500 to-green-700'
      }
    ];
  }, [dataParana, dataParceiro]);

  const maxAverage = Math.max(...comparisonData.map(item => item.average), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-purple-100 p-2 rounded-lg">
          <BarChart3 className="w-5 h-5 text-purple-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Performance Média por Ano Escolar
        </h3>
      </div>

      <div className="space-y-4">
        {comparisonData.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">
                  {item.grade}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  item.system === 'Prova Paraná' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {item.system}
                </span>
              </div>
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
                className={`h-3 rounded-full transition-all duration-300 ${item.color}`}
                style={{ width: `${(item.average / maxAverage) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {comparisonData.every(item => item.count === 0) && (
        <div className="text-center py-8 text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado disponível</p>
        </div>
      )}
    </div>
  );
};

export default PerformanceComparisonChart;