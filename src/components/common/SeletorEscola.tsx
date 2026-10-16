import React from 'react';
import { School } from 'lucide-react';
import { UNIDADES_PADRONIZADAS } from '../../types';
import { useEscolaCsc } from '../../lib/escolaCsc';

// Select de escola do CSC (Navbar e campo "Unidade" dos filtros). Fora do CSC não renderiza.
export const SeletorEscola: React.FC<{ className?: string }> = ({ className = '' }) => {
  const csc = useEscolaCsc();
  if (!csc) return null;

  return (
    <select
      value={csc.escola}
      onChange={(e) => csc.setEscola(e.target.value)}
      className={className}
      aria-label="Escola"
    >
      <option value="">Selecione a escola</option>
      {UNIDADES_PADRONIZADAS.map((unidade) => (
        <option key={unidade} value={unidade}>
          {unidade}
        </option>
      ))}
    </select>
  );
};

// Exibida no lugar das telas enquanto o CSC não escolheu uma escola.
export const EscolhaEscola: React.FC = () => {
  const csc = useEscolaCsc();
  if (!csc) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-gray-100 p-2 rounded-lg">
          <School className="w-6 h-6 text-gray-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Selecione a escola</h2>
      </div>
      <p className="text-gray-600 mb-6">
        Como usuário do CSC, você vê os resultados de qualquer escola. Escolha uma para continuar;
        dá para trocar a qualquer momento no seletor do topo da página.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {UNIDADES_PADRONIZADAS.map((unidade) => (
          <button
            key={unidade}
            type="button"
            onClick={() => csc.setEscola(unidade)}
            className="text-left px-4 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-800 hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            {unidade}
          </button>
        ))}
      </div>
    </div>
  );
};
