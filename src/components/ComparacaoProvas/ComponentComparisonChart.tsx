import React from 'react';
import { BookOpen } from 'lucide-react';
import { ProvaResultado, ProvaResultadoParceiro } from '../../types';

interface ComponentComparisonChartProps {
  dataParana: ProvaResultado[];
  dataParceiro: ProvaResultadoParceiro[];
}

const ComponentComparisonChart: React.FC<ComponentComparisonChartProps> = ({ 
  dataParana, 
  dataParceiro 
}) => {
  const comparisonData = React.useMemo(() => {
    // Processar dados por componente
    const paranaByComponent = {
      LP: [] as number[],
      MT: [] as number[]
    };

    const parceiroByComponent = {
      LP: [] as number[],
      MT: [] as number[]
    };

    dataParana.forEach(item => {
      if (item.avaliado && item.componente in paranaByComponent) {
        paranaByComponent[item.componente].push(item.percentual);
      }
    });

    dataParceiro.forEach(item => {
      if (item.avaliado && item.componente in parceiroByComponent) {
        parceiroByComponent[item.componente].push(item.percentual);
      }
    });

    const calculateAverage = (values: number[]) => 
      values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    return [
      {
        component: 'Língua Portuguesa',
        code: 'LP',
        paranaAverage: calculateAverage(paranaByComponent.LP),
        parceiroAverage: calculateAverage(parceiroByComponent.LP),
        paranaCount: paranaByComponent.LP.length,
        parceiroCount: parceiroByComponent.LP.length
      },
      {
        component: 'Matemática',
        code: 'MT',
        paranaAverage: calculateAverage(paranaByComponent.MT),
        parceiroAverage: calculateAverage(parceiroByComponent.MT),
        paranaCount: paranaByComponent.MT.length,
        parceiroCount: parceiroByComponent.MT.length
      }
    ];
  }, [dataParana, dataParceiro]);

  const maxAverage = Math.max(
    ...comparisonData.flatMap(item => [item.paranaAverage, item.parceiroAverage]),
    1
  );

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

      <div className="space-y-6">
        {comparisonData.map((item) => (
          <div key={item.code} className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700">{item.component}</h4>
            
            {/* Prova Paraná */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                  <span className="text-sm text-gray-600">Prova Paraná Recomposição</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-blue-600">
                    {item.paranaAverage.toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({item.paranaCount})
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(item.paranaAverage / maxAverage) * 100}%` }}
                />
              </div>
            </div>

            {/* Parceiro Escola */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                  <span className="text-sm text-gray-600">Parceiro Escola</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-green-600">
                    {item.parceiroAverage.toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({item.parceiroCount})
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(item.parceiroAverage / maxAverage) * 100}%` }}
                />
              </div>
            </div>

            {/* Diferença */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Diferença:</span>
                <span className={`text-xs font-semibold ${
                  item.paranaAverage > item.parceiroAverage 
                    ? 'text-blue-600' 
                    : item.parceiroAverage > item.paranaAverage 
                      ? 'text-green-600' 
                      : 'text-gray-600'
                }`}>
                  {Math.abs(item.paranaAverage - item.parceiroAverage).toFixed(1)} pontos
                  {item.paranaAverage > item.parceiroAverage && ' (Prova Paraná Recomposição)'}
                  {item.parceiroAverage > item.paranaAverage && ' (Parceiro Escola)'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {comparisonData.every(item => item.paranaCount === 0 && item.parceiroCount === 0) && (
        <div className="text-center py-8 text-gray-500">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado disponível</p>
        </div>
      )}
    </div>
  );
};

export default ComponentComparisonChart;