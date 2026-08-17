import React from 'react';
import { CalendarRange } from 'lucide-react';
import { PresetEdicoes } from '../../lib/idebComparacao';

interface Props {
  base: string;
  comparada: string;
  opcoesEdicao: string[];        // edições oferecidas nos selects base/comparada
  chartEdicoes: string[];        // todas as edições da etapa (chips do histórico)
  edicoesSel: string[];          // edições marcadas para o gráfico
  onBase: (a: string) => void;
  onComparada: (a: string) => void;
  onToggleEdicao: (a: string) => void;
  onPreset: (p: PresetEdicoes) => void;
}

// Filtro reutilizado no Consolidado e no Desempenho: escolhe o par base×comparada
// e quais edições entram no gráfico de série (com atalhos Todas / Últimas 3 / Só o par).
const IdebComparacaoControls: React.FC<Props> = ({
  base, comparada, opcoesEdicao, chartEdicoes, edicoesSel,
  onBase, onComparada, onToggleEdicao, onPreset,
}) => {
  const sel = new Set(edicoesSel);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col xl:flex-row xl:items-center gap-3">
      <div className="flex items-end gap-2">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Edição base</label>
          <select value={base} onChange={(e) => onBase(e.target.value)}
            className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500">
            {opcoesEdicao.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <span className="pb-2.5 text-xs text-gray-400">vs</span>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Edição comparada</label>
          <select value={comparada} onChange={(e) => onComparada(e.target.value)}
            className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500">
            {opcoesEdicao.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 text-[11px] font-medium text-gray-500">
          <CalendarRange className="w-3.5 h-3.5" />
          Edições no histórico ({sel.size})
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chartEdicoes.map((a) => {
            const on = sel.has(a);
            return (
              <button key={a} onClick={() => onToggleEdicao(a)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  on ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {a}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 self-start xl:self-center text-xs">
        {([
          { k: 'todas', label: 'Todas' },
          { k: 'ultimas3', label: 'Últimas 3' },
          { k: 'par', label: 'Só o par' },
        ] as const).map((o) => (
          <button key={o.k} onClick={() => onPreset(o.k)}
            className="px-2.5 py-1 rounded-lg text-gray-500 hover:text-violet-700 hover:bg-violet-50 font-medium transition-colors">
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default IdebComparacaoControls;
