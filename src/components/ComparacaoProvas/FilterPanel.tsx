import React, { useState, useEffect } from 'react';
import { Filter, Search } from 'lucide-react';
import { ComparisonFilters } from './ComparacaoProvas';
import { searchStudents, getFilterOptions } from '../../lib/supabase';
import { searchStudentsParceiro, getFilterOptionsParceiro } from '../../lib/supabaseParceiro';

interface FilterPanelProps {
  filters: ComparisonFilters;
  onFiltersChange: (filters: ComparisonFilters) => void;
  userProfile: { unidade: string } | null;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFiltersChange,
  userProfile
}) => {
  const [searchTermParana, setSearchTermParana] = useState('');
  const [searchTermParceiro, setSearchTermParceiro] = useState('');
  const [suggestionsParana, setSuggestionsParana] = useState<string[]>([]);
  const [suggestionsParceiro, setSuggestionsParceiro] = useState<string[]>([]);
  const [filterOptionsParana, setFilterOptionsParana] = useState<{
    niveis?: string[];
    habilidades: Array<{ codigo: string; id: string; descricao: string }>;
  }>({ niveis: [], habilidades: [] });
  const [filterOptionsParceiro, setFilterOptionsParceiro] = useState<{
    padroes?: string[];
    habilidades: Array<{ codigo: string; id: string; descricao: string }>;
  }>({ padroes: [], habilidades: [] });

  // Busca de alunos Prova Paraná
  useEffect(() => {
    if (searchTermParana.length > 0) {
      const fetchSuggestions = async () => {
        try {
          const students = await searchStudents(searchTermParana, {
            unidade: userProfile?.unidade,
            componente: filters.componente,
            semestre: filters.semestre,
            ano_escolar: filters.ano_escolar_parana
          });
          setSuggestionsParana(students);
        } catch (error) {
          console.error('Erro ao buscar alunos Prova Paraná:', error);
          setSuggestionsParana([]);
        }
      };

      const timeoutId = setTimeout(fetchSuggestions, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSuggestionsParana([]);
    }
  }, [searchTermParana, filters, userProfile]);

  // Busca de alunos Parceiro
  useEffect(() => {
    if (searchTermParceiro.length > 0) {
      const fetchSuggestions = async () => {
        try {
          const students = await searchStudentsParceiro(searchTermParceiro, {
            unidade: userProfile?.unidade,
            componente: filters.componente,
            semestre: filters.semestre,
            ano_escolar: filters.ano_escolar_parceiro
          });
          setSuggestionsParceiro(students);
        } catch (error) {
          console.error('Erro ao buscar alunos Parceiro:', error);
          setSuggestionsParceiro([]);
        }
      };

      const timeoutId = setTimeout(fetchSuggestions, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSuggestionsParceiro([]);
    }
  }, [searchTermParceiro, filters, userProfile]);

  // Carrega opções de filtro
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [paranaOptions, parceiroOptions] = await Promise.all([
          getFilterOptions({
            unidade: userProfile?.unidade,
            componente: filters.componente,
            semestre: filters.semestre,
            ano_escolar: filters.ano_escolar_parana
          }),
          getFilterOptionsParceiro({
            unidade: userProfile?.unidade,
            componente: filters.componente,
            semestre: filters.semestre,
            ano_escolar: filters.ano_escolar_parceiro
          })
        ]);
        
        setFilterOptionsParana(paranaOptions);
        setFilterOptionsParceiro(parceiroOptions);
      } catch (error) {
        console.error('Erro ao buscar opções de filtro:', error);
      }
    };

    fetchFilterOptions();
  }, [filters, userProfile]);

  const updateFilter = (key: keyof ComparisonFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined
    });
  };

  const handleStudentSelectParana = (student: string) => {
    updateFilter('aluno_parana', student);
    setSearchTermParana(student);
    setSuggestionsParana([]);
  };

  const handleStudentSelectParceiro = (student: string) => {
    updateFilter('aluno_parceiro', student);
    setSearchTermParceiro(student);
    setSuggestionsParceiro([]);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Filter className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-medium text-gray-900">Filtros de Comparação</h3>
      </div>

      <div className="space-y-6">
        {/* Filtros Gerais */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Filtros Gerais</h4>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Componente
              </label>
              <select
                value={filters.componente || ''}
                onChange={(e) => updateFilter('componente', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                <option value="LP">Língua Portuguesa</option>
                <option value="MT">Matemática</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Semestre
              </label>
              <select
                value={filters.semestre || ''}
                onChange={(e) => updateFilter('semestre', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                <option value="1">1º Semestre</option>
                <option value="2">2º Semestre</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unidade
              </label>
              <input
                type="text"
                value={userProfile?.unidade || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>
          </div>
        </div>

        {/* Filtros Específicos por Sistema */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Prova Paraná */}
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
            <h4 className="text-sm font-semibold text-blue-700 mb-3 flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
              Prova Paraná Recomposição
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ano Escolar
                </label>
                <select
                  value={filters.ano_escolar_parana || ''}
                  onChange={(e) => updateFilter('ano_escolar_parana', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Todos</option>
                  <option value="9º ano">9º ano</option>
                  <option value="3º ano">3º ano</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nível de Aprendizagem
                </label>
                <select
                  value={filters.nivel_aprendizagem || ''}
                  onChange={(e) => updateFilter('nivel_aprendizagem', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Todos</option>
                  {filterOptionsParana.niveis?.map((nivel) => (
                    <option key={nivel} value={nivel}>
                      {nivel}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aluno Específico
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTermParana}
                    onChange={(e) => setSearchTermParana(e.target.value)}
                    placeholder="Digite o nome do aluno..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {searchTermParana && suggestionsParana.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {suggestionsParana.map((student, index) => (
                        <button
                          key={index}
                          onClick={() => handleStudentSelectParana(student)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                        >
                          {student}
                        </button>
                      ))}
                    </div>
                  )}
                  {filters.aluno_parana && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        {filters.aluno_parana}
                      </span>
                      <button
                        onClick={() => {
                          updateFilter('aluno_parana', '');
                          setSearchTermParana('');
                        }}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Parceiro da Escola */}
          <div className="border border-green-200 rounded-lg p-4 bg-green-50">
            <h4 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
              <div className="w-3 h-3 bg-green-600 rounded-full"></div>
              Parceiro da Escola
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ano Escolar
                </label>
                <select
                  value={filters.ano_escolar_parceiro || ''}
                  onChange={(e) => updateFilter('ano_escolar_parceiro', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Todos</option>
                  <option value="8º ano">8º ano</option>
                  <option value="2º ano">2º ano</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Padrão de Desempenho
                </label>
                <select
                  value={filters.padrao_desempenho || ''}
                  onChange={(e) => updateFilter('padrao_desempenho', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Todos</option>
                  {filterOptionsParceiro.padroes?.map((padrao) => (
                    <option key={padrao} value={padrao}>
                      {padrao}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aluno Específico
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTermParceiro}
                    onChange={(e) => setSearchTermParceiro(e.target.value)}
                    placeholder="Digite o nome do aluno..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {searchTermParceiro && suggestionsParceiro.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {suggestionsParceiro.map((student, index) => (
                        <button
                          key={index}
                          onClick={() => handleStudentSelectParceiro(student)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                        >
                          {student}
                        </button>
                      ))}
                    </div>
                  )}
                  {filters.aluno_parceiro && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded">
                        {filters.aluno_parceiro}
                      </span>
                      <button
                        onClick={() => {
                          updateFilter('aluno_parceiro', '');
                          setSearchTermParceiro('');
                        }}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;