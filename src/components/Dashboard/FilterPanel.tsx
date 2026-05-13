import React, { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import { DashboardFilters } from '../../types';
import { searchStudents, getFilterOptions } from '../../lib/supabase';
import { searchStudentsParceiro, getFilterOptionsParceiro } from '../../lib/supabaseParceiro';

interface FilterPanelProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  userProfile: { unidade: string } | null;
  selectedSystem: 'prova-parana' | 'parceiro';
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFiltersChange,
  userProfile,
  selectedSystem
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [filterOptions, setFilterOptions] = useState<{
    niveis?: string[];
    padroes?: string[];
    habilidades: Array<{ codigo: string; id: string; descricao: string; nivel_aprendizagem?: string }>;
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
          const students = await searchFn(searchTerm, filters);
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
  }, [searchTerm, filters, selectedSystem]);

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
    if (filters.nome_aluno) {
      setSearchTerm(filters.nome_aluno);
    } else {
      setSearchTerm('');
    }
  }, [filters.nome_aluno]);

  const updateFilter = (key: keyof DashboardFilters, value: string) => {
    // 🔄 Limpa o filtro de habilidade quando nível muda
    if (key === 'nivel_aprendizagem' || key === 'padrao_desempenho') {
      onFiltersChange({
        ...filters,
        [key]: value || undefined,
        habilidade_codigo: undefined
      });
    } else {
      onFiltersChange({
        ...filters,
        [key]: value || undefined
      });
    }
  };

  const handleStudentSelect = (student: string) => {
    updateFilter('nome_aluno', student);
    setSearchTerm(student);
    setSuggestions([]);
  };

  const nivelSelecionado = selectedSystem === 'prova-parana' 
    ? (filters.nivel_aprendizagem && filters.nivel_aprendizagem !== '')
    : (filters.padrao_desempenho && filters.padrao_desempenho !== '');

const habilidadesFiltradas = nivelSelecionado
  ? filterOptions.habilidades
  : [];


  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Filter className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
      </div>

      <div className="grid md:grid-cols-7 gap-4">
        {/* Aluno */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Aluno
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite o nome do aluno..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            {filters.nome_aluno && (
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  {filters.nome_aluno}
                </span>
                <button
                  onClick={() => updateFilter('nome_aluno', '')}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

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

        {/* Ano Escolar */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ano Escolar
          </label>
          <select
            value={filters.ano_escolar || ''}
            onChange={(e) => updateFilter('ano_escolar', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos</option>
            <option value="9º ano">9º ano</option>
            <option value="3º ano">3º ano</option>
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos</option>
            <option value="LP">Língua Portuguesa</option>
            <option value="MT">Matemática</option>
          </select>
        </div>

        {/* Semestre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Semestre
          </label>
          <select
            value={filters.semestre || ''}
            onChange={(e) => updateFilter('semestre', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos</option>
            <option value="1">1º Semestre</option>
            <option value="2">2º Semestre</option>
          </select>
        </div>

        {/* Nível de Aprendizagem ou Padrão de Desempenho */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {selectedSystem === 'prova-parana' ? 'Nível de Aprendizagem' : 'Padrão de Desempenho'}
          </label>
          <select
            value={selectedSystem === 'prova-parana' ? (filters.nivel_aprendizagem || '') : (filters.padrao_desempenho || '')}
            onChange={(e) => updateFilter(selectedSystem === 'prova-parana' ? 'nivel_aprendizagem' : 'padrao_desempenho', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">{selectedSystem === 'prova-parana' ? 'Selecione um nível de aprendizagem' : 'Selecione um padrão de desempenho'}</option>
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

{/* Habilidade (condicional) */}
{nivelSelecionado && (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      Habilidade
    </label>
    <select
      value={filters.habilidade_codigo || ''}
      onChange={(e) => updateFilter('habilidade_codigo', e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      <option value="">Todas</option>
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

      {/* ✅ Aqui entram as habilidades do backend */}
      {habilidadesFiltradas.map((habilidade) => (
        <option
          key={`${habilidade.codigo}-${habilidade.id}`}
          value={habilidade.codigo}
        >
          {habilidade.codigo} - {habilidade.id} - {habilidade.descricao}
        </option>
      ))}
    </select>
  </div>
)}

      </div>
    </div>
  );
};

export default FilterPanel;
