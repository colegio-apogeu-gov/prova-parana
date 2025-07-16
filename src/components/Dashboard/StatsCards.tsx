import React from 'react';
import { Users, UserCheck, TrendingUp, Award } from 'lucide-react';
import { PerformanceInsight } from '../../types';

interface StatsCardsProps {
  insights: PerformanceInsight;
}

const StatsCards: React.FC<StatsCardsProps> = ({ insights }) => {
  const cards = [
    {
      title: 'Total de Alunos',
      value: insights.total_alunos.toLocaleString(),
      icon: Users,
      color: 'blue',
      change: null
    },
    {
      title: 'Alunos Avaliados',
      value: insights.alunos_avaliados.toLocaleString(),
      icon: UserCheck,
      color: 'green',
      change: null
    },
    {
      title: 'Taxa de Participação',
      value: `${insights.percentual_participacao.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'purple',
      change: null
    },
    {
      title: 'Habilidades Analisadas',
      value: insights.performance_habilidades.length.toString(),
      icon: Award,
      color: 'orange',
      change: null
    }
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-600',
      green: 'bg-green-100 text-green-600',
      purple: 'bg-purple-100 text-purple-600',
      orange: 'bg-orange-100 text-orange-600'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className={`p-2 rounded-lg ${getColorClasses(card.color)}`}>
              <card.icon className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-600">{card.title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;