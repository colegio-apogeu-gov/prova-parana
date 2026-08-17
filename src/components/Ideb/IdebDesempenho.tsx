import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2, Search, X, ChevronDown, Target, GraduationCap, Repeat, CheckCircle, Medal, Info, FileText, MapPin,
} from 'lucide-react';
import { IdebResultado, IdebEtapa, IdebAgregadoPR } from '../../types';
import {
  getIdebParceiros, getIdebResultados, getIdebAgregadoPR, getIdebHistoricoEscola,
  buscarEscolasIdeb, ETAPAS, etapaLabel,
} from '../../lib/ideb';
import { gerarInsights, Insight, InsightTipo, DadosComparacaoEtapa } from '../../lib/idebInsights';
import { gerarInsightsRegional, Insight as InsightReg, DadosRegionalEtapa } from '../../lib/idebRegionalInsights';
import { montarRelatorio, RelatorioIdeb } from '../../lib/idebRelatorio';
import { aplicarPreset, PresetEdicoes, serieEscola } from '../../lib/idebComparacao';
import IdebComparacaoControls from './IdebComparacaoControls';
import IdebSerieChart from './IdebSerieChart';
import { fmtIndicador } from '../../lib/ideb';
import {
  montarRelatorioRegional, RelatorioRegional, rotuloRegional,
} from '../../lib/idebRegionalRelatorio';
import IdebRelatorio from './IdebRelatorio';
import IdebRegionalRelatorio from './IdebRegionalRelatorio';

interface EscolaOpcao {
  inep: string;
  escola: string;
  cidade: string;
  parceiro: string | null;
}

const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const fmtIdebD = (v: number | null | undefined) => fmtIndicador(v, 'ideb');
const fmtDelta = (v: number | null | undefined) =>
  v == null || Number.isNaN(v)
    ? '—'
    : (v >= 0 ? '+' : '−') + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Aparência por tipo de insight (classes LITERAIS — o purge do Tailwind não
// sobrevive a interpolação de cor).
const TIPO_META: Record<InsightTipo, { label: string; wrap: string; icon: React.ReactNode }> = {
  evolucao: { label: 'Evolução', wrap: 'bg-violet-100 text-violet-700', icon: <Target className="w-4 h-4" /> },
  aprendizagem: { label: 'Aprendizagem', wrap: 'bg-blue-100 text-blue-700', icon: <GraduationCap className="w-4 h-4" /> },
  rendimento: { label: 'Rendimento', wrap: 'bg-teal-100 text-teal-700', icon: <Repeat className="w-4 h-4" /> },
  aprovacao: { label: 'Aprovação', wrap: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle className="w-4 h-4" /> },
  posicionamento: { label: 'Posicionamento', wrap: 'bg-amber-100 text-amber-700', icon: <Medal className="w-4 h-4" /> },
};

interface EdicaoInfo {
  anoAtual: string | null;
  anoAnterior: string | null;
  anos: string[];
}

// Card de um insight (compartilhado pelos modos escola e regional).
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
              <button
                onClick={onToggle}
                className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                {registros.length} registro(s) utilizado(s)
              </button>
              {aberto && (
                <ul className="mt-1 space-y-0.5">
                  {registros.map((r, i) => (
                    <li key={i} className="text-[11px] text-gray-500 font-mono break-all">• {r}</li>
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

interface IdebDesempenhoProps {
  // INEP de uma escola aberta a partir do Consolidado (clique nas tabelas de variação).
  escolaInicial?: string;
}

const IdebDesempenho: React.FC<IdebDesempenhoProps> = ({ escolaInicial }) => {
  // Dados de referência (independentes da escola), carregados uma vez.
  const [parceiros, setParceiros] = useState<IdebResultado[]>([]);
  const [agregado, setAgregado] = useState<IdebAgregadoPR[]>([]);
  const [baseByEtapa, setBaseByEtapa] = useState<Record<IdebEtapa, IdebResultado[]>>({
    anos_finais: [], ensino_medio: [],
  });
  const [edicoes, setEdicoes] = useState<Record<IdebEtapa, EdicaoInfo>>({
    anos_finais: { anoAtual: null, anoAnterior: null, anos: [] },
    ensino_medio: { anoAtual: null, anoAnterior: null, anos: [] },
  });
  const [loadingBase, setLoadingBase] = useState(true);
  const [erro, setErro] = useState('');
  const [relatorio, setRelatorio] = useState<RelatorioIdeb | null>(null);

  // Modo de análise: por escola (padrão) ou por regional (SJP/GUA/CWT).
  const [modo, setModo] = useState<'escola' | 'regional'>('escola');
  const [regionalSel, setRegionalSel] = useState('');
  const [relatorioReg, setRelatorioReg] = useState<RelatorioRegional | null>(null);

  // Escola selecionada + histórico dela.
  const [escolaSel, setEscolaSel] = useState('');
  const [escolaInfo, setEscolaInfo] = useState<EscolaOpcao | null>(null);
  const [hist, setHist] = useState<IdebResultado[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);

  // Combo de busca.
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [resultadosBusca, setResultadosBusca] = useState<EscolaOpcao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  // Registros utilizados visíveis por insight (índice → aberto).
  const [regsAbertos, setRegsAbertos] = useState<Set<number>>(new Set());

  // Comparativo base × comparada (edições) — dirige o par-resumo e a trajetória.
  const [cmpBase, setCmpBase] = useState('');
  const [cmpComp, setCmpComp] = useState('');
  const [cmpEdicoes, setCmpEdicoes] = useState<string[]>([]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Carrega, uma vez: agregado (edições) + escolas parceiras + base da edição
  // atual de cada etapa (para médias e rankings).
  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLoadingBase(true);
      try {
        const [ag, pc] = await Promise.all([getIdebAgregadoPR(), getIdebParceiros()]);
        if (cancelado) return;
        setParceiros(pc);
        setAgregado(ag as IdebAgregadoPR[]);

        const info = {} as Record<IdebEtapa, EdicaoInfo>;
        (ETAPAS as { key: IdebEtapa }[]).forEach((e) => {
          const anos = (ag as IdebAgregadoPR[])
            .filter((a) => a.etapa === e.key)
            .map((a) => a.ano)
            .sort((a, b) => a.localeCompare(b));
          info[e.key] = {
            anoAtual: anos[anos.length - 1] ?? null,
            anoAnterior: anos[anos.length - 2] ?? null,
            anos,
          };
        });
        setEdicoes(info);

        const bases = { anos_finais: [], ensino_medio: [] } as Record<IdebEtapa, IdebResultado[]>;
        await Promise.all(
          (ETAPAS as { key: IdebEtapa }[]).map(async (e) => {
            const at = info[e.key].anoAtual;
            bases[e.key] = at ? await getIdebResultados(e.key, at) : [];
          })
        );
        if (!cancelado) setBaseByEtapa(bases);
      } catch (e) {
        console.error(e);
        if (!cancelado) setErro('Não foi possível carregar os dados do IDEB. Verifique se as tabelas ideb_resultados e ideb_pr_agregado foram criadas.');
      } finally {
        if (!cancelado) setLoadingBase(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  // Busca no servidor (não baixa a base inteira de escolas).
  useEffect(() => {
    const q = busca.trim();
    if (!aberto || q.length < 2) { setResultadosBusca([]); return; }
    let cancelado = false;
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        // A busca não depende de etapa aqui: procura em anos finais e mescla por INEP.
        const res = await buscarEscolasIdeb(q, 'anos_finais', 40);
        if (!cancelado) setResultadosBusca(res);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 350);
    return () => { cancelado = true; clearTimeout(t); };
  }, [busca, aberto]);

  // Histórico da escola escolhida (todas as etapas e edições).
  useEffect(() => {
    if (!escolaSel) { setHist([]); return; }
    let cancelado = false;
    setLoadingHist(true);
    (async () => {
      try {
        const rows = await getIdebHistoricoEscola(escolaSel);
        if (!cancelado) setHist(rows);
      } catch (e) {
        console.error(e);
        if (!cancelado) setErro('Não foi possível carregar o histórico da escola.');
      } finally {
        if (!cancelado) setLoadingHist(false);
      }
    })();
    return () => { cancelado = true; };
  }, [escolaSel]);

  // Escolas parceiras para o atalho do combo (APG primeiro).
  const escolasParceiras = useMemo(() => {
    const m = new Map<string, EscolaOpcao>();
    parceiros.forEach((r) => {
      if (!m.has(r.inep_codigo)) {
        m.set(r.inep_codigo, { inep: r.inep_codigo, escola: r.escola, cidade: r.cidade, parceiro: r.parceiro });
      }
    });
    return Array.from(m.values()).sort((a, b) => {
      const aApg = a.parceiro === 'apg';
      const bApg = b.parceiro === 'apg';
      return aApg === bApg ? a.escola.localeCompare(b.escola) : aApg ? -1 : 1;
    });
  }, [parceiros]);

  const parceirasFiltradas = useMemo(() => {
    const q = norm(busca);
    if (!q) return escolasParceiras;
    return escolasParceiras.filter((e) => norm(e.escola).includes(q) || norm(e.cidade).includes(q));
  }, [escolasParceiras, busca]);

  const outrasEscolas = useMemo(() => {
    const jaListadas = new Set(parceirasFiltradas.map((e) => e.inep));
    return resultadosBusca.filter((e) => !jaListadas.has(e.inep));
  }, [resultadosBusca, parceirasFiltradas]);

  const escolaAtual = escolaSel
    ? escolasParceiras.find((e) => e.inep === escolaSel) ?? escolaInfo
    : null;

  const escolherEscola = (e: EscolaOpcao | null) => {
    setEscolaSel(e?.inep ?? '');
    setEscolaInfo(e);
    setRegsAbertos(new Set());
    setAberto(false);
    setBusca('');
  };

  // Pré-seleção vinda do Consolidado: assim que a lista de parceiras carrega,
  // abre a escola clicada (é sempre uma escola parceira).
  useEffect(() => {
    if (!escolaInicial) return;
    const found = escolasParceiras.find((e) => e.inep === escolaInicial) ?? null;
    setEscolaSel(escolaInicial);
    setEscolaInfo(found);
    setModo('escola');
  }, [escolaInicial, escolasParceiras]);

  // Monta o relatório completo (determinístico) e abre o preview/export.
  const abrirRelatorio = () => {
    if (!escolaSel) return;
    setRelatorio(
      montarRelatorio({
        inep: escolaSel,
        hist,
        parceiros,
        agregado,
        baseAtual: baseByEtapa,
        edicoes,
        base: cmpBase,
        comparada: cmpComp,
        // Data de geração é metadado (não entra em cálculo determinístico).
        geradoEm: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      })
    );
  };

  // Monta a entrada e gera os insights (puro/determinístico).
  const insights: Insight[] = useMemo(() => {
    if (!escolaSel || loadingHist) return [];
    const etapas: DadosComparacaoEtapa[] = (ETAPAS as { key: IdebEtapa }[]).map((e) => ({
      etapa: e.key,
      anoAtual: edicoes[e.key].anoAtual,
      anoAnterior: edicoes[e.key].anoAnterior,
      linhasEscola: hist.filter((r) => r.etapa === e.key),
      base: baseByEtapa[e.key],
    }));
    return gerarInsights({ inep: escolaSel, etapas });
  }, [escolaSel, loadingHist, hist, edicoes, baseByEtapa]);

  const insightsPorEtapa = useMemo(() => {
    const grupos: Record<IdebEtapa, Insight[]> = { anos_finais: [], ensino_medio: [] };
    insights.forEach((ins) => {
      if (ins.etapa === 'anos_finais' || ins.etapa === 'ensino_medio') grupos[ins.etapa].push(ins);
    });
    return grupos;
  }, [insights]);

  // ---- Comparativo base × comparada (edições) ----
  // Opções = união das edições das duas etapas (2005..2025).
  const edTodas = useMemo(() => {
    const s = new Set<string>();
    (['anos_finais', 'ensino_medio'] as IdebEtapa[]).forEach((et) => edicoes[et].anos.forEach((a) => s.add(a)));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [edicoes]);
  useEffect(() => {
    if (!edTodas.length) return;
    setCmpComp((c) => (c && edTodas.includes(c) ? c : edTodas[edTodas.length - 1]));
    setCmpBase((b) => (b && edTodas.includes(b) ? b : edTodas[edTodas.length - 2] ?? edTodas[0]));
    setCmpEdicoes((prev) => (prev.length ? prev : edTodas));
  }, [edTodas]);
  const cmpPreset = (p: PresetEdicoes) => setCmpEdicoes(aplicarPreset(edTodas, p, cmpBase, cmpComp));
  const cmpToggle = (a: string) => setCmpEdicoes((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  const edPlot = useMemo(() => edTodas.filter((a) => cmpEdicoes.includes(a)), [edTodas, cmpEdicoes]);

  // Par (base, comparada) do IDEB da escola numa etapa + variação.
  const parEtapa = (et: IdebEtapa) => {
    const b = (hist.find((r) => r.etapa === et && r.ano === cmpBase)?.ideb ?? null) as number | null;
    const c = (hist.find((r) => r.etapa === et && r.ano === cmpComp)?.ideb ?? null) as number | null;
    return { base: b, comp: c, delta: b != null && c != null ? c - b : null };
  };
  // Resumo primário (ao lado do Exportar): prefere anos finais.
  const parPrimario = useMemo(() => {
    for (const et of ['anos_finais', 'ensino_medio'] as IdebEtapa[]) {
      const p = parEtapa(et);
      if (p.base != null && p.comp != null) return { etapa: et, ...p };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hist, cmpBase, cmpComp]);

  // ---- Modo regional ----------------------------------------------------
  // Regionais disponíveis (código) a partir da base parceira/regional.
  const regionais = useMemo(
    () => Array.from(new Set(parceiros.map((r) => r.regional).filter(Boolean) as string[])).sort(),
    [parceiros]
  );

  // Nº de escolas distintas por regional (para o rótulo dos chips).
  const escolasPorRegional = useMemo(() => {
    const m = new Map<string, Set<string>>();
    parceiros.forEach((r) => {
      if (r.regional) {
        if (!m.has(r.regional)) m.set(r.regional, new Set());
        m.get(r.regional)!.add(r.inep_codigo);
      }
    });
    return m;
  }, [parceiros]);

  // Se a regional escolhida sumir da base, limpa a seleção.
  useEffect(() => {
    if (regionalSel && !regionais.includes(regionalSel)) setRegionalSel('');
  }, [regionais, regionalSel]);

  // Insights regionais (puros/determinísticos).
  const insightsReg: InsightReg[] = useMemo(() => {
    if (!regionalSel || loadingBase) return [];
    const etapas: DadosRegionalEtapa[] = (ETAPAS as { key: IdebEtapa }[]).map((e) => ({
      etapa: e.key,
      anoAtual: edicoes[e.key].anoAtual,
      anoAnterior: edicoes[e.key].anoAnterior,
      linhasRegional: parceiros.filter((r) => r.etapa === e.key && r.regional === regionalSel),
      base: baseByEtapa[e.key],
    }));
    return gerarInsightsRegional({ regional: regionalSel, etapas });
  }, [regionalSel, loadingBase, parceiros, edicoes, baseByEtapa]);

  const insightsRegPorEtapa = useMemo(() => {
    const grupos: Record<IdebEtapa, InsightReg[]> = { anos_finais: [], ensino_medio: [] };
    insightsReg.forEach((ins) => {
      if (ins.etapa === 'anos_finais' || ins.etapa === 'ensino_medio') grupos[ins.etapa].push(ins);
    });
    return grupos;
  }, [insightsReg]);

  const abrirRelatorioRegional = () => {
    if (!regionalSel) return;
    setRelatorioReg(
      montarRelatorioRegional({
        regional: regionalSel,
        parceiros,
        agregado,
        baseAtual: baseByEtapa,
        edicoes,
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

  if (loadingBase) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600 mx-auto mb-4"></div>
        <p className="text-gray-500 text-sm">Carregando base do IDEB...</p>
      </div>
    );
  }

  if (erro) {
    return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{erro}</div>;
  }

  let idxGlobal = 0; // índice estável para o toggle de registros

  return (
    <div className="space-y-4">
      {/* Filtro base × comparada (no topo, modo escola) */}
      {modo === 'escola' && edTodas.length > 0 && (
        <IdebComparacaoControls
          base={cmpBase} comparada={cmpComp} opcoesEdicao={edTodas}
          chartEdicoes={edTodas} edicoesSel={cmpEdicoes}
          onBase={setCmpBase} onComparada={setCmpComp}
          onToggleEdicao={cmpToggle} onPreset={cmpPreset}
        />
      )}

      {/* Cabeçalho + metodologia */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-2">
            <div className="bg-violet-100 p-1.5 rounded-lg mt-0.5"><FileText className="w-4 h-4 text-violet-600" /></div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Insights de desempenho</h3>
              <p className="text-xs text-gray-500">
                Gerados por regras e cálculos sobre os dados do IDEB/SAEB — sem inteligência artificial. Os mesmos dados
                produzem sempre os mesmos insights. Dados ausentes aparecem como “sem registro”.
              </p>
            </div>
          </div>

          {/* Alternância Escola | Regional */}
          <div className="inline-flex items-center gap-1 bg-gray-100 rounded-full p-0.5 shrink-0">
            {([
              { k: 'escola', label: 'Por escola' },
              { k: 'regional', label: 'Por regional' },
            ] as const).map((o) => (
              <button
                key={o.k}
                onClick={() => { setModo(o.k); setRegsAbertos(new Set()); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  modo === o.k ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Seletor de escola */}
        {modo === 'escola' && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Escola:</span>
          </div>
          <div ref={comboRef} className="relative min-w-[320px]">
            <button
              type="button"
              onClick={() => { setAberto((v) => !v); setBusca(''); }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-left hover:bg-gray-50 focus:ring-2 focus:ring-violet-500"
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
                    className="w-full pl-8 pr-7 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-violet-500"
                  />
                  {busca && (
                    <button onClick={() => setBusca('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {parceirasFiltradas.map((e) => (
                    <button
                      key={e.inep}
                      onClick={() => escolherEscola(e)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${escolaSel === e.inep ? 'bg-violet-50' : ''}`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`text-sm truncate ${escolaSel === e.inep ? 'text-violet-700 font-medium' : 'text-gray-700'}`}>{e.escola}</span>
                        {e.parceiro === 'apg'
                          ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 shrink-0">APG</span>
                          : e.parceiro
                          ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">{e.parceiro}</span>
                          : null}
                      </span>
                      <span className="text-xs text-gray-400">{e.cidade}/PR</span>
                    </button>
                  ))}
                  {outrasEscolas.length > 0 && (
                    <p className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Outras escolas do PR</p>
                  )}
                  {outrasEscolas.map((e) => (
                    <button
                      key={e.inep}
                      onClick={() => escolherEscola(e)}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${escolaSel === e.inep ? 'bg-violet-50' : ''}`}
                    >
                      <span className={`block text-sm truncate ${escolaSel === e.inep ? 'text-violet-700 font-medium' : 'text-gray-700'}`}>{e.escola}</span>
                      <span className="text-xs text-gray-400">{e.cidade}/PR</span>
                    </button>
                  ))}
                  {busca.trim().length >= 2 && !buscando && parceirasFiltradas.length === 0 && outrasEscolas.length === 0 && (
                    <p className="px-3 py-4 text-sm text-gray-400 text-center">Nenhuma escola encontrada.</p>
                  )}
                  {buscando && <p className="px-3 py-2 text-xs text-gray-400 text-center">Buscando na base do PR...</p>}
                </div>
                <p className="px-3 py-1.5 text-[11px] text-gray-400 border-t border-gray-100">
                  {escolasParceiras.length} escolas parceiras · digite 2+ letras para buscar em toda a rede do PR
                </p>
              </div>
            )}
          </div>

          <button
            onClick={abrirRelatorio}
            disabled={!escolaSel || loadingHist}
            className="ml-auto flex items-center gap-2 bg-violet-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={escolaSel ? 'Gerar relatório em PDF' : 'Selecione uma escola'}
          >
            <FileText className="w-4 h-4" />
            Exportar relatório
          </button>

          {/* Resumo base × comparada (abaixo do Exportar) */}
          {escolaSel && parPrimario && (
            <div className="w-full flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-sm">
              <span className="text-gray-500">{cmpBase}:</span>
              <span className="font-semibold text-gray-800">{fmtIdebD(parPrimario.base)}</span>
              <span className="text-gray-500 ml-2">{cmpComp}:</span>
              <span className="font-semibold text-gray-800">{fmtIdebD(parPrimario.comp)}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                (parPrimario.delta ?? 0) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
              }`}>
                {fmtDelta(parPrimario.delta)}
              </span>
              <span className="text-[11px] text-gray-400">· {etapaLabel(parPrimario.etapa)}</span>
            </div>
          )}
        </div>
        )}

        {/* Seletor de regional */}
        {modo === 'regional' && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Regional:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {regionais.length === 0 ? (
              <span className="text-sm text-gray-400">Nenhuma regional na base (verifique a migration de regionais).</span>
            ) : regionais.map((cod) => (
              <button
                key={cod}
                onClick={() => { setRegionalSel((v) => (v === cod ? '' : cod)); setRegsAbertos(new Set()); }}
                title={rotuloRegional(cod)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  regionalSel === cod
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {cod}
                <span className={`ml-1.5 text-[11px] ${regionalSel === cod ? 'text-violet-100' : 'text-gray-400'}`}>
                  {rotuloRegional(cod)} · {escolasPorRegional.get(cod)?.size ?? 0}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={abrirRelatorioRegional}
            disabled={!regionalSel}
            className="ml-auto flex items-center gap-2 bg-violet-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={regionalSel ? 'Gerar relatório regional em PDF' : 'Selecione uma regional'}
          >
            <FileText className="w-4 h-4" />
            Exportar relatório
          </button>
        </div>
        )}
      </div>

      {/* Corpo — modo escola */}
      {modo === 'escola' && (
      !escolaSel ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Info className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Selecione uma escola para gerar os insights de desempenho.</p>
        </div>
      ) : loadingHist ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600 mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Calculando insights de {escolaAtual?.escola ?? 'escola'}...</p>
        </div>
      ) : (
        <div className="space-y-5">
          {(ETAPAS as { key: IdebEtapa; label: string }[]).map((e) => {
            const lista = insightsPorEtapa[e.key];
            const ed = edicoes[e.key];
            return (
              <div key={e.key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">{etapaLabel(e.key)}</h3>
                  <span className="text-xs text-violet-700">
                    {ed.anoAtual ? `edição ${ed.anoAtual}${ed.anoAnterior ? ` · anterior ${ed.anoAnterior}` : ''}` : 'sem edições na base'}
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  {/* Trajetória do IDEB (período selecionado) + variação base × comparada */}
                  {escolaSel && hist.some((r) => r.etapa === e.key && r.ideb != null) && (() => {
                    const par = parEtapa(e.key);
                    const pts = serieEscola(hist, escolaSel, e.key, edPlot).map((p) => ({ ano: p.ano, valor: p.ideb }));
                    return (
                      <div className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-gray-800">Trajetória do IDEB — {etapaLabel(e.key)}</h4>
                          <span className="text-xs text-gray-500">
                            {cmpBase}: <b className="text-gray-800">{fmtIdebD(par.base)}</b> · {cmpComp}: <b className="text-gray-800">{fmtIdebD(par.comp)}</b>
                            {par.delta != null && (
                              <span className={par.delta >= 0 ? 'text-emerald-600 ml-1' : 'text-red-500 ml-1'}>({fmtDelta(par.delta)})</span>
                            )}
                          </span>
                        </div>
                        {edPlot.length === 0 ? (
                          <p className="text-sm text-gray-400 py-6 text-center">Selecione ao menos uma edição no histórico.</p>
                        ) : (
                          <IdebSerieChart
                            series={[{ label: escolaAtual?.escola ?? 'Escola', color: '#7c3aed', pontos: pts }]}
                            domainMax={10} area height={210}
                          />
                        )}
                        <p className="text-sm text-gray-700 mt-1">
                          {par.base != null && par.comp != null
                            ? `O IDEB de ${etapaLabel(e.key)} ${par.delta! >= 0 ? 'subiu' : 'caiu'} de ${fmtIdebD(par.base)} em ${cmpBase} para ${fmtIdebD(par.comp)} em ${cmpComp} (variação de ${fmtDelta(par.delta)}).`
                            : `Sem registro do IDEB de ${etapaLabel(e.key)} em ${cmpBase} e/ou ${cmpComp} para comparar.`}
                        </p>
                      </div>
                    );
                  })()}
                  {lista.length === 0 ? (
                    <p className="text-sm text-gray-400">Sem insights para esta etapa.</p>
                  ) : (
                    lista.map((ins) => {
                      const idx = idxGlobal++;
                      const meta = TIPO_META[ins.tipo];
                      const aberto = regsAbertos.has(idx);
                      return (
                        <div key={idx} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-start gap-3">
                            <div className={`p-1.5 rounded-lg shrink-0 ${meta.wrap}`}>{meta.icon}</div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900">{ins.titulo}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${meta.wrap}`}>{meta.label}</span>
                              </div>
                              <p className="text-sm text-gray-700 leading-relaxed mt-1">{ins.descricao}</p>
                              {ins.registrosUtilizados.length > 0 && (
                                <div className="mt-2">
                                  <button
                                    onClick={() => toggleRegs(idx)}
                                    className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
                                  >
                                    <ChevronDown className={`w-3 h-3 transition-transform ${aberto ? 'rotate-180' : ''}`} />
                                    {ins.registrosUtilizados.length} registro(s) utilizado(s)
                                  </button>
                                  {aberto && (
                                    <ul className="mt-1 space-y-0.5">
                                      {ins.registrosUtilizados.map((r, i) => (
                                        <li key={i} className="text-[11px] text-gray-500 font-mono break-all">• {r}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

          <p className="text-[11px] text-gray-400 px-1">
            Fonte: IDEB/SAEB — Inep. Médias simples de escolas com resultado disponível (escolas sem dado não entram nas
            médias). Rankings por IDEB decrescente; empates recebem a mesma posição. Comparações de município e Paraná
            consideram a rede estadual.
          </p>
        </div>
      )
      )}

      {/* Corpo — modo regional */}
      {modo === 'regional' && (
      !regionalSel ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Info className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Selecione uma regional para gerar os insights de desempenho.</p>
        </div>
      ) : loadingBase ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600 mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Calculando insights da regional {regionalSel}...</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-violet-50/60 border border-violet-100 rounded-xl px-4 py-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-violet-600" />
            <span className="text-sm text-gray-700">
              Regional <strong>{regionalSel}</strong> · {rotuloRegional(regionalSel)} ·{' '}
              {escolasPorRegional.get(regionalSel)?.size ?? 0} escola(s) do grupo APG. As notas são médias simples das
              escolas com resultado (escolas sem dado não entram).
            </span>
          </div>
          {(ETAPAS as { key: IdebEtapa; label: string }[]).map((e) => {
            const lista = insightsRegPorEtapa[e.key];
            const ed = edicoes[e.key];
            return (
              <div key={e.key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">{etapaLabel(e.key)}</h3>
                  <span className="text-xs text-violet-700">
                    {ed.anoAtual ? `edição ${ed.anoAtual}${ed.anoAnterior ? ` · anterior ${ed.anoAnterior}` : ''}` : 'sem edições na base'}
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  {lista.length === 0 ? (
                    <p className="text-sm text-gray-400">Sem insights para esta etapa.</p>
                  ) : (
                    lista.map((ins) => {
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
              </div>
            );
          })}

          <p className="text-[11px] text-gray-400 px-1">
            Fonte: IDEB/SAEB — Inep. A nota da regional em cada indicador é a média simples das escolas do grupo APG na
            regional com resultado naquela edição (escolas sem dado não entram). Rankings entre regionais por IDEB médio
            decrescente; empates recebem a mesma posição.
          </p>
        </div>
      )
      )}

      {relatorio && <IdebRelatorio relatorio={relatorio} onClose={() => setRelatorio(null)} />}
      {relatorioReg && <IdebRegionalRelatorio relatorio={relatorioReg} onClose={() => setRelatorioReg(null)} />}
    </div>
  );
};

export default IdebDesempenho;
