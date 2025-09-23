import React from 'react';
import { BookOpen } from 'lucide-react';
import { ProvaResultado, ProvaResultadoParceiro } from '../../types';

interface ComponentEvolutionChartProps {
  data: (ProvaResultado | ProvaResultadoParceiro)[];
  selectedSystem: 'prova-parana' | 'parceiro';
}

const ComponentEvolutionChart: React.FC<ComponentEvolutionChartProps> = ({ data, selectedSystem }) => {
  const componentData = React.useMemo(() => {
    const components = {
      LP: { '1': [], '2': [] },
      MT: { '1': [], '2': [] }
    } as Record<string, Record<string, number[]>>;

    data.forEach(item => {
      if (item.avaliado && item.componente in components && item.semestre in components[item.componente]) {
        components[item.componente][item.semestre].push(item.percentual);
      }
    });

    return Object.entries(components).map(([component, semesters]) => {
      const sem1Avg = semesters['1'].length > 0 ? semesters['1'].reduce((a, b) => a + b, 0) / semesters['1'].length : 0;
      const sem2Avg = semesters['2'].length > 0 ? semesters['2'].reduce((a, b) => a + b, 0) / semesters['2'].length : 0;
      
      return {
        component: component === 'LP' ? 'Língua Portuguesa' : 'Matemática',
        code: component,
        sem1Average: sem1Avg,
        sem2Average: sem2Avg,
        evolution: sem2Avg - sem1Avg,
        sem1Count: semesters['1'].length,
        sem2Count: semesters['2'].length
      };
    });
  }, [data]);

  const maxAverage = Math.max(
    ...componentData.flatMap(item => [item.sem1Average, item.sem2Average]),
    1
  );

  const systemColor = selectedSystem === 'prova-parana' ? 'blue' : 'green';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={`${selectedSystem === 'prova-parana' ? 'bg-orange-100' : 'bg-purple-100'} p-2 rounded-lg`}>
          <BookOpen className={`w-5 h-5 ${selectedSystem === 'prova-parana' ? 'text-orange-600' : 'text-purple-600'}`} />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Evolução por Componente
        </h3>
      </div>

      <div className="space-y-6">
        {componentData.map((item) => (
          <div key={item.code} className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700">{item.component}</h4>
              <div className={`flex items-center gap-2 text-sm ${
                item.evolution > 0 ? 'text-green-600' : 
                item.evolution < 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {item.evolution > 0 ? '📈' : item.evolution < 0 ? '📉' : '➡️'}
                <span className="font-semibold">
                  {item.evolution >= 0 ? '+' : ''}{item.evolution.toFixed(1)}
                </span>
              </div>
            </div>
            
            {/* 1º Semestre */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">1º Semestre</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-900">
                    {item.sem1Average.toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({item.sem1Count})
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    item.code === 'LP' 
                      ? 'bg-gradient-to-r from-purple-400 to-purple-500'
                      : 'bg-gradient-to-r from-orange-400 to-orange-500'
                  }`}
                  style={{ width: `${(item.sem1Average / maxAverage) * 100}%` }}
                />
              </div>
            </div>

            {/* 2º Semestre */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">2º Semestre</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-900">
                    {item.sem2Average.toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({item.sem2Count})
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    item.code === 'LP' 
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600'
                      : 'bg-gradient-to-r from-orange-500 to-orange-600'
                  }`}
                  style={{ width: `${(item.sem2Average / maxAverage) * 100}%` }}
                />
              </div>
            </div>

            {/* Resumo da Evolução */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-600">
                <strong>Análise:</strong> {
                  item.evolution > 2 ? `Melhoria significativa de ${item.evolution.toFixed(1)} pontos` :
                  item.evolution < -2 ? `Declínio significativo de ${Math.abs(item.evolution).toFixed(1)} pontos` :
                  item.evolution > 0 ? `Leve melhoria de ${item.evolution.toFixed(1)} pontos` :
                  item.evolution < 0 ? `Leve declínio de ${Math.abs(item.evolution).toFixed(1)} pontos` :
                  'Performance estável entre semestres'
                }
              </div>
            </div>
          </div>
        ))}
      </div>

      {componentData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado disponível</p>
        </div>
      )}
    </div>
  );
};

export default ComponentEvolutionChart;