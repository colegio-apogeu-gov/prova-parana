import React from 'react';
import { TrendingUp, TrendingDown, Users, Target, Minus } from 'lucide-react';
import { ProvaResultado, ProvaResultadoParceiro } from '../../types';

interface EvolutionSummaryCardsProps {
  data: (ProvaResultado | ProvaResultadoParceiro)[];
  selectedSystem: 'prova-parana' | 'parceiro';
}

const EvolutionSummaryCards: React.FC<EvolutionSummaryCardsProps> = ({ data, selectedSystem }) => {
  const summaryData = React.useMemo(() => {
    // Agrupar dados por aluno e semestre
    const studentsBySemester: Record<string, Record<string, number[]>> = {
      '1': {},
      '2': {}
    };
    

    data.forEach(item => {
      if (item.avaliado) {
        const studentKey = `${item.nome_aluno}-${item.componente}`;
        if (!studentsBySemester[item.semestre][studentKey]) {
          studentsBySemester[item.semestre][studentKey] = [];
        }
        studentsBySemester[item.semestre][studentKey].push(item.percentual);
      }
    });

    // Calcular médias por aluno em cada semestre
    const studentAverages: Record<string, { sem1: number; sem2: number }> = {};
    
    Object.keys(studentsBySemester['1']).forEach(studentKey => {
      if (studentsBySemester['2'][studentKey]) {
        const sem1Avg = studentsBySemester['1'][studentKey].reduce((a, b) => a + b, 0) / studentsBySemester['1'][studentKey].length;
        const sem2Avg = studentsBySemester['2'][studentKey].reduce((a, b) => a + b, 0) / studentsBySemester['2'][studentKey].length;
        
        studentAverages[studentKey] = { sem1: sem1Avg, sem2: sem2Avg };
      }
    });

    // Calcular estatísticas de evolução
    const evolutions = Object.values(studentAverages).map(avg => avg.sem2 - avg.sem1);
    const improved = evolutions.filter(evo => evo > 2).length; // Melhoria significativa > 2 pontos
    const declined = evolutions.filter(evo => evo < -2).length; // Piora significativa < -2 pontos
    const stable = evolutions.filter(evo => Math.abs(evo) <= 2).length; // Estável

    const totalStudents = Object.keys(studentAverages).length;
    const averageEvolution = evolutions.length > 0 ? evolutions.reduce((a, b) => a + b, 0) / evolutions.length : 0;

    // Calcular médias gerais por semestre
    const sem1Students = Object.keys(studentsBySemester['1']).length;
    const sem2Students = Object.keys(studentsBySemester['2']).length;

    return {
      totalStudents,
      improved,
      declined,
      stable,
      averageEvolution,
      sem1Students,
      sem2Students,
      improvementRate: totalStudents > 0 ? (improved / totalStudents) * 100 : 0,
      declineRate: totalStudents > 0 ? (declined / totalStudents) * 100 : 0,
      stableRate: totalStudents > 0 ? (stable / totalStudents) * 100 : 0
    };
  }, [data]);

  const systemColor = selectedSystem === 'prova-parana' ? 'blue' : 'green';

  const cards = [
    {
      title: 'Alunos com Dados Completos',
      value: summaryData.totalStudents.toString(),
      subtitle: 'Presentes em ambos os semestres',
      icon: Users,
      color: 'indigo',
      change: null
    },
    {
      title: 'Alunos que Melhoraram',
      value: summaryData.improved.toString(),
      subtitle: `${summaryData.improvementRate.toFixed(1)}% do total`,
      icon: TrendingUp,
      color: 'green',
      change: 'positive'
    },
    {
      title: 'Alunos que Pioraram',
      value: summaryData.declined.toString(),
      subtitle: `${summaryData.declineRate.toFixed(1)}% do total`,
      icon: TrendingDown,
      color: 'red',
      change: 'negative'
    },
    {
      title: 'Alunos Estáveis',
      value: summaryData.stable.toString(),
      subtitle: `${summaryData.stableRate.toFixed(1)}% do total`,
      icon: Minus,
      color: 'gray',
      change: 'stable'
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      indigo: 'bg-indigo-100 text-indigo-600',
      green: 'bg-green-100 text-green-600',
      red: 'bg-red-100 text-red-600',
      gray: 'bg-gray-100 text-gray-600',
      blue: 'bg-blue-100 text-blue-600'
    };
    return colors[color] || colors.gray;
  };

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className={`p-2 rounded-lg ${getColorClasses(card.color)}`}>
              <card.icon className="w-6 h-6" />
            </div>
            {card.change && (
              <div className={`text-xs px-2 py-1 rounded-full ${
                card.change === 'positive' ? 'bg-green-100 text-green-700' :
                card.change === 'negative' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {card.change === 'positive' ? 'Melhoria' : 
                 card.change === 'negative' ? 'Declínio' : 'Estável'}
              </div>
            )}
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-600">{card.title}</p>
            <p className={`text-2xl font-bold mt-1 ${
              card.change === 'positive' ? 'text-green-600' :
              card.change === 'negative' ? 'text-red-600' :
              'text-gray-900'
            }`}>
              {card.value}
            </p>
            <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default EvolutionSummaryCards;