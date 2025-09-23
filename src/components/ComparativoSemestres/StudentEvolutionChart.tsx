import React from 'react';
import { User, TrendingUp, TrendingDown, Target, BookOpen } from 'lucide-react';
import { ProvaResultado, ProvaResultadoParceiro } from '../../types';

interface StudentEvolutionChartProps {
  data: (ProvaResultado | ProvaResultadoParceiro)[];
  selectedSystem: 'prova-parana' | 'parceiro';
  studentName: string;
}

const StudentEvolutionChart: React.FC<StudentEvolutionChartProps> = ({ 
  data, 
  selectedSystem, 
  studentName 
}) => {
  const studentData = React.useMemo(() => {
    const studentItems = data.filter(item => 
      item.nome_aluno === studentName && item.avaliado
    );

    if (studentItems.length === 0) return null;

    // Agrupar por componente e semestre
    const byComponent: Record<string, Record<string, number[]>> = {
      LP: { '1': [], '2': [] },
      MT: { '1': [], '2': [] }
    };

    // Agrupar habilidades por semestre
    const skillsBySemester: Record<string, Array<{
      habilidade_id: string;
      habilidade_codigo: string;
      descricao: string;
      acertos: number;
      total: number;
      percentual: number;
    }>> = { '1': [], '2': [] };

    // Níveis/Padrões por semestre
    const levelsBySemester: Record<string, string[]> = { '1': [], '2': [] };

    studentItems.forEach(item => {
      if (item.componente in byComponent && item.semestre in byComponent[item.componente]) {
        byComponent[item.componente][item.semestre].push(item.percentual);
        
        skillsBySemester[item.semestre].push({
          habilidade_id: item.habilidade_id,
          habilidade_codigo: item.habilidade_codigo,
          descricao: item.descricao_habilidade,
          acertos: item.acertos,
          total: item.total,
          percentual: item.percentual
        });

        const level = selectedSystem === 'prova-parana' 
          ? item.nivel_aprendizagem 
          : (item as ProvaResultadoParceiro).padrao_desempenho;
        
        if (level) {
          levelsBySemester[item.semestre].push(level);
        }
      }
    });

    // Calcular médias
    const calculateAverage = (values: number[]) => 
      values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    const componentAverages = {
      LP: {
        sem1: calculateAverage(byComponent.LP['1']),
        sem2: calculateAverage(byComponent.LP['2']),
        evolution: calculateAverage(byComponent.LP['2']) - calculateAverage(byComponent.LP['1'])
      },
      MT: {
        sem1: calculateAverage(byComponent.MT['1']),
        sem2: calculateAverage(byComponent.MT['2']),
        evolution: calculateAverage(byComponent.MT['2']) - calculateAverage(byComponent.MT['1'])
      }
    };

    const overallAverage = {
      sem1: calculateAverage([...byComponent.LP['1'], ...byComponent.MT['1']]),
      sem2: calculateAverage([...byComponent.LP['2'], ...byComponent.MT['2']]),
    };
    overallAverage.evolution = overallAverage.sem2 - overallAverage.sem1;

    // Pegar o nível/padrão mais comum de cada semestre
    const getMostCommonLevel = (levels: string[]) => {
      const counts = levels.reduce((acc, level) => {
        acc[level] = (acc[level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return Object.entries(counts).sort(([,a], [,b]) => b - a)[0]?.[0] || '';
    };

    return {
      student: studentItems[0],
      componentAverages,
      overallAverage,
      skillsBySemester,
      levels: {
        sem1: getMostCommonLevel(levelsBySemester['1']),
        sem2: getMostCommonLevel(levelsBySemester['2'])
      },
      totalEvaluations: {
        sem1: skillsBySemester['1'].length,
        sem2: skillsBySemester['2'].length
      }
    };
  }, [data, studentName, selectedSystem]);

  if (!studentData) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center py-8 text-gray-500">
          <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado encontrado para o aluno selecionado</p>
        </div>
      </div>
    );
  }

  const systemColor = selectedSystem === 'prova-parana' ? 'blue' : 'green';
  const maxAverage = Math.max(
    studentData.overallAverage.sem1,
    studentData.overallAverage.sem2,
    studentData.componentAverages.LP.sem1,
    studentData.componentAverages.LP.sem2,
    studentData.componentAverages.MT.sem1,
    studentData.componentAverages.MT.sem2,
    1
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={`${selectedSystem === 'prova-parana' ? 'bg-indigo-100' : 'bg-emerald-100'} p-2 rounded-lg`}>
          <User className={`w-5 h-5 ${selectedSystem === 'prova-parana' ? 'text-indigo-600' : 'text-emerald-600'}`} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Evolução Individual: {studentName}
          </h3>
          <p className="text-sm text-gray-600">
            {studentData.student.unidade} • Turma {studentData.student.turma}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Performance Geral */}
        <div className="space-y-4">
          <h4 className="text-md font-semibold text-gray-800 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Performance Geral
          </h4>
          
          <div className="space-y-3">
            {/* 1º Semestre */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">1º Semestre</span>
                <span className="text-sm font-semibold text-gray-900">
                  {studentData.overallAverage.sem1.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`bg-gradient-to-r from-${systemColor}-400 to-${systemColor}-500 h-3 rounded-full transition-all duration-300`}
                  style={{ width: `${(studentData.overallAverage.sem1 / maxAverage) * 100}%` }}
                />
              </div>
            </div>

            {/* 2º Semestre */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">2º Semestre</span>
                <span className="text-sm font-semibold text-gray-900">
                  {studentData.overallAverage.sem2.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`bg-gradient-to-r from-${systemColor}-500 to-${systemColor}-600 h-3 rounded-full transition-all duration-300`}
                  style={{ width: `${(studentData.overallAverage.sem2 / maxAverage) * 100}%` }}
                />
              </div>
            </div>

            {/* Evolução Geral */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Evolução Geral:</span>
                <div className={`flex items-center gap-2 ${
                  studentData.overallAverage.evolution > 0 ? 'text-green-600' : 
                  studentData.overallAverage.evolution < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {studentData.overallAverage.evolution > 0 ? <TrendingUp className="w-4 h-4" /> : 
                   studentData.overallAverage.evolution < 0 ? <TrendingDown className="w-4 h-4" /> : 
                   <Target className="w-4 h-4" />}
                  <span className="font-semibold">
                    {studentData.overallAverage.evolution >= 0 ? '+' : ''}{studentData.overallAverage.evolution.toFixed(1)} pontos
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance por Componente */}
        <div className="space-y-4">
          <h4 className="text-md font-semibold text-gray-800 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Performance por Componente
          </h4>

          {/* Língua Portuguesa */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-purple-700">Língua Portuguesa</span>
              <div className={`flex items-center gap-1 text-sm ${
                studentData.componentAverages.LP.evolution > 0 ? 'text-green-600' : 
                studentData.componentAverages.LP.evolution < 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {studentData.componentAverages.LP.evolution >= 0 ? '+' : ''}{studentData.componentAverages.LP.evolution.toFixed(1)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-gray-600">1º Sem: {studentData.componentAverages.LP.sem1.toFixed(1)}%</div>
                <div className="w-full bg-gray-200 rounded-full h-1">
                  <div
                    className="bg-gradient-to-r from-purple-400 to-purple-500 h-1 rounded-full"
                    style={{ width: `${(studentData.componentAverages.LP.sem1 / maxAverage) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="text-gray-600">2º Sem: {studentData.componentAverages.LP.sem2.toFixed(1)}%</div>
                <div className="w-full bg-gray-200 rounded-full h-1">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-purple-600 h-1 rounded-full"
                    style={{ width: `${(studentData.componentAverages.LP.sem2 / maxAverage) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Matemática */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-orange-700">Matemática</span>
              <div className={`flex items-center gap-1 text-sm ${
                studentData.componentAverages.MT.evolution > 0 ? 'text-green-600' : 
                studentData.componentAverages.MT.evolution < 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                {studentData.componentAverages.MT.evolution >= 0 ? '+' : ''}{studentData.componentAverages.MT.evolution.toFixed(1)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-gray-600">1º Sem: {studentData.componentAverages.MT.sem1.toFixed(1)}%</div>
                <div className="w-full bg-gray-200 rounded-full h-1">
                  <div
                    className="bg-gradient-to-r from-orange-400 to-orange-500 h-1 rounded-full"
                    style={{ width: `${(studentData.componentAverages.MT.sem1 / maxAverage) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="text-gray-600">2º Sem: {studentData.componentAverages.MT.sem2.toFixed(1)}%</div>
                <div className="w-full bg-gray-200 rounded-full h-1">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-orange-600 h-1 rounded-full"
                    style={{ width: `${(studentData.componentAverages.MT.sem2 / maxAverage) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Informações Adicionais */}
      <div className="mt-6 grid md:grid-cols-2 gap-4">
        {/* Níveis/Padrões */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h5 className="text-sm font-semibold text-gray-700 mb-2">
            {selectedSystem === 'prova-parana' ? 'Níveis de Aprendizagem' : 'Padrões de Desempenho'}
          </h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">1º Semestre:</span>
              <span className="font-medium">{studentData.levels.sem1 || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">2º Semestre:</span>
              <span className="font-medium">{studentData.levels.sem2 || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h5 className="text-sm font-semibold text-gray-700 mb-2">Estatísticas</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Avaliações 1º Sem:</span>
              <span className="font-medium">{studentData.totalEvaluations.sem1}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avaliações 2º Sem:</span>
              <span className="font-medium">{studentData.totalEvaluations.sem2}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentEvolutionChart;