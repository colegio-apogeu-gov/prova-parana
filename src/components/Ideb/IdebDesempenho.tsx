import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2, Search, X, ChevronDown, Target, GraduationCap, Repeat, CheckCircle, Medal, Info, FileText,
} from 'lucide-react';
import { IdebResultado, IdebEtapa, IdebAgregadoPR } from '../../types';
import {
  getIdebParceiros, getIdebResultados, getIdebAgregadoPR, getIdebHistoricoEscola,
  buscarEscolasIdeb, ETAPAS, etapaLabel,
} from '../../lib/ideb';
import { gerarInsights, Insight, InsightTipo, DadosComparacaoEtapa } from '../../lib/idebInsights';
import { montarRelatorio, RelatorioIdeb } from '../../lib/idebRelatorio';
import IdebRelatorio from './IdebRelatorio';

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

const IdebDesempenho: React.FC = () => {
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
      {/* Cabeçalho + metodologia */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-start gap-2 mb-3">
          <div className="bg-violet-100 p-1.5 rounded-lg mt-0.5"><FileText className="w-4 h-4 text-violet-600" /></div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Insights de desempenho</h3>
            <p className="text-xs text-gray-500">
              Gerados por regras e cálculos sobre os dados do IDEB/SAEB — sem inteligência artificial. Os mesmos dados
              produzem sempre os mesmos insights. Dados ausentes aparecem como “sem registro”.
            </p>
          </div>
        </div>

        {/* Seletor de escola */}
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
        </div>
      </div>

      {/* Corpo */}
      {!escolaSel ? (
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
      )}

      {relatorio && <IdebRelatorio relatorio={relatorio} onClose={() => setRelatorio(null)} />}
    </div>
  );
};

export default IdebDesempenho;
