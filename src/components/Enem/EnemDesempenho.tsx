import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2, Search, X, ChevronDown, TrendingUp, Layers, PenLine, Users, Medal, Info, FileText,
} from 'lucide-react';
import { EnemResultado } from '../../types';
import { gerarInsightsEnem, Insight, InsightTipo } from '../../lib/enemInsights';
import { montarRelatorioEnem, RelatorioEnem } from '../../lib/enemRelatorio';
import EnemRelatorio from './EnemRelatorio';

interface EnemDesempenhoProps {
  data: EnemResultado[];   // todas as escolas, todas as edições (já carregado no dashboard)
  anos: string[];          // edições disponíveis (descendente, como no dashboard)
}

interface EscolaOpcao {
  inep: string;
  escola: string;
  cidade: string;
  parceiro: string | null;
}

const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Aparência por tipo de insight (classes LITERAIS — o purge do Tailwind não
// sobrevive a interpolação de cor).
const TIPO_META: Record<InsightTipo, { label: string; wrap: string; icon: React.ReactNode }> = {
  evolucao: { label: 'Evolução', wrap: 'bg-emerald-100 text-emerald-700', icon: <TrendingUp className="w-4 h-4" /> },
  area: { label: 'Áreas', wrap: 'bg-blue-100 text-blue-700', icon: <Layers className="w-4 h-4" /> },
  redacao: { label: 'Redação', wrap: 'bg-violet-100 text-violet-700', icon: <PenLine className="w-4 h-4" /> },
  participacao: { label: 'Participação', wrap: 'bg-teal-100 text-teal-700', icon: <Users className="w-4 h-4" /> },
  posicionamento: { label: 'Posicionamento', wrap: 'bg-amber-100 text-amber-700', icon: <Medal className="w-4 h-4" /> },
};

// Card de um insight.
const InsightCard: React.FC<{
  tipo: InsightTipo; titulo: string; descricao: string; registros: string[];
  aberto: boolean; onToggle: () => void;
}> = ({ tipo, titulo, descricao, registros, aberto, onToggle }) => {
  const meta = TIPO_META[tipo];
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <div className={`p-1.5 rounded-lg shrink-0 ${meta.wrap}`}>{meta.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{titulo}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${meta.wrap}`}>{meta.label}</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed mt-1">{descricao}</p>
          {registros.length > 0 && (
            <div className="mt-2">
              <button onClick={onToggle} className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                <ChevronDown className={`w-3 h-3 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                {registros.length} registro(s) utilizado(s)
              </button>
              {aberto && (
                <ul className="mt-1 space-y-0.5">
                  {registros.map((rr, i) => (
                    <li key={i} className="text-[11px] text-gray-500 font-mono break-all">• {rr}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const EnemDesempenho: React.FC<EnemDesempenhoProps> = ({ data, anos }) => {
  const [escolaSel, setEscolaSel] = useState('');
  const [escolaInfo, setEscolaInfo] = useState<EscolaOpcao | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioEnem | null>(null);

  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [regsAbertos, setRegsAbertos] = useState<Set<number>>(new Set());
  const comboRef = useRef<HTMLDivElement>(null);

  // Edições em ordem ascendente (o relatório/insights esperam a última como atual).
  const anosAsc = useMemo(() => [...anos].sort((a, b) => a.localeCompare(b)), [anos]);
  const anoAtual = anosAsc[anosAsc.length - 1] ?? null;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Opções de escola: uma por INEP (dados mais recentes), APG primeiro.
  const escolas = useMemo(() => {
    const m = new Map<string, EscolaOpcao>();
    // Percorre da edição mais recente para a mais antiga p/ pegar nome/cidade atuais.
    [...data]
      .sort((a, b) => b.ano.localeCompare(a.ano))
      .forEach((r) => {
        if (r.inep_codigo && !m.has(r.inep_codigo)) {
          m.set(r.inep_codigo, { inep: r.inep_codigo, escola: r.escola, cidade: r.cidade, parceiro: r.parceiro });
        }
      });
    return Array.from(m.values()).sort((a, b) => {
      const aApg = a.parceiro === 'apg';
      const bApg = b.parceiro === 'apg';
      return aApg === bApg ? a.escola.localeCompare(b.escola) : aApg ? -1 : 1;
    });
  }, [data]);

  const escolasFiltradas = useMemo(() => {
    const q = norm(busca);
    if (!q) return escolas;
    return escolas.filter((e) => norm(e.escola).includes(q) || norm(e.cidade).includes(q));
  }, [escolas, busca]);

  const parceiras = useMemo(() => escolasFiltradas.filter((e) => e.parceiro), [escolasFiltradas]);
  const outras = useMemo(() => escolasFiltradas.filter((e) => !e.parceiro), [escolasFiltradas]);

  const escolaAtual = escolaSel ? escolas.find((e) => e.inep === escolaSel) ?? escolaInfo : null;

  const escolher = (e: EscolaOpcao | null) => {
    setEscolaSel(e?.inep ?? '');
    setEscolaInfo(e);
    setRegsAbertos(new Set());
    setAberto(false);
    setBusca('');
  };

  const insights: Insight[] = useMemo(() => {
    if (!escolaSel) return [];
    return gerarInsightsEnem({ inep: escolaSel, data, anos: anosAsc });
  }, [escolaSel, data, anosAsc]);

  const abrirRelatorio = () => {
    if (!escolaSel) return;
    setRelatorio(
      montarRelatorioEnem({
        inep: escolaSel,
        data,
        anos: anosAsc,
        geradoEm: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      })
    );
  };

  const toggleRegs = (idx: number) => {
    setRegsAbertos((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  let idxGlobal = 0;

  return (
    <div className="space-y-4">
      {/* Cabeçalho + seletor */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-start gap-2 mb-3">
          <div className="bg-emerald-100 p-1.5 rounded-lg mt-0.5"><FileText className="w-4 h-4 text-emerald-600" /></div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Insights de desempenho</h3>
            <p className="text-xs text-gray-500">
              Gerados por regras e cálculos sobre os dados do ENEM — sem inteligência artificial. Os mesmos dados produzem
              sempre os mesmos insights. Dados ausentes aparecem como “sem registro”.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Escola:</span>
          </div>
          <div ref={comboRef} className="relative min-w-[320px]">
            <button
              type="button"
              onClick={() => { setAberto((v) => !v); setBusca(''); }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-left hover:bg-gray-50 focus:ring-2 focus:ring-emerald-500"
            >
              <span className="truncate">
                {escolaAtual ? escolaAtual.escola : 'Selecione uma escola...'}
                {escolaAtual && <span className="text-gray-400 font-normal"> · {escolaAtual.cidade}</span>}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
            </button>

            {aberto && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
                <div className="p-2 border-b border-gray-100 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    autoFocus
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por nome da escola ou cidade..."
                    className="w-full pl-8 pr-7 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                  {busca && (
                    <button onClick={() => setBusca('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {parceiras.map((e) => (
                    <button
                      key={e.inep}
                      onClick={() => escolher(e)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${escolaSel === e.inep ? 'bg-emerald-50' : ''}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`text-sm truncate ${escolaSel === e.inep ? 'text-emerald-700 font-medium' : 'text-gray-700'}`}>{e.escola}</span>
                        {e.parceiro === 'apg'
                          ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">APG</span>
                          : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">{e.parceiro}</span>}
                      </span>
                      <span className="text-xs text-gray-400">{e.cidade}/PR</span>
                    </button>
                  ))}
                  {outras.length > 0 && (
                    <p className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Outras escolas</p>
                  )}
                  {outras.slice(0, 60).map((e) => (
                    <button
                      key={e.inep}
                      onClick={() => escolher(e)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${escolaSel === e.inep ? 'bg-emerald-50' : ''}`}
                    >
                      <span className={`block text-sm truncate ${escolaSel === e.inep ? 'text-emerald-700 font-medium' : 'text-gray-700'}`}>{e.escola}</span>
                      <span className="text-xs text-gray-400">{e.cidade}/PR</span>
                    </button>
                  ))}
                  {busca.trim() && parceiras.length === 0 && outras.length === 0 && (
                    <p className="px-3 py-4 text-sm text-gray-400 text-center">Nenhuma escola encontrada.</p>
                  )}
                </div>
                <p className="px-3 py-1.5 text-[11px] text-gray-400 border-t border-gray-100">
                  {escolas.filter((e) => e.parceiro).length} escolas parceiras · busque por nome ou cidade
                </p>
              </div>
            )}
          </div>

          <button
            onClick={abrirRelatorio}
            disabled={!escolaSel}
            className="ml-auto flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={escolaSel ? 'Gerar relatório em PDF' : 'Selecione uma escola'}
          >
            <FileText className="w-4 h-4" />
            Exportar relatório
          </button>
        </div>
      </div>

      {/* Corpo */}
      {!escolaSel ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Info className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Selecione uma escola para gerar os insights de desempenho.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl px-4 py-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span className="text-sm text-gray-700">
              <strong>{escolaAtual?.escola}</strong> · {escolaAtual?.cidade}/PR · edição {anoAtual ?? '—'}. As médias de grupo
              (APG, município, Paraná) são ponderadas pelo nº de alunos válidos.
            </span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            {insights.length === 0 ? (
              <p className="text-sm text-gray-400">Sem insights para esta escola.</p>
            ) : (
              insights.map((ins) => {
                const idx = idxGlobal++;
                return (
                  <InsightCard
                    key={idx}
                    tipo={ins.tipo}
                    titulo={ins.titulo}
                    descricao={ins.descricao}
                    registros={ins.registrosUtilizados}
                    aberto={regsAbertos.has(idx)}
                    onToggle={() => toggleRegs(idx)}
                  />
                );
              })
            )}
          </div>
          <p className="text-[11px] text-gray-400 px-1">
            Fonte: microdados do ENEM por escola — Inep. Médias de grupo ponderadas pelo nº de alunos válidos (escolas sem
            resultado não entram). Rankings por média geral decrescente; empates recebem a mesma posição. A referência
            nacional é um valor divulgado pelo INEP.
          </p>
        </div>
      )}

      {relatorio && <EnemRelatorio relatorio={relatorio} onClose={() => setRelatorio(null)} />}
    </div>
  );
};

export default EnemDesempenho;
