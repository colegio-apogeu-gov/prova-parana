import React from 'react';
import { BookOpen } from 'lucide-react';
import { ProvaResultado } from '../../types';

interface ComponentComparisonChartProps {
  data: ProvaResultado[];
}

const ComponentComparisonChart: React.FC<ComponentComparisonChartProps> = ({ data }) => {
  const componentData = React.useMemo(() => {
    const components = { LP: [], MT: [] } as Record<string, number[]>;
    
    data.forEach(item => {
      if (item.avaliado && item.componente in components) {
        components[item.componente].push(item.percentual);
      }
    });

    return Object.entries(components).map(([component, percentuals]) => ({
      component: component === 'LP' ? 'Língua Portuguesa' : 'Matemática',
      code: component,
      average: percentuals.length > 0 ? percentuals.reduce((a, b) => a + b, 0) / percentuals.length : 0,
      count: percentuals.length
    }));
  }, [data]);

  const maxAverage = Math.max(...componentData.map(item => item.average), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-orange-100 p-2 rounded-lg">
          <BookOpen className="w-5 h-5 text-orange-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Comparação por Componente
        </h3>
      </div>

      <div className="space-y-4">
        {componentData.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                {item.component}
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
                  item.code === 'LP' ? 'bg-gradient-to-r from-purple-400 to-purple-600' : 'bg-gradient-to-r from-orange-400 to-orange-600'
                }`}
                style={{ width: `${(item.average / maxAverage) * 100}%` }}
              />
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

export default ComponentComparisonChart;