import React from 'react';
import { Users, Trophy, Target } from 'lucide-react';
import { ProvaResultado, ProvaResultadoParceiro } from '../../types';

interface StudentComparisonChartProps {
  dataParana: ProvaResultado[];
  dataParceiro: ProvaResultadoParceiro[];
  alunoParana?: string;
  alunoParceiro?: string;
}

const StudentComparisonChart: React.FC<StudentComparisonChartProps> = ({ 
  dataParana, 
  dataParceiro,
  alunoParana,
  alunoParceiro
}) => {
  const comparisonData = React.useMemo(() => {
    // Processar dados do aluno Prova Paraná
    const paranaStudentData = alunoParana ? dataParana.filter(item => 
      item.nome_aluno === alunoParana && item.avaliado
    ) : [];

    // Processar dados do aluno Parceiro
    const parceiroStudentData = alunoParceiro ? dataParceiro.filter(item => 
      item.nome_aluno === alunoParceiro && item.avaliado
    ) : [];

    // Agrupar por componente
    const paranaByComponent = {
      LP: [] as number[],
      MT: [] as number[]
    };

    const parceiroByComponent = {
      LP: [] as number[],
      MT: [] as number[]
    };

    paranaStudentData.forEach(item => {
      if (item.componente in paranaByComponent) {
        paranaByComponent[item.componente].push(item.percentual);
      }
    });

    parceiroStudentData.forEach(item => {
      if (item.componente in parceiroByComponent) {
        parceiroByComponent[item.componente].push(item.percentual);
      }
    });

    const calculateAverage = (values: number[]) => 
      values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    const paranaOverall = calculateAverage([
      ...paranaByComponent.LP,
      ...paranaByComponent.MT
    ]);

    const parceiroOverall = calculateAverage([
      ...parceiroByComponent.LP,
      ...parceiroByComponent.MT
    ]);

    return {
      parana: {
        nome: alunoParana || '',
        overall: paranaOverall,
        lp: calculateAverage(paranaByComponent.LP),
        mt: calculateAverage(paranaByComponent.MT),
        totalAvaliacoes: paranaStudentData.length,
        habilidades: paranaStudentData.length
      },
      parceiro: {
        nome: alunoParceiro || '',
        overall: parceiroOverall,
        lp: calculateAverage(parceiroByComponent.LP),
        mt: calculateAverage(parceiroByComponent.MT),
        totalAvaliacoes: parceiroStudentData.length,
        habilidades: parceiroStudentData.length
      }
    };
  }, [dataParana, dataParceiro, alunoParana, alunoParceiro]);

  if (!alunoParana && !alunoParceiro) {
    return null;
  }

  const maxScore = Math.max(
    comparisonData.parana.overall,
    comparisonData.parceiro.overall,
    comparisonData.parana.lp,
    comparisonData.parana.mt,
    comparisonData.parceiro.lp,
    comparisonData.parceiro.mt,
    1
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-100 p-2 rounded-lg">
          <Users className="w-5 h-5 text-indigo-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Comparação Individual de Alunos
        </h3>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Aluno Prova Paraná */}
        {alunoParana && (
          <div className="border border-blue-200 rounded-lg p-6 bg-blue-50">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-blue-900">{comparisonData.parana.nome}</h4>
                <p className="text-sm text-blue-700">Prova Paraná Recomposição</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Performance Geral */}
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">Performance Geral</span>
                  </div>
                  <span className="text-lg font-bold text-blue-600">
                    {comparisonData.parana.overall.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-400 to-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(comparisonData.parana.overall / maxScore) * 100}%` }}
                  />
                </div>
              </div>

              {/* Língua Portuguesa */}
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Língua Portuguesa</span>
                  <span className="text-sm font-semibold text-purple-600">
                    {comparisonData.parana.lp.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-purple-400 to-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(comparisonData.parana.lp / maxScore) * 100}%` }}
                  />
                </div>
              </div>

              {/* Matemática */}
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Matemática</span>
                  <span className="text-sm font-semibold text-orange-600">
                    {comparisonData.parana.mt.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-orange-400 to-orange-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(comparisonData.parana.mt / maxScore) * 100}%` }}
                  />
                </div>
              </div>

              {/* Estatísticas */}
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Estatísticas</span>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Total de Avaliações:</span>
                    <span className="font-semibold">{comparisonData.parana.totalAvaliacoes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Habilidades Avaliadas:</span>
                    <span className="font-semibold">{comparisonData.parana.habilidades}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Aluno Parceiro Escola */}
        {alunoParceiro && (
          <div className="border border-green-200 rounded-lg p-6 bg-green-50">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-600 p-2 rounded-lg">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-green-900">{comparisonData.parceiro.nome}</h4>
                <p className="text-sm text-green-700">Parceiro da Escola</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Performance Geral */}
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-700">Performance Geral</span>
                  </div>
                  <span className="text-lg font-bold text-green-600">
                    {comparisonData.parceiro.overall.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(comparisonData.parceiro.overall / maxScore) * 100}%` }}
                  />
                </div>
              </div>

              {/* Língua Portuguesa */}
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Língua Portuguesa</span>
                  <span className="text-sm font-semibold text-purple-600">
                    {comparisonData.parceiro.lp.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-purple-400 to-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(comparisonData.parceiro.lp / maxScore) * 100}%` }}
                  />
                </div>
              </div>

              {/* Matemática */}
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Matemática</span>
                  <span className="text-sm font-semibold text-orange-600">
                    {comparisonData.parceiro.mt.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-orange-400 to-orange-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(comparisonData.parceiro.mt / maxScore) * 100}%` }}
                  />
                </div>
              </div>

              {/* Estatísticas */}
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Estatísticas</span>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Total de Avaliações:</span>
                    <span className="font-semibold">{comparisonData.parceiro.totalAvaliacoes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Habilidades Avaliadas:</span>
                    <span className="font-semibold">{comparisonData.parceiro.habilidades}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resumo Comparativo */}
      {alunoParana && alunoParceiro && (
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Resumo Comparativo</h4>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">Performance Geral</div>
              <div className={`text-lg font-bold ${
                comparisonData.parana.overall > comparisonData.parceiro.overall 
                  ? 'text-blue-600' 
                  : comparisonData.parceiro.overall > comparisonData.parana.overall 
                    ? 'text-green-600' 
                    : 'text-gray-600'
              }`}>
                {comparisonData.parana.overall > comparisonData.parceiro.overall 
                  ? `${comparisonData.parana.nome} (Prova Paraná Recomposição)` 
                  : comparisonData.parceiro.overall > comparisonData.parana.overall 
                    ? `${comparisonData.parceiro.nome} (Parceiro)` 
                    : 'Empate'}
              </div>
              <div className="text-xs text-gray-500">
                Diferença: {Math.abs(comparisonData.parana.overall - comparisonData.parceiro.overall).toFixed(1)} pontos
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">Língua Portuguesa</div>
              <div className={`text-lg font-bold ${
                comparisonData.parana.lp > comparisonData.parceiro.lp 
                  ? 'text-blue-600' 
                  : comparisonData.parceiro.lp > comparisonData.parana.lp 
                    ? 'text-green-600' 
                    : 'text-gray-600'
              }`}>
                {comparisonData.parana.lp > comparisonData.parceiro.lp 
                  ? 'Prova Paraná Recomposição' 
                  : comparisonData.parceiro.lp > comparisonData.parana.lp 
                    ? 'Parceiro Escola' 
                    : 'Empate'}
              </div>
              <div className="text-xs text-gray-500">
                Diferença: {Math.abs(comparisonData.parana.lp - comparisonData.parceiro.lp).toFixed(1)} pontos
              </div>
            </div>

            <div className="text-center">
              <div className="text-sm text-gray-600 mb-1">Matemática</div>
              <div className={`text-lg font-bold ${
                comparisonData.parana.mt > comparisonData.parceiro.mt 
                  ? 'text-blue-600' 
                  : comparisonData.parceiro.mt > comparisonData.parana.mt 
                    ? 'text-green-600' 
                    : 'text-gray-600'
              }`}>
                {comparisonData.parana.mt > comparisonData.parceiro.mt 
                  ? 'Prova Paraná' 
                  : comparisonData.parceiro.mt > comparisonData.parana.mt 
                    ? 'Parceiro Escola' 
                    : 'Empate'}
              </div>
              <div className="text-xs text-gray-500">
                Diferença: {Math.abs(comparisonData.parana.mt - comparisonData.parceiro.mt).toFixed(1)} pontos
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentComparisonChart;