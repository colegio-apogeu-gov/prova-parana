import React, { useState } from 'react';
import { Award, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProvaResultado, ProvaResultadoParceiro } from '../../types';

interface SkillsComparisonChartProps {
  dataParana: ProvaResultado[];
  dataParceiro: ProvaResultadoParceiro[];
}

const SkillsComparisonChart: React.FC<SkillsComparisonChartProps> = ({ 
  dataParana, 
  dataParceiro 
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'difference' | 'parana' | 'parceiro'>('difference');
  const itemsPerPage = 10;

  const skillsData = React.useMemo(() => {
    // Processar habilidades Prova Paraná
    const paranaSkills: Record<string, {
      total_acertos: number;
      total_questoes: number;
      count: number;
      habilidade_codigo: string;
      descricao_habilidade: string;
      componente: string;
    }> = {};

    dataParana.forEach(item => {
      if (item.avaliado && item.habilidade_id) {
        const skillKey = `${item.habilidade_id}__${item.componente}`;
        if (!paranaSkills[skillKey]) {
          paranaSkills[skillKey] = {
            total_acertos: 0,
            total_questoes: 0,
            count: 0,
            habilidade_codigo: item.habilidade_codigo,
            descricao_habilidade: item.descricao_habilidade,
            componente: item.componente
          };
        }
        paranaSkills[skillKey].total_acertos += item.acertos;
        paranaSkills[skillKey].total_questoes += item.total;
        paranaSkills[skillKey].count += 1;
      }
    });

    // Processar habilidades Parceiro
    const parceiroSkills: Record<string, {
      total_acertos: number;
      total_questoes: number;
      count: number;
      habilidade_codigo: string;
      descricao_habilidade: string;
      componente: string;
    }> = {};

    dataParceiro.forEach(item => {
      if (item.avaliado && item.habilidade_id) {
        const skillKey = `${item.habilidade_id}__${item.componente}`;
        if (!parceiroSkills[skillKey]) {
          parceiroSkills[skillKey] = {
            total_acertos: 0,
            total_questoes: 0,
            count: 0,
            habilidade_codigo: item.habilidade_codigo,
            descricao_habilidade: item.descricao_habilidade,
            componente: item.componente
          };
        }
        parceiroSkills[skillKey].total_acertos += item.acertos;
        parceiroSkills[skillKey].total_questoes += item.total;
        parceiroSkills[skillKey].count += 1;
      }
    });

    // Combinar habilidades comuns
    const allSkillKeys = new Set([
      ...Object.keys(paranaSkills),
      ...Object.keys(parceiroSkills)
    ]);

    const combinedSkills = Array.from(allSkillKeys).map(skillKey => {
      const [habilidadeId, componente] = skillKey.split('__');
      const paranaSkill = paranaSkills[skillKey];
      const parceiroSkill = parceiroSkills[skillKey];

      const paranaAverage = paranaSkill && paranaSkill.total_questoes > 0 
        ? (paranaSkill.total_acertos / paranaSkill.total_questoes) * 100 
        : 0;
      
      const parceiroAverage = parceiroSkill && parceiroSkill.total_questoes > 0 
        ? (parceiroSkill.total_acertos / parceiroSkill.total_questoes) * 100 
        : 0;

      return {
        skill: habilidadeId,
        habilidade_codigo: paranaSkill?.habilidade_codigo || parceiroSkill?.habilidade_codigo || '',
        descricao: paranaSkill?.descricao_habilidade || parceiroSkill?.descricao_habilidade || '',
        componente: componente === 'LP' ? 'Língua Portuguesa' : 'Matemática',
        code: componente,
        paranaAverage,
        parceiroAverage,
        paranaCount: paranaSkill?.count || 0,
        parceiroCount: parceiroSkill?.count || 0,
        difference: Math.abs(paranaAverage - parceiroAverage),
        betterSystem: paranaAverage > parceiroAverage ? 'parana' : 
                     parceiroAverage > paranaAverage ? 'parceiro' : 'equal'
      };
    });

    // Ordenar baseado na seleção
    const sortedSkills = combinedSkills.sort((a, b) => {
      switch (sortBy) {
        case 'difference':
          return b.difference - a.difference;
        case 'parana':
          return b.paranaAverage - a.paranaAverage;
        case 'parceiro':
          return b.parceiroAverage - a.parceiroAverage;
        default:
          return b.difference - a.difference;
      }
    });

    return sortedSkills;
  }, [dataParana, dataParceiro, sortBy]);

  const totalPages = Math.ceil(skillsData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSkills = skillsData.slice(startIndex, endIndex);

  const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  const goToPrevious = () => currentPage > 1 && setCurrentPage(currentPage - 1);
  const goToNext = () => currentPage < totalPages && setCurrentPage(currentPage + 1);

  const getPerformanceColor = (average: number) => {
    if (average >= 70) return 'bg-gradient-to-r from-green-400 to-green-600';
    if (average >= 50) return 'bg-gradient-to-r from-yellow-400 to-yellow-600';
    return 'bg-gradient-to-r from-red-400 to-red-600';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-red-100 p-2 rounded-lg">
            <Award className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            Comparação de Habilidades
          </h3>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Ordenar por:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'difference' | 'parana' | 'parceiro')}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="difference">Maior Diferença</option>
            <option value="parana">Melhor Prova Paraná Recomposição</option>
            <option value="parceiro">Melhor Parceiro Escola</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {currentSkills.map((item, index) => (
          <div key={`${item.habilidade_codigo}-${item.code}`} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-900">
                    {item.habilidade_codigo} - {item.skill}
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
                <div className="text-xs text-gray-500 mb-1">Diferença</div>
                <div className="text-sm font-semibold text-gray-900">
                  {item.difference.toFixed(1)} pontos
                </div>
                {item.betterSystem !== 'equal' && (
                  <div className={`text-xs ${
                    item.betterSystem === 'parana' ? 'text-blue-600' : 'text-green-600'
                  }`}>
                    {item.betterSystem === 'parana' ? 'Prova Paraná' : 'Parceiro Escola'}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                    <span className="text-xs text-gray-500 ml-1">
                      ({item.paranaCount})
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(item.paranaAverage, 100)}%` }}
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
                    <span className="text-xs text-gray-500 ml-1">
                      ({item.parceiroCount})
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(item.parceiroAverage, 100)}%` }}
                  />
                </div>
              </div>
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
                        ? 'bg-red-600 text-white'
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
          <p>Nenhum dado disponível</p>
        </div>
      )}
    </div>
  );
};

export default SkillsComparisonChart;