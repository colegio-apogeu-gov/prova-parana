import React from 'react';
import { TrendingUp } from 'lucide-react';
import { ProvaResultado, ProvaResultadoParceiro } from '../../types';

interface ParticipationComparisonChartProps {
  dataParana: ProvaResultado[];
  dataParceiro: ProvaResultadoParceiro[];
}

const ParticipationComparisonChart: React.FC<ParticipationComparisonChartProps> = ({ 
  dataParana, 
  dataParceiro 
}) => {
  const participationData = React.useMemo(() => {
    // Calcular participação Prova Paraná
    const uniqueStudentsParana = new Set<string>();
    const evaluatedStudentsParana = new Set<string>();

    dataParana.forEach(item => {
      const studentKey = `${item.nome_aluno}-${item.turma}`;
      uniqueStudentsParana.add(studentKey);
      if (item.avaliado) {
        evaluatedStudentsParana.add(studentKey);
      }
    });

    // Calcular participação Parceiro
    const uniqueStudentsParceiro = new Set<string>();
    const evaluatedStudentsParceiro = new Set<string>();

    dataParceiro.forEach(item => {
      const studentKey = `${item.nome_aluno}-${item.turma}`;
      uniqueStudentsParceiro.add(studentKey);
      if (item.avaliado) {
        evaluatedStudentsParceiro.add(studentKey);
      }
    });

    const paranaTotal = uniqueStudentsParana.size;
    const paranaParticipating = evaluatedStudentsParana.size;
    const paranaRate = paranaTotal > 0 ? (paranaParticipating / paranaTotal) * 100 : 0;

    const parceiroTotal = uniqueStudentsParceiro.size;
    const parceiroParticipating = evaluatedStudentsParceiro.size;
    const parceiroRate = parceiroTotal > 0 ? (parceiroParticipating / parceiroTotal) * 100 : 0;

    return {
      parana: {
        total: paranaTotal,
        participating: paranaParticipating,
        nonParticipating: paranaTotal - paranaParticipating,
        rate: paranaRate
      },
      parceiro: {
        total: parceiroTotal,
        participating: parceiroParticipating,
        nonParticipating: parceiroTotal - parceiroParticipating,
        rate: parceiroRate
      }
    };
  }, [dataParana, dataParceiro]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-cyan-100 p-2 rounded-lg">
          <TrendingUp className="w-5 h-5 text-cyan-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Comparação de Participação
        </h3>
      </div>

      <div className="space-y-8">
        {/* Prova Paraná */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
              <h4 className="text-sm font-semibold text-gray-700">Prova Paraná Recomposição</h4>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {participationData.parana.rate.toFixed(1)}%
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Participantes</span>
                <span className="text-sm font-semibold text-green-600">
                  {participationData.parana.participating}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${participationData.parana.total > 0
                      ? (participationData.parana.participating / participationData.parana.total) * 100
                      : 0}%`
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Não Participantes</span>
                <span className="text-sm font-semibold text-red-600">
                  {participationData.parana.nonParticipating}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-red-400 to-red-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${participationData.parana.total > 0
                      ? (participationData.parana.nonParticipating / participationData.parana.total) * 100
                      : 0}%`
                  }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Total de Alunos:</span>
                <span className="font-semibold">{participationData.parana.total}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Parceiro Escola */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-600 rounded-full"></div>
              <h4 className="text-sm font-semibold text-gray-700">Parceiro Escola</h4>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {participationData.parceiro.rate.toFixed(1)}%
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Participantes</span>
                <span className="text-sm font-semibold text-green-600">
                  {participationData.parceiro.participating}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${participationData.parceiro.total > 0
                      ? (participationData.parceiro.participating / participationData.parceiro.total) * 100
                      : 0}%`
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Não Participantes</span>
                <span className="text-sm font-semibold text-red-600">
                  {participationData.parceiro.nonParticipating}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-red-400 to-red-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${participationData.parceiro.total > 0
                      ? (participationData.parceiro.nonParticipating / participationData.parceiro.total) * 100
                      : 0}%`
                  }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Total de Alunos:</span>
                <span className="font-semibold">{participationData.parceiro.total}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Comparação Geral */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Resumo Comparativo</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Maior Participação:</span>
              <span className={`ml-2 font-semibold ${
                participationData.parana.rate > participationData.parceiro.rate 
                  ? 'text-blue-600' 
                  : participationData.parceiro.rate > participationData.parana.rate 
                    ? 'text-green-600' 
                    : 'text-gray-600'
              }`}>
                {participationData.parana.rate > participationData.parceiro.rate 
                  ? 'Prova Paraná' 
                  : participationData.parceiro.rate > participationData.parana.rate 
                    ? 'Parceiro Escola' 
                    : 'Empate'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Diferença:</span>
              <span className="ml-2 font-semibold text-gray-900">
                {Math.abs(participationData.parana.rate - participationData.parceiro.rate).toFixed(1)} pontos
              </span>
            </div>
          </div>
        </div>
      </div>

      {participationData.parana.total === 0 && participationData.parceiro.total === 0 && (
        <div className="text-center py-8 text-gray-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado disponível</p>
        </div>
      )}
    </div>
  );
};

export default ParticipationComparisonChart;