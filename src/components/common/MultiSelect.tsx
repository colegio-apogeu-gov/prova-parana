import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export type MultiSelectAccent = 'green' | 'blue' | 'orange';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  /** Cor de destaque (acompanha a cor do sistema). Padrão: green. */
  accent?: MultiSelectAccent;
  /** Exibe um campo de busca dentro do dropdown (útil para listas longas). */
  searchable?: boolean;
  /** Exibe atalhos "Selecionar todos" / "Limpar". */
  showSelectAll?: boolean;
  /** Rótulo com tamanho de fonte maior (usado em painéis de filtro principais). */
  largeLabel?: boolean;
}

// Classes completas por cor: o Tailwind precisa das strings literais para
// não remover os utilitários no build (não usar interpolação de cor).
const ACCENT: Record<MultiSelectAccent, { ring: string; checkbox: string; rowSelected: string; link: string }> = {
  green: {
    ring: 'focus:ring-green-500',
    checkbox: 'text-green-600 focus:ring-green-500',
    rowSelected: 'bg-green-50',
    link: 'text-green-700 hover:text-green-900',
  },
  blue: {
    ring: 'focus:ring-blue-500',
    checkbox: 'text-blue-600 focus:ring-blue-500',
    rowSelected: 'bg-blue-50',
    link: 'text-blue-700 hover:text-blue-900',
  },
  orange: {
    ring: 'focus:ring-orange-500',
    checkbox: 'text-orange-600 focus:ring-orange-500',
    rowSelected: 'bg-orange-50',
    link: 'text-orange-700 hover:text-orange-900',
  },
};

/**
 * Dropdown de seleção múltipla via checkboxes.
 * Fecha ao clicar fora e resume a seleção ("N selecionados").
 */
const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Todos',
  emptyMessage = 'Nenhuma opção disponível',
  accent = 'green',
  searchable = false,
  showSelectAll = false,
  largeLabel = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const c = ACCENT[accent];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ao fechar, limpa a busca para não "esconder" opções na próxima abertura.
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const toggleValue = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const visibleOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label ?? selected[0]
      : `${selected.length} selecionados`;

  return (
    <div className="relative" ref={containerRef}>
      <label className={`block font-medium text-gray-700 ${largeLabel ? 'text-sm mb-1' : 'text-xs mb-1'}`}>
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white ${c.ring} focus:ring-2 focus:border-transparent text-left`}
      >
        <span className={`truncate ${selected.length === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
          {summary}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[16rem] bg-white border border-gray-200 rounded-lg shadow-lg">
          {searchable && options.length > 0 && (
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar..."
                  className={`w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded-md ${c.ring} focus:ring-2 focus:border-transparent`}
                />
              </div>
            </div>
          )}

          {showSelectAll && options.length > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 text-xs">
              <button
                type="button"
                onClick={() => onChange(options.map(o => o.value))}
                className={`font-medium ${c.link}`}
              >
                Selecionar todos
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="font-medium text-gray-500 hover:text-gray-700"
              >
                Limpar
              </button>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500">{emptyMessage}</p>
            ) : visibleOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500">Nenhum resultado para "{query}"</p>
            ) : (
              visibleOptions.map(option => {
                const isChecked = selected.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${
                      isChecked ? c.rowSelected : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleValue(option.value)}
                      className={`shrink-0 ${c.checkbox}`}
                    />
                    <span className="text-gray-800">{option.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
