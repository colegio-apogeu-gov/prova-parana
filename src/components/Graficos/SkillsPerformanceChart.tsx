import React from 'react';
import { Award, ChevronLeft, ChevronRight } from 'lucide-react';
import { ProvaResultado } from '../../types';

interface SkillsPerformanceChartProps {
  data: ProvaResultado[];
  selectedSystem: 'prova-parana' | 'parceiro';
}

const SkillsPerformanceChart: React.FC<SkillsPerformanceChartProps> = ({ data, selectedSystem }) => {
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 10;

  // 🔁 Sempre que o sistema mudar, volte para a página 1
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedSystem]);

  const skillsData = React.useMemo(() => {
    // 🎯 Anos válidos por sistema
    const GRADES_BY_SYSTEM: Record<'prova-parana' | 'parceiro', string[]> = {
      'prova-parana': ['9º ano', '3º ano'],
      parceiro: ['8º ano', '2º ano'],
    };
    const allowedGrades = GRADES_BY_SYSTEM[selectedSystem];

    // 🏷️ Mapeamento de componentes por sistema (ajuste se o parceiro usar códigos diferentes)
    const COMPONENTS_BY_SYSTEM: Record<'prova-parana' | 'parceiro', Record<string, string>> = {
      'prova-parana': { LP: 'Língua Portuguesa', MT: 'Matemática' },
      parceiro: { LP: 'Língua Portuguesa', MT: 'Matemática' },
    };
    const componentLabel = COMPONENTS_BY_SYSTEM[selectedSystem];

    const skills: Record<string, {
      total_acertos: number;
      total_questoes: number;
      count: number;
      habilidade_codigo: string;
      descricao_habilidade: string;
      componente: string;
    }> = {};

    // Filtra: apenas itens avaliados, dos anos do sistema ativo e com habilidade válida
    const filtered = data.filter(
      (item) =>
        item.avaliado &&
        !!item.habilidade_id &&
        allowedGrades.includes(item.ano_escolar)
    );

    filtered.forEach((item) => {
      // chave agrega por habilidade + componente (evita misturar habilidades iguais em componentes diferentes)
      const skillKey = `${item.habilidade_id}__${item.componente}`;
      if (!skills[skillKey]) {
        skills[skillKey] = {
          total_acertos: 0,
          total_questoes: 0,
          count: 0,
          habilidade_codigo: item.habilidade_codigo,
          descricao_habilidade: item.descricao_habilidade,
          componente: item.componente,
        };
      }
      skills[skillKey].total_acertos += item.acertos;
      skills[skillKey].total_questoes += item.total;
      skills[skillKey].count += 1;
    });

    return Object.entries(skills)
      .map(([skillKey, s]) => {
        const [habilidadeId, compCode] = skillKey.split('__');
        return {
          skill: habilidadeId,
          habilidade_codigo: s.habilidade_codigo,
          descricao: s.descricao_habilidade,
          componente: componentLabel[compCode] ?? compCode,
          average: s.total_questoes > 0 ? (s.total_acertos / s.total_questoes) * 100 : 0,
          count: s.count,
          code: compCode,
        };
      })
      .sort((a, b) => a.average - b.average); // menor → maior performance
  }, [data, selectedSystem]);

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
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-red-100 p-2 rounded-lg">
          <Award className="w-5 h-5 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Habilidades
        </h3>
      </div>

      <div className="space-y-3">
        {currentSkills.map((item) => (
          <div key={`${item.habilidade_codigo}-${item.code}`} className="p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {item.habilidade_codigo} - {item.skill} ({item.componente})
                </p>
                <p className="text-xs text-gray-600 line-clamp-2">
                  {item.descricao}
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-700 ml-2">
                {item.average.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getPerformanceColor(item.average)}`}
                style={{ width: `${Math.min(item.average, 100)}%` }}
              />
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

export default SkillsPerformanceChart;
