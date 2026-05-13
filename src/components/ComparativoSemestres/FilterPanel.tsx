import React, { useState, useEffect } from 'react';
import { Filter, Search } from 'lucide-react';
import { SemesterFilters } from './ComparativoSemestres';
import { searchStudents, getFilterOptions } from '../../lib/supabase';
import { searchStudentsParceiro, getFilterOptionsParceiro } from '../../lib/supabaseParceiro';

interface FilterPanelProps {
  filters: SemesterFilters;
  onFiltersChange: (filters: SemesterFilters) => void;
  userProfile: { unidade: string } | null;
  selectedSystem: 'prova-parana' | 'parceiro';
  salasDeAula: any[];
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFiltersChange,
  userProfile,
  selectedSystem,
  salasDeAula
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [filterOptions, setFilterOptions] = useState<{
    niveis?: string[];
    padroes?: string[];
    habilidades: Array<{ codigo: string; id: string; descricao: string }>;
  }>({
    niveis: [],
    padroes: [],
    habilidades: []
  });

  useEffect(() => {
    if (searchTerm.length > 0) {
      const fetchSuggestions = async () => {
        try {
          const searchFn = selectedSystem === 'prova-parana' ? searchStudents : searchStudentsParceiro;
          const students = await searchFn(searchTerm, {
            unidade: userProfile?.unidade,
            ...filters
          });
          setSuggestions(students);
        } catch (error) {
          console.error('Erro ao buscar alunos:', error);
          setSuggestions([]);
        }
      };

      const timeoutId = setTimeout(fetchSuggestions, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSuggestions([]);
    }
  }, [searchTerm, filters, userProfile, selectedSystem]);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const getOptionsFn = selectedSystem === 'prova-parana' ? getFilterOptions : getFilterOptionsParceiro;
        const options = await getOptionsFn({
          ...filters,
          unidade: userProfile?.unidade
        });
        setFilterOptions(options);
      } catch (error) {
        console.error('Erro ao buscar opções de filtro:', error);
        setFilterOptions({ niveis: [], padroes: [], habilidades: [] });
      }
    };

    fetchFilterOptions();
  }, [filters, userProfile, selectedSystem]);

  useEffect(() => {
    if (filters.aluno) {
      setSearchTerm(filters.aluno);
    } else {
      setSearchTerm('');
    }
  }, [filters.aluno]);

  const updateFilter = (key: keyof SemesterFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined
    });
  };

  const handleStudentSelect = (student: string) => {
    updateFilter('aluno', student);
    setSearchTerm(student);
    setSuggestions([]);
  };

  const systemColor = selectedSystem === 'prova-parana' ? 'blue' : 'green';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Filter className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-medium text-gray-900">Filtros de Comparação</h3>
      </div>

      <div className="grid md:grid-cols-6 gap-4">
        {/* Unidade */}
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

        {/* Sala de Aula */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sala de Aula
          </label>
          <select
            value={filters.sala_id || ''}
            onChange={(e) => updateFilter('sala_id', e.target.value)}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${systemColor}-500 focus:border-transparent`}
          >
            <option value="">Todas</option>
            {salasDeAula.map((sala) => (
              <option key={sala.id} value={sala.id}>
                {sala.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Ano Escolar */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ano Escolar
          </label>
          <select
            value={filters.ano_escolar || ''}
            onChange={(e) => updateFilter('ano_escolar', e.target.value)}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${systemColor}-500 focus:border-transparent`}
          >
            <option value="">Todos</option>
            {selectedSystem === 'prova-parana' ? (
              <>
                <option value="9º ano">9º ano</option>
                <option value="3º ano">3º ano</option>
              </>
            ) : (
              <>
                <option value="8º ano">8º ano</option>
                <option value="2º ano">2º ano</option>
              </>
            )}
          </select>
        </div>

        {/* Componente */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Componente
          </label>
          <select
            value={filters.componente || ''}
            onChange={(e) => updateFilter('componente', e.target.value)}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${systemColor}-500 focus:border-transparent`}
          >
            <option value="">Todos</option>
            <option value="LP">Língua Portuguesa</option>
            <option value="MT">Matemática</option>
          </select>
        </div>

        {/* Nível/Padrão */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {selectedSystem === 'prova-parana' ? 'Nível de Aprendizagem' : 'Padrão de Desempenho'}
          </label>
          <select
            value={selectedSystem === 'prova-parana' ? (filters.nivel_aprendizagem || '') : (filters.padrao_desempenho || '')}
            onChange={(e) => updateFilter(selectedSystem === 'prova-parana' ? 'nivel_aprendizagem' : 'padrao_desempenho', e.target.value)}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${systemColor}-500 focus:border-transparent`}
          >
            <option value="">Todos</option>
            {selectedSystem === 'prova-parana' 
              ? filterOptions.niveis?.map((nivel) => (
                  <option key={nivel} value={nivel}>
                    {nivel}
                  </option>
                ))
              : filterOptions.padroes?.map((padrao) => (
                  <option key={padrao} value={padrao}>
                    {padrao}
                  </option>
                ))
            }
          </select>
        </div>

        {/* Aluno Específico */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Aluno Específico (Opcional)
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite o nome do aluno..."
              className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${systemColor}-500 focus:border-transparent`}
            />
            {searchTerm && suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {suggestions.map((student, index) => (
                  <button
                    key={index}
                    onClick={() => handleStudentSelect(student)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  >
                    {student}
                  </button>
                ))}
              </div>
            )}
            {filters.aluno && (
              <div className="mt-1 flex items-center gap-2">
                <span className={`text-sm text-${systemColor}-600 bg-${systemColor}-50 px-2 py-1 rounded`}>
                  {filters.aluno}
                </span>
                <button
                  onClick={() => {
                    updateFilter('aluno', '');
                    setSearchTerm('');
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

      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          <strong>Dica:</strong> Selecione um aluno específico para ver análises detalhadas de evolução individual entre semestres.
        </p>
      </div>
    </div>
  );
};

export default FilterPanel;