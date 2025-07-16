import React from 'react';
import { BarChart3 } from 'lucide-react';
import { PerformanceInsight } from '../../types';

interface PerformanceChartProps {
  insights: PerformanceInsight;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ insights }) => {
  const maxQuantidade = Math.max(...insights.distribuicao_niveis.map(item => item.quantidade), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-green-100 p-2 rounded-lg">
          <BarChart3 className="w-5 h-5 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Distribuição por Nível de Aprendizagem
        </h3>
      </div>

      <div className="space-y-4">
        {insights.distribuicao_niveis.length > 0 ? (
          insights.distribuicao_niveis.map((nivel, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">
                  {nivel.nivel}
                </span>
                <span className="text-sm text-gray-500">
                  {nivel.quantidade} ({nivel.percentual.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(nivel.quantidade / maxQuantidade) * 100}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum dado disponível</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceChart;