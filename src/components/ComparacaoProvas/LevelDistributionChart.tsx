import React from 'react';
import { Target } from 'lucide-react';
import { ProvaResultado, ProvaResultadoParceiro } from '../../types';

interface LevelDistributionChartProps {
  dataParana: ProvaResultado[];
  dataParceiro: ProvaResultadoParceiro[];
}

const LevelDistributionChart: React.FC<LevelDistributionChartProps> = ({ 
  dataParana, 
  dataParceiro 
}) => {
const distributionData = React.useMemo(() => {
  // Mapeamento dos níveis
  const nivelMap: Record<string, string> = {
    'Adequado': 'Aprendizado Adequado',
    'Básico': 'Aprendizado Intermediário',
    'Abaixo do Básico': 'Defasagem',
  };

  // Processar níveis Prova Paraná
  const paranaLevels: Record<string, number> = {};
  const uniqueStudentsParana = new Set<string>();
  
  dataParana.forEach(item => {
    if (item.avaliado && item.nivel_aprendizagem) {
      const studentKey = `${item.nome_aluno}-${item.turma}-${item.componente}-${item.semestre}`;
      if (!uniqueStudentsParana.has(studentKey)) {
        uniqueStudentsParana.add(studentKey);
        paranaLevels[item.nivel_aprendizagem] = (paranaLevels[item.nivel_aprendizagem] || 0) + 1;
      }
    }
  });

  // Processar padrões Parceiro (com mapeamento para os níveis equivalentes)
  const parceiroLevels: Record<string, number> = {};
  const uniqueStudentsParceiro = new Set<string>();
  
  dataParceiro.forEach(item => {
    if (item.avaliado && item.padrao_desempenho) {
      const studentKey = `${item.nome_aluno}-${item.turma}-${item.componente}-${item.semestre}`;
      if (!uniqueStudentsParceiro.has(studentKey)) {
        uniqueStudentsParceiro.add(studentKey);
        const mappedLevel = nivelMap[item.padrao_desempenho] || item.padrao_desempenho;
        parceiroLevels[mappedLevel] = (parceiroLevels[mappedLevel] || 0) + 1;
      }
    }
  });

  const totalParana = Object.values(paranaLevels).reduce((a, b) => a + b, 0);
  const totalParceiro = Object.values(parceiroLevels).reduce((a, b) => a + b, 0);

  // Combinar todos os níveis/padrões únicos
  const allLevels = new Set([
    ...Object.keys(paranaLevels),
    ...Object.keys(parceiroLevels)
  ]);

  return Array.from(allLevels).map(level => ({
    level,
    paranaCount: paranaLevels[level] || 0,
    parceiroCount: parceiroLevels[level] || 0,
    paranaPercentage: totalParana > 0 ? ((paranaLevels[level] || 0) / totalParana) * 100 : 0,
    parceiroPercentage: totalParceiro > 0 ? ((parceiroLevels[level] || 0) / totalParceiro) * 100 : 0
  })).sort((a, b) => (b.paranaCount + b.parceiroCount) - (a.paranaCount + a.parceiroCount));
}, [dataParana, dataParceiro]);


  const maxCount = Math.max(
    ...distributionData.flatMap(item => [item.paranaCount, item.parceiroCount]),
    1
  );

  const getColorClass = (index: number, isParana: boolean) => {
    const paranaColors = [
      'bg-gradient-to-r from-blue-400 to-blue-600',
      'bg-gradient-to-r from-blue-500 to-blue-700',
      'bg-gradient-to-r from-blue-600 to-blue-800'
    ];
    const parceiroColors = [
      'bg-gradient-to-r from-green-400 to-green-600',
      'bg-gradient-to-r from-green-500 to-green-700',
      'bg-gradient-to-r from-green-600 to-green-800'
    ];
    
    const colors = isParana ? paranaColors : parceiroColors;
    return colors[index % colors.length];
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-100 p-2 rounded-lg">
          <Target className="w-5 h-5 text-indigo-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Distribuição de Níveis/Padrões
        </h3>
      </div>

      <div className="space-y-6">
        {distributionData.map((item, index) => (
          <div key={item.level} className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 truncate" title={item.level}>
              {item.level}
            </h4>
            
            {/* Prova Paraná */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                  <span className="text-sm text-gray-600">Prova Paraná Recomposição</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-blue-600">
                    {item.paranaCount}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({item.paranaPercentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getColorClass(index, true)}`}
                  style={{ width: `${(item.paranaCount / maxCount) * 100}%` }}
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
                    {item.parceiroCount}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    ({item.parceiroPercentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getColorClass(index, false)}`}
                  style={{ width: `${(item.parceiroCount / maxCount) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {distributionData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado disponível</p>
        </div>
      )}
    </div>
  );
};

export default LevelDistributionChart;