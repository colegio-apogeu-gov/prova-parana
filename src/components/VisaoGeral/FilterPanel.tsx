import React, { useEffect, useState } from 'react';
import { Filter } from 'lucide-react';
import { UserProfile } from '../../types';
import { supabase } from '../../lib/supabase';

interface FilterPanelProps {
  filters: {
    componente: string;
    regional: string;
    unidade: string;
    ano_escolar: string;
  };
  onFilterChange: (filters: any) => void;
  selectedSystem: 'prova-parana' | 'parceiro';
  userProfile: UserProfile | null;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFilterChange,
  selectedSystem,
  userProfile
}) => {
  const [regionais, setRegionais] = useState<string[]>([]);
  const [unidades, setUnidades] = useState<string[]>([]);
  const [anosEscolares, setAnosEscolares] = useState<string[]>([]);

  const isProvaParana = selectedSystem === 'prova-parana';
  const tableName = isProvaParana ? 'prova_resultados' : 'prova_resultados_parceiro';

  useEffect(() => {
    loadFilterOptions();
  }, [selectedSystem]);

  const loadFilterOptions = async () => {
    try {
      const [regionaisData, unidadesData, anosData] = await Promise.all([
        supabase.from(tableName).select('regional').not('regional', 'is', null),
        supabase.from(tableName).select('unidade').not('unidade', 'is', null),
        supabase.from(tableName).select('ano_escolar').not('ano_escolar', 'is', null)
      ]);

      if (regionaisData.data) {
        const uniqueRegionais = [...new Set(regionaisData.data.map((r: any) => r.regional))].sort();
        setRegionais(uniqueRegionais);
      }

      if (unidadesData.data) {
        const uniqueUnidades = [...new Set(unidadesData.data.map((u: any) => u.unidade))].sort();
        setUnidades(uniqueUnidades);
      }

      if (anosData.data) {
        const uniqueAnos = [...new Set(anosData.data.map((a: any) => a.ano_escolar))].sort();
        setAnosEscolares(uniqueAnos);
      }
    } catch (error) {
      console.error('Erro ao carregar opções de filtro:', error);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    onFilterChange({
      ...filters,
      [key]: value
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-5 h-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Filtros</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Componente
          </label>
          <select
            value={filters.componente}
            onChange={(e) => handleFilterChange('componente', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos</option>
            <option value="MT">Matemática</option>
            <option value="LP">Língua Portuguesa</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Regional
          </label>
          <select
            value={filters.regional}
            onChange={(e) => handleFilterChange('regional', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todas</option>
            {regionais.map((regional) => (
              <option key={regional} value={regional}>
                {regional}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Unidade
          </label>
          <select
            value={filters.unidade}
            onChange={(e) => handleFilterChange('unidade', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todas</option>
            {unidades.map((unidade) => (
              <option key={unidade} value={unidade}>
                {unidade}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ano Escolar
          </label>
          <select
            value={filters.ano_escolar}
            onChange={(e) => handleFilterChange('ano_escolar', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos</option>
            {anosEscolares.map((ano) => (
              <option key={ano} value={ano}>
                {ano}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
