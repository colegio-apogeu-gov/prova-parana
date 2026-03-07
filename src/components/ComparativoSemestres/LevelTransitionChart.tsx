import React from 'react';
import { Target, ArrowRight } from 'lucide-react';
import { ProvaResultado, ProvaResultadoParceiro } from '../../types';

interface LevelTransitionChartProps {
  data: (ProvaResultado | ProvaResultadoParceiro)[];
  selectedSystem: 'prova-parana' | 'parceiro' | 'parana-mais';
}

// Mapa para normalizar os níveis
const normalizeLevel = (level: string, system: 'prova-parana' | 'parceiro' | 'parana-mais') => {
  if (system === 'prova-parana') {
    const map: Record<string, string> = {
      'Defasagem': 'Insuficiente',
      'Aprendizado Intermediário': 'Básico',
      'Aprendizado Adequado': 'Adequado'
    };
    return map[level] || level;
  } else {
    const map: Record<string, string> = {
      'Abaixo do Básico': 'Abaixo do Básico',
      'Básico': 'Básico',
      'Adequado': 'Adequado'
    };
    return map[level] || level;
  }
};


const LevelTransitionChart: React.FC<LevelTransitionChartProps> = ({ data, selectedSystem }) => {
  // ✅ Funções agora ficam antes do useMemo
  const isLevelImprovement = (from: string, to: string, system: 'prova-parana' | 'parceiro' | 'parana-mais'): boolean => {
    if (system === 'prova-parana') {
      const levels = ['Insuficiente', 'Básico', 'Adequado', 'Avançado'];
      return levels.indexOf(to) > levels.indexOf(from);
    } else {
      const levels = ['Abaixo do Básico', 'Básico', 'Adequado'];
      return levels.indexOf(to) > levels.indexOf(from);
    }
  };

  const isLevelDecline = (from: string, to: string, system: 'prova-parana' | 'parceiro' | 'parana-mais'): boolean => {
    if (system === 'prova-parana') {
      const levels = ['Insuficiente', 'Básico', 'Adequado', 'Avançado'];
      return levels.indexOf(to) < levels.indexOf(from);
    } else {
      const levels = ['Abaixo do Básico', 'Básico', 'Adequado'];
      return levels.indexOf(to) < levels.indexOf(from);
    }
  };

  const transitionData = React.useMemo(() => {
    // Agrupar por aluno e semestre
    const studentLevels: Record<string, { sem1?: string; sem2?: string }> = {};

    data.forEach(item => {
      if (item.avaliado) {
        const studentKey = `${item.nome_aluno}-${item.componente}`;
        const level = selectedSystem === 'prova-parana' 
          ? item.nivel_aprendizagem 
          : (item as ProvaResultadoParceiro).padrao_desempenho;

        if (!studentLevels[studentKey]) {
          studentLevels[studentKey] = {};
        }

        if (item.semestre === '1') {
          studentLevels[studentKey].sem1 = level;
        } else if (item.semestre === '2') {
          studentLevels[studentKey].sem2 = level;
        }
      }
    });

    // Contar transições
    const transitions: Record<string, number> = {};
    const levelCounts = { sem1: {} as Record<string, number>, sem2: {} as Record<string, number> };

    Object.values(studentLevels).forEach(levels => {
      if (levels.sem1 && levels.sem2) {
        const transitionKey = `${levels.sem1} → ${levels.sem2}`;
        transitions[transitionKey] = (transitions[transitionKey] || 0) + 1;

        // Contar níveis por semestre
        levelCounts.sem1[levels.sem1] = (levelCounts.sem1[levels.sem1] || 0) + 1;
        levelCounts.sem2[levels.sem2] = (levelCounts.sem2[levels.sem2] || 0) + 1;
      }
    });

    // Classificar transições
const sortedTransitions = Object.entries(transitions)
  .map(([transition, count]) => {
    const [from, to] = transition.split(' → ');

    // 🔑 normalizar os nomes
    const normFrom = normalizeLevel(from, selectedSystem);
    const normTo = normalizeLevel(to, selectedSystem);

    const isImprovement = isLevelImprovement(normFrom, normTo, selectedSystem);
    const isDecline = isLevelDecline(normFrom, normTo, selectedSystem);

    return {
      transition,
      from,
      to,
      count,
      type: isImprovement ? 'improvement' : isDecline ? 'decline' : 'stable'
    };
  })
  .sort((a, b) => b.count - a.count);


    return {
      transitions: sortedTransitions,
      levelCounts,
      totalStudents: Object.keys(studentLevels).filter(key => 
        studentLevels[key].sem1 && studentLevels[key].sem2
      ).length
    };
  }, [data, selectedSystem]);

  const getTransitionColor = (type: string) => {
    switch (type) {
      case 'improvement': return 'text-green-600 bg-green-50 border-green-200';
      case 'decline': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTransitionIcon = (type: string) => {
    switch (type) {
      case 'improvement': return '📈';
      case 'decline': return '📉';
      default: return '➡️';
    }
  };

  const systemColor = selectedSystem === 'prova-parana' ? 'blue' : 'green';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={`${selectedSystem === 'prova-parana' ? 'bg-indigo-100' : 'bg-teal-100'} p-2 rounded-lg`}>
          <Target className={`w-5 h-5 ${selectedSystem === 'prova-parana' ? 'text-indigo-600' : 'text-teal-600'}`} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Transições de {selectedSystem === 'prova-parana' ? 'Níveis de Aprendizagem' : 'Padrões de Desempenho'}
          </h3>
          <p className="text-sm text-gray-600">
            {transitionData.totalStudents} alunos com dados completos
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {transitionData.transitions.slice(0, 8).map((item, index) => (
          <div key={index} className={`p-3 rounded-lg border ${getTransitionColor(item.type)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">{getTransitionIcon(item.type)}</span>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{item.from}</span>
                  <ArrowRight className="w-4 h-4" />
                  <span className="font-medium">{item.to}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold">
                  {item.count} alunos
                </span>
                <div className="text-xs text-gray-500">
                  {((item.count / transitionData.totalStudents) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Resumo das Transições */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-lg font-bold text-green-600">
            {transitionData.transitions.filter(t => t.type === 'improvement').reduce((sum, t) => sum + t.count, 0)}
          </div>
          <div className="text-xs text-green-700">Melhoraram</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-lg font-bold text-gray-600">
            {transitionData.transitions.filter(t => t.type === 'stable').reduce((sum, t) => sum + t.count, 0)}
          </div>
          <div className="text-xs text-gray-700">Mantiveram</div>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="text-lg font-bold text-red-600">
            {transitionData.transitions.filter(t => t.type === 'decline').reduce((sum, t) => sum + t.count, 0)}
          </div>
          <div className="text-xs text-red-700">Pioraram</div>
        </div>
      </div>

      {transitionData.transitions.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma transição encontrada</p>
        </div>
      )}
    </div>
  );
};

export default LevelTransitionChart;
