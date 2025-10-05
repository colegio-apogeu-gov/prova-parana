import React, { useEffect, useState } from 'react';
import { Filter } from 'lucide-react';
import { UserProfile } from '../../types';
import { supabase, getAllUnitsData } from '../../lib/supabase'; // <= importe aqui

interface FilterPanelProps {
  filters: {
    componente: string;
    regional: string;   // <- certifique-se que a prop se chama 'regional'
    unidade: string;
    ano_escolar: string;
  };
  onFilterChange: (filters: any) => void;
  selectedSystem: 'prova-parana' | 'parceiro';
  userProfile: UserProfile | null;
}

const REGIONAIS_FIXAS = ['CWB', 'SJP', 'GUA'];

const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onFilterChange,
  selectedSystem,
  userProfile
}) => {
  const [regionais] = useState<string[]>(REGIONAIS_FIXAS);
  const [unidades, setUnidades] = useState<string[]>([]);
  const [unidadesLoading, setUnidadesLoading] = useState<boolean>(false);
  const [anosEscolares, setAnosEscolares] = useState<string[]>([]);

  const isProvaParana = selectedSystem === 'prova-parana';
  const tableName = isProvaParana ? 'prova_resultados' : 'prova_resultados_parceiro';

  useEffect(() => {
    loadFilterOptions();
    // Recarrega unidades quando a regional mudar (para listar somente as daquela regional)
    // Se preferir carregar SEMPRE todas (e filtrar no client), remova 'filters.regional' das deps
  }, [selectedSystem, filters.regional]);

  const loadFilterOptions = async () => {
    try {
      setUnidadesLoading(true);

      // 1) Unidades via getAllUnitsData (passando regional se selecionada)
      const unidadesFiltros: any = {};
      if (filters.regional) unidadesFiltros.regional = filters.regional;

      const allUnits = await getAllUnitsData(unidadesFiltros, tableName);
      // allUnits já deve estar DISTINCT + ordenado (conforme sua implementação)
      setUnidades(allUnits);

      // 2) Anos (pode manter sua lógica atual)
      const { data: anosData, error: anosErr } = await supabase
        .from(tableName)
        .select('ano_escolar')
        .not('ano_escolar', 'is', null);
      if (anosErr) throw anosErr;

      const uniqueAnos = [...new Set((anosData ?? []).map((a: any) => a.ano_escolar))]
        .filter(Boolean)
        .sort((a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true }));
      setAnosEscolares(uniqueAnos);
    } catch (error) {
      console.error('Erro ao carregar opções de filtro:', error);
      setUnidades([]);
      setAnosEscolares([]);
    } finally {
      setUnidadesLoading(false);
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
        {/* Componente */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Componente</label>
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

        {/* Regional (fixa) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Regional</label>
          <select
            value={filters.regional}
            onChange={(e) => handleFilterChange('regional', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todas</option>
            {regionais.map((regional) => (
              <option key={regional} value={regional}>{regional}</option>
            ))}
          </select>
        </div>

        {/* Unidade (carregada via getAllUnitsData) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Unidade {unidadesLoading ? '(carregando...)' : ''}
          </label>
          <select
            value={filters.unidade}
            onChange={(e) => handleFilterChange('unidade', e.target.value)}
            disabled={unidadesLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60"
          >
            <option value="">Todas</option>
            {unidades.map((unidade) => (
              <option key={unidade} value={unidade}>{unidade}</option>
            ))}
          </select>
        </div>

        {/* Ano Escolar */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Ano Escolar</label>
          <select
            value={filters.ano_escolar}
            onChange={(e) => handleFilterChange('ano_escolar', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Todos</option>
            {anosEscolares.map((ano) => (
              <option key={ano} value={ano}>{ano}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
