import React, { useState } from 'react';
import { Award, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProvaResultado, ProvaResultadoParceiro } from '../../types';

interface SkillsEvolutionChartProps {
  data: (ProvaResultado | ProvaResultadoParceiro)[];
  selectedSystem: 'prova-parana' | 'parceiro';
}

const SkillsEvolutionChart: React.FC<SkillsEvolutionChartProps> = ({ data, selectedSystem }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'evolution' | 'sem1' | 'sem2'>('evolution');
  const itemsPerPage = 8;

  const skillsData = React.useMemo(() => {
    const skills: Record<string, {
      sem1: { total_acertos: number; total_questoes: number; count: number };
      sem2: { total_acertos: number; total_questoes: number; count: number };
      habilidade_codigo: string;
      descricao_habilidade: string;
      componente: string;
    }> = {};

    data.forEach(item => {
      if (item.avaliado && item.habilidade_id) {
        const skillKey = `${item.habilidade_id}__${item.componente}`;
        if (!skills[skillKey]) {
          skills[skillKey] = {
            sem1: { total_acertos: 0, total_questoes: 0, count: 0 },
            sem2: { total_acertos: 0, total_questoes: 0, count: 0 },
            habilidade_codigo: item.habilidade_codigo,
            descricao_habilidade: item.descricao_habilidade,
            componente: item.componente
          };
        }

        const semester = item.semestre === '1' ? 'sem1' : 'sem2';
        skills[skillKey][semester].total_acertos += item.acertos;
        skills[skillKey][semester].total_questoes += item.total;
        skills[skillKey][semester].count += 1;
      }
    });

    return Object.entries(skills)
      .map(([skillKey, s]) => {
        const [habilidadeId, compCode] = skillKey.split('__');
        const sem1Avg = s.sem1.total_questoes > 0 ? (s.sem1.total_acertos / s.sem1.total_questoes) * 100 : 0;
        const sem2Avg = s.sem2.total_questoes > 0 ? (s.sem2.total_acertos / s.sem2.total_questoes) * 100 : 0;
        
        return {
          skill: habilidadeId,
          habilidade_codigo: s.habilidade_codigo,
          descricao: s.descricao_habilidade,
          componente: compCode === 'LP' ? 'Língua Portuguesa' : 'Matemática',
          code: compCode,
          sem1Average: sem1Avg,
          sem2Average: sem2Avg,
          evolution: sem2Avg - sem1Avg,
          sem1Count: s.sem1.count,
          sem2Count: s.sem2.count,
          hasCompleteData: s.sem1.count > 0 && s.sem2.count > 0
        };
      })
      .filter(item => item.hasCompleteData) // Apenas habilidades com dados dos dois semestres
      .sort((a, b) => {
        switch (sortBy) {
          case 'evolution':
            return Math.abs(b.evolution) - Math.abs(a.evolution);
          case 'sem1':
            return b.sem1Average - a.sem1Average;
          case 'sem2':
            return b.sem2Average - a.sem2Average;
          default:
            return Math.abs(b.evolution) - Math.abs(a.evolution);
        }
      });
  }, [data, sortBy]);

  const totalPages = Math.ceil(skillsData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSkills = skillsData.slice(startIndex, endIndex);

  const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  const goToPrevious = () => currentPage > 1 && setCurrentPage(currentPage - 1);
  const goToNext = () => currentPage < totalPages && setCurrentPage(currentPage + 1);

  const getEvolutionColor = (evolution: number) => {
    if (evolution > 5) return 'text-green-600';
    if (evolution < -5) return 'text-red-600';
    return 'text-gray-600';
  };

  const getEvolutionIcon = (evolution: number) => {
    if (evolution > 2) return '📈';
    if (evolution < -2) return '📉';
    return '➡️';
  };

  const systemColor = selectedSystem === 'prova-parana' ? 'blue' : 'green';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`${selectedSystem === 'prova-parana' ? 'bg-red-100' : 'bg-yellow-100'} p-2 rounded-lg`}>
            <Award className={`w-5 h-5 ${selectedSystem === 'prova-parana' ? 'text-red-600' : 'text-yellow-600'}`} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            Evolução por Habilidade
          </h3>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Ordenar por:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'evolution' | 'sem1' | 'sem2')}
            className={`px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-${systemColor}-500 focus:border-transparent`}
          >
            <option value="evolution">Maior Evolução</option>
            <option value="sem1">Melhor 1º Semestre</option>
            <option value="sem2">Melhor 2º Semestre</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {currentSkills.map((item, index) => (
          <div key={`${item.habilidade_codigo}`} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-900">
                    {item.habilidade_codigo}
                  </p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    item.code === 'LP' 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {item.componente}
                  </span>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2">
                  {item.descricao}
                </p>
              </div>
              <div className="text-right ml-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getEvolutionIcon(item.evolution)}</span>
                  <div>
                    <div className="text-xs text-gray-500">Evolução</div>
                    <div className={`text-sm font-semibold ${getEvolutionColor(item.evolution)}`}>
                      {item.evolution >= 0 ? '+' : ''}{item.evolution.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* 1º Semestre */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">1º Semestre</span>
                  <div className="text-right">
                    <span className={`text-sm font-semibold text-${systemColor}-600`}>
                      {item.sem1Average.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-500 ml-1">
                      ({item.sem1Count})
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`bg-gradient-to-r from-${systemColor}-400 to-${systemColor}-500 h-2 rounded-full transition-all duration-300`}
                    style={{ width: `${Math.min(item.sem1Average, 100)}%` }}
                  />
                </div>
              </div>

              {/* 2º Semestre */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">2º Semestre</span>
                  <div className="text-right">
                    <span className={`text-sm font-semibold text-${systemColor}-600`}>
                      {item.sem2Average.toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-500 ml-1">
                      ({item.sem2Count})
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`bg-gradient-to-r from-${systemColor}-500 to-${systemColor}-600 h-2 rounded-full transition-all duration-300`}
                    style={{ width: `${Math.min(item.sem2Average, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Análise da Evolução */}
            <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
              <strong>Análise:</strong> {
                item.evolution > 5 ? `Melhoria significativa de ${item.evolution.toFixed(1)} pontos` :
                item.evolution < -5 ? `Declínio significativo de ${Math.abs(item.evolution).toFixed(1)} pontos` :
                item.evolution > 0 ? `Leve melhoria de ${item.evolution.toFixed(1)} pontos` :
                item.evolution < 0 ? `Leve declínio de ${Math.abs(item.evolution).toFixed(1)} pontos` :
                'Performance estável entre semestres'
              }
            </div>
          </div>
        ))}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Mostrando {skillsData.length === 0 ? 0 : startIndex + 1}
            -
            {Math.min(endIndex, skillsData.length)} de {skillsData.length} habilidades
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevious}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNumber;
                if (totalPages <= 5) pageNumber = i + 1;
                else if (currentPage <= 3) pageNumber = i + 1;
                else if (currentPage >= totalPages - 2) pageNumber = totalPages - 4 + i;
                else pageNumber = currentPage - 2 + i;

                return (
                  <button
                    key={pageNumber}
                    onClick={() => goToPage(pageNumber)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      currentPage === pageNumber
                        ? `bg-${systemColor}-600 text-white`
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
            </div>

            <button
              onClick={goToNext}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {skillsData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma habilidade com dados completos encontrada</p>
        </div>
      )}
    </div>
  );
};

export default SkillsEvolutionChart;