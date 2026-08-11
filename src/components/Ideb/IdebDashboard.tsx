import React, { useState, useEffect, useMemo } from 'react';
import {
  Target, Search, Building2, MapPin, TrendingUp, Trophy, School, Award,
  RefreshCw, LogOut, Eraser, Medal, ChevronRight, LayoutGrid, LineChart, Handshake, BookOpen, Activity,
} from 'lucide-react';
import IdebHistorico from './IdebHistorico';
import IdebConsolidado from './IdebConsolidado';
import IdebDesempenho from './IdebDesempenho';
import IdebRadar from './IdebRadar';
import IdebMapa from './IdebMapa';
import EntendaSistema from '../EntendaSistema/EntendaSistema';
import { IdebResultado, IdebEtapa, IdebIndicador } from '../../types';
import {
  getIdebResultados, getIdebAgregadoPR, ETAPAS, IDEB_INDICADORES,
  indicadorValue, indicadorLabel, fmtIndicador, fmtIndicadorCeil, mediaSimples, metasAtingidas, brasilValor,
} from '../../lib/ideb';

interface IdebDashboardProps {
  onSystemSwitch: () => void;
  onLogout: () => void;
}

const fmtInt = (v: number) => (v || 0).toLocaleString('pt-BR');

// Busca sem acento / caixa (ex.: "sao jose" acha "São José").
const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const cardBase = 'bg-white rounded-xl border border-gray-200 p-4';

const IdebDashboard: React.FC<IdebDashboardProps> = ({ onSystemSwitch, onLogout }) => {
  const [data, setData] = useState<IdebResultado[]>([]);
  const [anos, setAnos] = useState<string[]>([]);
  const [ano, setAno] = useState<string>('');
  const [etapa, setEtapa] = useState<IdebEtapa>('ensino_medio');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [view, setView] = useState<'dashboard' | 'consolidado' | 'historico' | 'desempenho'>('dashboard');
  const [indicador, setIndicador] = useState<IdebIndicador>('ideb');
  const [busca, setBusca] = useState('');
  // Escopo do ranking: só o grupo Apogeu ou todas as escolas do PR na base.
  const [escopo, setEscopo] = useState<'apg' | 'todas'>('apg');
  const [redeSel, setRedeSel] = useState('');
  const [cidadeSel, setCidadeSel] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [mapCidade, setMapCidade] = useState('');
  const [showEntenda, setShowEntenda] = useState(false);

  // As edições disponíveis vêm do agregado do PR (16 linhas) — não dá para
  // derivá-las das escolas sem baixar a base inteira.
  useEffect(() => {
    (async () => {
      try {
        const agregado = await getIdebAgregadoPR();
        const lista = [...new Set(agregado.filter((a) => a.etapa === etapa).map((a) => a.ano))].sort(
          (a, b) => b.localeCompare(a)
        );
        setAnos(lista);
        setAno((atual) => (atual && lista.includes(atual) ? atual : lista[0] || '2025'));
      } catch (e) {
        console.error(e);
        setErro('Não foi possível carregar os dados do IDEB. Verifique se as tabelas ideb_resultados e ideb_pr_agregado foram criadas.');
        setLoading(false);
      }
    })();
  }, [etapa]);

  // Só a edição selecionada de uma etapa por vez (~1,7 mil escolas) — a série
  // histórica completa é carregada sob demanda pela aba Histórico.
  useEffect(() => {
    // Ao trocar de etapa a lista de edições muda; espera o `ano` ser reajustado
    // para não disparar uma busca com uma edição que não existe na etapa nova.
    if (!ano || (anos.length > 0 && !anos.includes(ano))) return;
    let cancelado = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await getIdebResultados(etapa, ano);
        if (!cancelado) {
          setData(rows);
          setErro('');
        }
      } catch (e) {
        console.error(e);
        if (!cancelado) setErro('Não foi possível carregar os dados do IDEB. Verifique se a tabela ideb_resultados foi criada.');
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [etapa, ano, anos]);

  const redes = useMemo(
    () => Array.from(new Set(data.map((r) => r.rede).filter(Boolean) as string[])).sort(),
    [data]
  );
  // Só cidades com escola do grupo: a base tem ~380 municípios do PR, mas este
  // dashboard é focado no Apogeu (ranking/mapa por escola do grupo).
  const cidades = useMemo(
    () => Array.from(new Set(data.filter((r) => r.is_apogeu).map((r) => r.cidade))).sort(),
    [data]
  );

  // Escopo dos cards/ranking: filtros de rede e cidade (a busca só filtra a lista do ranking).
  const scopeAll = useMemo(
    () => data.filter((r) => (!redeSel || r.rede === redeSel) && (!cidadeSel || r.cidade === cidadeSel)),
    [data, redeSel, cidadeSel]
  );
  const scopeApg = useMemo(() => scopeAll.filter((r) => r.is_apogeu), [scopeAll]);

  // Cards
  const mediaBrasil = brasilValor(etapa, ano, indicador);
  const mediaParana = useMemo(() => mediaSimples(scopeAll, indicador), [scopeAll, indicador]);
  const mediaApg = useMemo(() => mediaSimples(scopeApg, indicador), [scopeApg, indicador]);
  const maior = useMemo(() => {
    let best: IdebResultado | null = null;
    let bv = -Infinity;
    scopeApg.forEach((r) => { const v = indicadorValue(r, indicador); if (v != null && v > bv) { bv = v; best = r; } });
    return best ? { escola: (best as IdebResultado).escola, valor: bv } : null;
  }, [scopeApg, indicador]);
  const metas = useMemo(() => metasAtingidas(scopeApg), [scopeApg]);

  // Ranking (escopo + busca), ordenado pelo indicador selecionado.
  const ranking = useMemo(() => {
    const q = norm(busca);
    const base = escopo === 'apg' ? scopeApg : scopeAll;
    return base
      .filter((r) => !q || norm(r.escola).includes(q) || norm(r.cidade).includes(q))
      .map((r) => ({ r, v: indicadorValue(r, indicador) }))
      .filter((x) => x.v != null)
      .sort((a, b) => (b.v as number) - (a.v as number)) as { r: IdebResultado; v: number }[];
  }, [scopeApg, scopeAll, escopo, busca, indicador]);

  // Quando a busca não acha nada no grupo mas acha na rede do PR, oferece ampliar o escopo.
  const foraDoGrupo = useMemo(() => {
    const q = norm(busca);
    if (escopo !== 'apg' || !q || ranking.length) return 0;
    return scopeAll.filter((r) => norm(r.escola).includes(q) || norm(r.cidade).includes(q)).length;
  }, [escopo, busca, ranking.length, scopeAll]);

  const maxRank = ranking.length ? ranking[0].v : 1;

  // Escola selecionada para o radar (default = topo do ranking).
  const selected = useMemo(
    () => ranking.find((x) => x.r.id === selectedId)?.r ?? ranking[0]?.r ?? null,
    [ranking, selectedId]
  );

  // Mapa: cidades com nº de escolas APG e média do indicador.
  const cidadesMapa = useMemo(() => {
    const byCity = new Map<string, IdebResultado[]>();
    data.filter((r) => r.is_apogeu).forEach((r) => {
      byCity.set(r.cidade, [...(byCity.get(r.cidade) || []), r]);
    });
    return Array.from(byCity.entries()).map(([cidade, rows]) => ({
      cidade, count: rows.length, media: mediaSimples(rows, indicador), rows, apg: true,
    }));
  }, [data, indicador]);

  // Default de cidade do mapa: a da escola selecionada, senão a com mais escolas.
  useEffect(() => {
    if (mapCidade && cidadesMapa.some((c) => c.cidade === mapCidade)) return;
    const def = selected?.cidade || cidadesMapa.slice().sort((a, b) => b.count - a.count)[0]?.cidade || '';
    setMapCidade(def);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cidadesMapa]);

  const mapaSel = cidadesMapa.find((c) => c.cidade === mapCidade);

  const limpar = () => { setBusca(''); setRedeSel(''); setCidadeSel(''); setEscopo('apg'); };

  const indLabel = indicadorLabel(indicador);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50/60 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-violet-600 w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shadow">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">APG Gov · Dashboard IDEB</h1>
              <p className="text-sm text-gray-500">IDEB e SAEB das escolas do grupo · dados do INEP</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-gray-400">Atualizado com o IDEB {ano || '2025'}</span>
            <button onClick={() => setShowEntenda(true)} title="Entenda o Sistema" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
              <BookOpen className="w-5 h-5" />
              <span className="hidden lg:inline">Entenda o Sistema</span>
            </button>
            <button onClick={onSystemSwitch} title="Trocar sistema" className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
              <RefreshCw className="w-5 h-5" />
            </button>
            <button onClick={onLogout} title="Sair" className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Alternância Dashboard | Consolidado APG-Salta-Tom | Histórico + etapa */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full p-1 self-start">
            {([
              { k: 'dashboard', label: 'Dashboard', icon: <LayoutGrid className="w-4 h-4" /> },
              { k: 'consolidado', label: 'Consolidado APG-Salta-Tom', icon: <Handshake className="w-4 h-4" /> },
              { k: 'historico', label: 'Histórico', icon: <LineChart className="w-4 h-4" /> },
              { k: 'desempenho', label: 'Desempenho', icon: <Activity className="w-4 h-4" /> },
            ] as const).map((t) => (
              <button
                key={t.k}
                onClick={() => setView(t.k)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  view === t.k ? 'bg-violet-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Etapa: cada uma tem série histórica e escolas próprias */}
          <div className="inline-flex items-center gap-1 bg-gray-100 rounded-full p-0.5 self-start">
            {ETAPAS.map((e) => (
              <button
                key={e.key}
                onClick={() => setEtapa(e.key)}
                title={e.anosEscolares}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  etapa === e.key ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {erro ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{erro}</div>
        ) : view === 'desempenho' ? (
          <IdebDesempenho />
        ) : view === 'historico' ? (
          <IdebHistorico etapa={etapa} />
        ) : view === 'consolidado' ? (
          <IdebConsolidado data={data} etapa={etapa} ano={ano} anos={anos} onAnoChange={setAno} loading={loading} />
        ) : loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600 mx-auto mb-4"></div>
            <p className="text-gray-500 text-sm">Carregando IDEB {ano}...</p>
          </div>
        ) : (
          <>
            {/* Filtros */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col lg:flex-row gap-3 lg:items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Edição:</span>
                <select value={ano} onChange={(e) => setAno(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500">
                  {anos.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={busca} onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar escola (grupo Apogeu ou rede do PR)..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Rede:</span>
                <select value={redeSel} onChange={(e) => setRedeSel(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 min-w-[120px]">
                  <option value="">Todas</option>
                  {redes.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Cidade:</span>
                <select value={cidadeSel} onChange={(e) => setCidadeSel(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 min-w-[120px]">
                  <option value="">Todas</option>
                  {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={limpar} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 px-2 py-2">
                <Eraser className="w-4 h-4" /> Limpar filtros
              </button>
            </div>

            {/* Abas de indicador */}
            <div className="flex flex-wrap gap-2">
              {IDEB_INDICADORES.map((i) => (
                <button
                  key={i.key}
                  onClick={() => setIndicador(i.key)}
                  title={i.descricao}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                    indicador === i.key
                      ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {i.label}
                </button>
              ))}
            </div>

            {/* Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              <div className={cardBase}>
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <div className="bg-violet-100 p-1.5 rounded-lg"><TrendingUp className="w-4 h-4 text-violet-600" /></div>
                  <span className="text-xs font-medium">Média Brasil</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{fmtIndicador(mediaBrasil, indicador)}</p>
                <p className="text-xs text-gray-400 mt-1">referência nacional do INEP</p>
              </div>
              <div className={cardBase}>
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <div className="bg-teal-100 p-1.5 rounded-lg"><MapPin className="w-4 h-4 text-teal-600" /></div>
                  <span className="text-xs font-medium">Média Paraná</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{fmtIndicadorCeil(mediaParana, indicador)}</p>
                <p className="text-xs text-gray-400 mt-1">{fmtInt(scopeAll.length)} escolas no recorte</p>
              </div>
              <div className={`${cardBase} ring-1 ring-violet-200 bg-violet-50/40`}>
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <div className="bg-violet-100 p-1.5 rounded-lg"><Building2 className="w-4 h-4 text-violet-600" /></div>
                  <span className="text-xs font-medium">Média parceiros APG</span>
                </div>
                <p className="text-2xl font-bold text-violet-700">{fmtIndicador(mediaApg, indicador)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {mediaApg != null && mediaBrasil != null
                    ? `${mediaApg >= mediaBrasil ? '+' : '−'}${fmtIndicador(Math.abs(mediaApg - mediaBrasil), indicador)} vs Brasil`
                    : `${scopeApg.length} escolas do grupo`}
                </p>
              </div>
              <div className={cardBase}>
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <div className="bg-amber-100 p-1.5 rounded-lg"><Trophy className="w-4 h-4 text-amber-600" /></div>
                  <span className="text-xs font-medium">Maior {indLabel}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{fmtIndicador(maior?.valor ?? null, indicador)}</p>
                <p className="text-xs text-gray-500 mt-1 truncate" title={maior?.escola}>{maior?.escola || '--'}</p>
              </div>
              <div className={cardBase}>
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <div className="bg-indigo-100 p-1.5 rounded-lg"><School className="w-4 h-4 text-indigo-600" /></div>
                  <span className="text-xs font-medium">Escolas avaliadas</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{fmtInt(scopeApg.length)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {metas.comMeta > 0
                    ? `${metas.atingiram} de ${metas.comMeta} bateram a meta`
                    : `de ${fmtInt(scopeAll.length)} no recorte do PR`}
                </p>
              </div>
            </div>

            {/* Ranking + Perfil */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Ranking */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      Ranking · {escopo === 'apg' ? 'Grupo Apogeu' : 'Escolas do PR'}
                    </h3>
                    <p className="text-xs text-gray-500">Ordenado por {indLabel} · {ranking.length} escolas</p>
                  </div>
                  <Medal className="w-5 h-5 text-violet-500" />
                </div>

                {/* Escopo do ranking */}
                <div className="inline-flex items-center gap-1 bg-gray-100 rounded-full p-0.5 mb-3">
                  {([
                    { k: 'apg', label: 'Grupo Apogeu' },
                    { k: 'todas', label: 'Todas do PR' },
                  ] as const).map((o) => (
                    <button
                      key={o.k}
                      onClick={() => setEscopo(o.k)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        escopo === o.k ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                  {ranking.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-gray-400">Nenhuma escola encontrada.</p>
                      {foraDoGrupo > 0 && (
                        <button
                          onClick={() => setEscopo('todas')}
                          className="mt-2 text-sm font-medium text-violet-700 hover:text-violet-800 underline underline-offset-2"
                        >
                          Ver {foraDoGrupo} {foraDoGrupo === 1 ? 'escola' : 'escolas'} fora do grupo
                        </button>
                      )}
                    </div>
                  ) : ranking.map(({ r, v }, idx) => {
                    const isSel = selected?.id === r.id;
                    const bateuMeta = r.meta != null && r.ideb != null && r.ideb >= r.meta;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        className={`w-full text-left rounded-lg p-3 border transition-colors ${
                          isSel ? 'bg-violet-50 border-violet-300' : 'bg-white border-gray-100 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            idx === 0 ? 'bg-violet-600 text-white' : idx < 3 ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'
                          }`}>{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-gray-900 text-sm truncate">
                                {r.escola}
                                {escopo === 'todas' && r.is_apogeu && (
                                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 align-middle">APG</span>
                                )}
                                {bateuMeta && (
                                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 align-middle">meta</span>
                                )}
                              </p>
                              <div className="shrink-0 text-right">
                                <span className="block text-sm font-bold text-gray-900 leading-tight">{fmtIndicador(v, indicador)}</span>
                                <span className="block text-[11px] text-gray-500 leading-tight">IDEB {fmtIndicador(r.ideb, 'ideb')}</span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500">
                              {r.cidade}/PR · {r.rede || '--'}
                              {r.posicao_geral ? ` · #${fmtInt(r.posicao_geral)} no PR` : ''}
                            </p>
                            <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-violet-500 rounded-full" style={{ width: `${maxRank ? (v / maxRank) * 100 : 0}%` }} />
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Perfil da escola (radar) */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-semibold text-gray-900">Perfil da escola</h3>
                  <span className="text-xs text-gray-400">Radar 5 pontas</span>
                </div>
                <p className="text-sm font-medium text-violet-700 mb-2 truncate">{selected?.escola || '--'}</p>
                {selected ? (
                  <IdebRadar escola={selected} referencia={scopeApg} refLabel="Média APG" accent="#7c3aed" />
                ) : (
                  <p className="text-sm text-gray-400 py-10 text-center">Selecione uma escola no ranking.</p>
                )}
              </div>
            </div>

            {/* Mapa de escolas */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="mb-3">
                <h3 className="text-base font-semibold text-gray-900">Mapa de escolas · Grupo Apogeu</h3>
                <p className="text-xs text-gray-500">
                  {scopeApg.length} escolas · IDEB {ano} · {ETAPAS.find((e) => e.key === etapa)?.short} · clique nos pontos
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-gray-50/60 rounded-lg border border-gray-100 min-h-[300px]">
                  <IdebMapa cidades={cidadesMapa} grupoColor="#7c3aed" selected={mapCidade} onSelect={setMapCidade} indicador={indicador} />
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 tracking-wide">CIDADE SELECIONADA</p>
                    <p className="text-lg font-bold text-gray-900">{mapCidade || '--'}{mapCidade ? '/PR' : ''}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
                      <p className="text-[11px] text-gray-500">Escolas</p>
                      <p className="text-xl font-bold text-gray-900">{mapaSel?.count ?? 0}</p>
                    </div>
                    <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
                      <p className="text-[11px] text-gray-500">{indLabel} {ano}</p>
                      <p className="text-xl font-bold text-violet-700">{fmtIndicador(mapaSel?.media ?? null, indicador)}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {(mapaSel?.rows || [])
                      .slice()
                      .sort((a, b) => (indicadorValue(b, indicador) ?? 0) - (indicadorValue(a, indicador) ?? 0))
                      .map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setSelectedId(r.id)}
                          className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50 text-left"
                        >
                          <span className="text-sm text-gray-700 truncate">{r.escola}</span>
                          <span className="flex items-center gap-1 shrink-0">
                            <span className="text-sm font-semibold text-gray-900">{fmtIndicador(indicadorValue(r, indicador), indicador)}</span>
                            <ChevronRight className="w-4 h-4 text-gray-300" />
                          </span>
                        </button>
                      ))}
                    {mapaSel && mapaSel.rows.length === 0 && (
                      <p className="text-sm text-gray-400 py-4 text-center">Sem escolas do grupo nesta cidade.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
              <Award className="w-3.5 h-3.5" />
              <span>
                Base: IDEB {ano} · {ETAPAS.find((e) => e.key === etapa)?.label} · {fmtInt(data.length)} escolas do PR.
                O IDEB é a nota de Aprendizado (N) multiplicada pelo Fluxo (P); as médias de recorte são aritméticas,
                já que o INEP não publica o nº de participantes por escola. "Média Brasil" é a referência nacional do INEP.
              </span>
            </div>
          </>
        )}
      </div>

      <EntendaSistema system="ideb" open={showEntenda} onClose={() => setShowEntenda(false)} />
    </div>
  );
};

export default IdebDashboard;
