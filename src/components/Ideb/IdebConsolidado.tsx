import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Building2, MapPin, TrendingUp, Trophy, School, Medal, ChevronRight, Eraser, Handshake,
} from 'lucide-react';
import IdebRadar from './IdebRadar';
import IdebMapa from './IdebMapa';
import { IdebResultado, IdebEtapa, IdebIndicador, EnemParceiro } from '../../types';
import {
  IDEB_INDICADORES, indicadorValue, indicadorLabel, fmtIndicador, fmtIndicadorCeil, mediaSimples, metasAtingidas,
  brasilValor, PARCEIROS, parceiroLabel, parceiroColor, APG_BLUE, ETAPAS,
} from '../../lib/ideb';

interface IdebConsolidadoProps {
  data: IdebResultado[];   // escolas do PR na etapa/edição selecionadas
  etapa: IdebEtapa;
  ano: string;
  anos: string[];
  onAnoChange: (a: string) => void;
  loading: boolean;
}

const fmtInt = (v: number) => (v || 0).toLocaleString('pt-BR');

const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const cardBase = 'bg-white rounded-xl border border-gray-200 p-4';

const IdebConsolidado: React.FC<IdebConsolidadoProps> = ({ data, etapa, ano, anos, onAnoChange, loading }) => {
  const [indicador, setIndicador] = useState<IdebIndicador>('ideb');
  const [busca, setBusca] = useState('');
  const [redeSel, setRedeSel] = useState('');
  const [cidadeSel, setCidadeSel] = useState('');
  const [parceirosFiltro, setParceirosFiltro] = useState<EnemParceiro[]>([]); // vazio = todos
  const [rankGrupo, setRankGrupo] = useState<EnemParceiro | 'todos'>('apg');
  const [skillGrupo, setSkillGrupo] = useState<EnemParceiro>('apg');
  const [mapGrupo, setMapGrupo] = useState<EnemParceiro>('apg');
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [mapCidade, setMapCidade] = useState('');

  const redes = useMemo(
    () => Array.from(new Set(data.map((r) => r.rede).filter(Boolean) as string[])).sort(),
    [data]
  );
  // Cidades: só as que têm escola parceira (a base tem ~380 municípios do PR).
  const cidades = useMemo(
    () => Array.from(new Set(data.filter((r) => r.parceiro).map((r) => r.cidade))).sort(),
    [data]
  );

  const toggleParceiro = (p: EnemParceiro) =>
    setParceirosFiltro((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  // Escopo dos cards: obedece rede, cidade e o filtro Parceiros.
  const scopeAll = useMemo(
    () => data.filter((r) =>
      (!redeSel || r.rede === redeSel) &&
      (!cidadeSel || r.cidade === cidadeSel) &&
      (parceirosFiltro.length === 0 || (r.parceiro != null && parceirosFiltro.includes(r.parceiro)))
    ),
    [data, redeSel, cidadeSel, parceirosFiltro]
  );
  const scopeApg = useMemo(() => scopeAll.filter((r) => r.parceiro === 'apg'), [scopeAll]);
  const scopeParceiros = useMemo(() => scopeAll.filter((r) => r.parceiro != null), [scopeAll]);

  // ---- Cards ----
  const mediaBrasil = brasilValor(etapa, ano, indicador);
  const mediaParana = useMemo(() => mediaSimples(scopeAll, indicador), [scopeAll, indicador]);
  const mediaApg = useMemo(() => mediaSimples(scopeApg, indicador), [scopeApg, indicador]);
  const mediaParceiros = useMemo(() => mediaSimples(scopeParceiros, indicador), [scopeParceiros, indicador]);
  const maior = useMemo(() => {
    let best: IdebResultado | null = null;
    let bv = -Infinity;
    scopeApg.forEach((r) => { const v = indicadorValue(r, indicador); if (v != null && v > bv) { bv = v; best = r; } });
    return best ? { escola: (best as IdebResultado).escola, valor: bv } : null;
  }, [scopeApg, indicador]);
  const metas = useMemo(() => metasAtingidas(scopeParceiros), [scopeParceiros]);

  // ---- Ranking (grupo próprio; 'todos' = os 3 grupos juntos) ----
  const ranking = useMemo(() => {
    const q = norm(busca);
    return data
      .filter((r) => (rankGrupo === 'todos' ? r.parceiro != null : r.parceiro === rankGrupo))
      .filter((r) => (!redeSel || r.rede === redeSel) && (!cidadeSel || r.cidade === cidadeSel))
      .filter((r) => !q || norm(r.escola).includes(q) || norm(r.cidade).includes(q))
      .map((r) => ({ r, v: indicadorValue(r, indicador) }))
      .filter((x) => x.v != null)
      .sort((a, b) => (b.v as number) - (a.v as number)) as { r: IdebResultado; v: number }[];
  }, [data, rankGrupo, redeSel, cidadeSel, busca, indicador]);
  const maxRank = ranking.length ? ranking[0].v : 1;

  // ---- Perfil (grupo próprio) ----
  const escolasSkill = useMemo(
    () => data
      .filter((r) => r.parceiro === skillGrupo && (!redeSel || r.rede === redeSel) && (!cidadeSel || r.cidade === cidadeSel))
      .map((r) => ({ r, v: indicadorValue(r, 'ideb') ?? 0 }))
      .sort((a, b) => b.v - a.v),
    [data, skillGrupo, redeSel, cidadeSel]
  );
  const skillRows = useMemo(() => escolasSkill.map((x) => x.r), [escolasSkill]);
  const selectedSkill = useMemo(
    () => skillRows.find((r) => r.id === selectedSkillId) ?? skillRows[0] ?? null,
    [skillRows, selectedSkillId]
  );
  const skillIsApg = skillGrupo === 'apg';
  const skillAccent = skillIsApg ? APG_BLUE : parceiroColor(skillGrupo);

  // ---- Mapa (grupo próprio) ----
  const cidadesMapa = useMemo(() => {
    const byCity = new Map<string, IdebResultado[]>();
    data.filter((r) => r.parceiro === mapGrupo).forEach((r) => {
      byCity.set(r.cidade, [...(byCity.get(r.cidade) || []), r]);
    });
    return Array.from(byCity.entries()).map(([cidade, rows]) => ({
      cidade, count: rows.length, media: mediaSimples(rows, indicador), rows, apg: mapGrupo === 'apg',
    }));
  }, [data, mapGrupo, indicador]);
  useEffect(() => {
    if (mapCidade && cidadesMapa.some((c) => c.cidade === mapCidade)) return;
    setMapCidade(cidadesMapa.slice().sort((a, b) => b.count - a.count)[0]?.cidade || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cidadesMapa]);
  const mapaSel = cidadesMapa.find((c) => c.cidade === mapCidade);

  const limpar = () => { setBusca(''); setRedeSel(''); setCidadeSel(''); setParceirosFiltro([]); };
  const indLabel = indicadorLabel(indicador);

  // Toggle de grupo reutilizável (Apg/Salta/Tom) para ranking, perfil e mapa.
  // `withTodos` acrescenta a opção "Todos" (usada só no ranking).
  const GrupoToggle = ({ value, onChange, withTodos }: {
    value: string;
    onChange: (p: EnemParceiro | 'todos') => void;
    withTodos?: boolean;
  }) => {
    const opcoes: { key: EnemParceiro | 'todos'; label: string }[] = [
      ...(withTodos ? [{ key: 'todos' as const, label: 'Todos' }] : []),
      ...PARCEIROS.map((p) => ({ key: p.key, label: p.label })),
    ];
    return (
      <div className="inline-flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
        {opcoes.map((p) => (
          <button key={p.key} onClick={() => onChange(p.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              value === p.key
                ? p.key === 'apg' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}>
            {p.label}
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600 mx-auto mb-4"></div>
        <p className="text-gray-500 text-sm">Carregando IDEB {ano}...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Edição:</span>
          <select value={ano} onChange={(e) => onAnoChange(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar escola..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">Rede:</span>
          <select value={redeSel} onChange={(e) => setRedeSel(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-w-[100px]">
            <option value="">Todas</option>
            {redes.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-600">Cidade:</span>
          <select value={cidadeSel} onChange={(e) => setCidadeSel(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-w-[110px]">
            <option value="">Todas</option>
            {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={limpar} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 px-2 py-2">
          <Eraser className="w-4 h-4" /> Limpar
        </button>
      </div>

      {/* Filtro Parceiros (multi) + abas de indicador */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Handshake className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Parceiros:</span>
          {PARCEIROS.map((p) => {
            const on = parceirosFiltro.includes(p.key);
            const isApg = p.key === 'apg';
            return (
              <button key={p.key} onClick={() => toggleParceiro(p.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  on
                    ? isApg ? 'bg-blue-600 text-white border-blue-600' : 'text-white border-transparent'
                    : isApg ? 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
                style={on && !isApg ? { backgroundColor: p.color } : undefined}>
                {p.label}
              </button>
            );
          })}
          {parceirosFiltro.length > 0 && (
            <button onClick={() => setParceirosFiltro([])} className="text-xs text-gray-400 hover:text-gray-600 underline">todos</button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {IDEB_INDICADORES.map((i) => (
            <button key={i.key} onClick={() => setIndicador(i.key)} title={i.descricao}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                indicador === i.key ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}>
              {i.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards (6) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className={cardBase}>
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <div className="bg-slate-100 p-1.5 rounded-lg"><TrendingUp className="w-4 h-4 text-slate-600" /></div>
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
        {/* APG destacado com contorno azul */}
        <div className={`${cardBase} ring-2 ring-blue-500 bg-blue-50/40`}>
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <div className="bg-blue-100 p-1.5 rounded-lg"><Building2 className="w-4 h-4 text-blue-600" /></div>
            <span className="text-xs font-medium">Média parceiros APG</span>
          </div>
          <p className="text-2xl font-bold text-blue-700">{fmtIndicador(mediaApg, indicador)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {mediaApg != null && mediaBrasil != null
              ? `${mediaApg >= mediaBrasil ? '+' : '−'}${fmtIndicador(Math.abs(mediaApg - mediaBrasil), indicador)} vs Brasil`
              : `${scopeApg.length} escolas`}
          </p>
        </div>
        <div className={cardBase}>
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <div className="bg-violet-100 p-1.5 rounded-lg"><Handshake className="w-4 h-4 text-violet-600" /></div>
            <span className="text-xs font-medium">Média Parceiros da Escola</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmtIndicador(mediaParceiros, indicador)}</p>
          <p className="text-xs text-gray-400 mt-1">Apg + Salta + Tom · {scopeParceiros.length} escolas</p>
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
            <span className="text-xs font-medium">Escolas parceiras</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmtInt(scopeParceiros.length)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {metas.comMeta > 0 ? `${metas.atingiram} de ${metas.comMeta} bateram a meta` : `avaliadas em ${ano}`}
          </p>
        </div>
      </div>

      {/* Ranking + Perfil */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ranking */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Ranking · Parceiros da Escola</h3>
              <p className="text-xs text-gray-500">
                {rankGrupo === 'todos' ? 'Todos' : parceiroLabel(rankGrupo)} · ordenado por {indLabel} · {ranking.length} escolas
              </p>
            </div>
            <Medal className="w-5 h-5 text-blue-500" />
          </div>
          <div className="mb-3"><GrupoToggle value={rankGrupo} onChange={setRankGrupo} withTodos /></div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {ranking.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Nenhuma escola encontrada.</p>
            ) : ranking.map(({ r, v }, idx) => {
              const apg = r.parceiro === 'apg';
              const bateuMeta = r.meta != null && r.ideb != null && r.ideb >= r.meta;
              return (
                <div key={r.id}
                  className={`rounded-lg p-3 border ${apg ? 'border-blue-300 ring-1 ring-blue-200 bg-blue-50/40' : 'border-gray-100 bg-white'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      idx === 0 ? 'bg-blue-600 text-white' : idx < 3 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {r.escola}
                          {apg && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 align-middle">APG</span>}
                          {rankGrupo === 'todos' && !apg && (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 align-middle">{parceiroLabel(r.parceiro)}</span>
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
                        {r.cidade}/{r.uf} · {r.rede || '--'}{r.posicao_geral ? ` · #${fmtInt(r.posicao_geral)} no PR` : ''}
                      </p>
                      <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${maxRank ? (v / maxRank) * 100 : 0}%`, backgroundColor: apg ? APG_BLUE : parceiroColor(r.parceiro) }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Perfil das escolas parceiras */}
        <div className={`bg-white rounded-xl border p-5 ${skillIsApg ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">Perfil das escolas parceiras</h3>
            <GrupoToggle value={skillGrupo} onChange={(p) => setSkillGrupo(p as EnemParceiro)} />
          </div>
          <select
            value={selectedSkill?.id ?? ''}
            onChange={(e) => setSelectedSkillId(e.target.value)}
            className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
            {skillRows.length === 0 && <option value="">Sem escolas</option>}
            {skillRows.map((r) => <option key={r.id} value={r.id}>{r.escola} — {r.cidade}</option>)}
          </select>
          {selectedSkill ? (
            <IdebRadar
              escola={selectedSkill}
              referencia={skillRows}
              refLabel={`Média ${parceiroLabel(skillGrupo)}`}
              accent={skillAccent}
            />
          ) : (
            <p className="text-sm text-gray-400 py-10 text-center">Sem escolas para este grupo no recorte atual.</p>
          )}
        </div>
      </div>

      {/* Mapa de escolas · Parceiros da escola */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Mapa de escolas · Parceiros da escola</h3>
            <p className="text-xs text-gray-500">
              {parceiroLabel(mapGrupo)} · {cidadesMapa.reduce((s, c) => s + c.count, 0)} escolas · IDEB {ano}
            </p>
          </div>
          <GrupoToggle value={mapGrupo} onChange={(p) => setMapGrupo(p as EnemParceiro)} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-gray-50/60 rounded-lg border border-gray-100 min-h-[320px]">
            <IdebMapa cidades={cidadesMapa} grupoColor={parceiroColor(mapGrupo)} selected={mapCidade} onSelect={setMapCidade} indicador={indicador} />
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 tracking-wide">CIDADE SELECIONADA</p>
              <p className="text-lg font-bold text-gray-900">{mapCidade || '--'}{mapCidade ? '/PR' : ''}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="text-[11px] text-gray-500">Escolas</p>
                <p className="text-xl font-bold text-gray-900">{mapaSel?.count ?? 0}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="text-[11px] text-gray-500">{indLabel} {ano}</p>
                <p className="text-xl font-bold text-blue-700">{fmtIndicador(mapaSel?.media ?? null, indicador)}</p>
              </div>
            </div>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
              {(mapaSel?.rows || []).slice().sort((a, b) => (indicadorValue(b, indicador) ?? 0) - (indicadorValue(a, indicador) ?? 0)).map((r) => (
                <div key={r.id}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${r.parceiro === 'apg' ? 'border-blue-300 ring-1 ring-blue-200 bg-blue-50/40' : 'border-gray-100'}`}>
                  <span className="text-sm text-gray-700 truncate">
                    {r.escola}
                    {r.parceiro === 'apg' && <span className="ml-1 text-[10px] px-1 py-0.5 rounded-full bg-blue-100 text-blue-700">APG</span>}
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-semibold text-gray-900">{fmtIndicador(indicadorValue(r, indicador), indicador)}</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </span>
                </div>
              ))}
              {mapaSel && mapaSel.rows.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">Sem escolas deste grupo nesta cidade.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
        <Handshake className="w-3.5 h-3.5" />
        <span>
          Base: IDEB {ano} · {ETAPAS.find((e) => e.key === etapa)?.label} · {fmtInt(data.length)} escolas do PR.
          APG (nosso grupo) sempre destacado em azul. "Média Brasil" é a referência nacional do INEP.
        </span>
      </div>
    </div>
  );
};

export default IdebConsolidado;
