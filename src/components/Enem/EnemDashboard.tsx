import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap, Search, Building2, MapPin, TrendingUp, Trophy, Users, Award,
  RefreshCw, LogOut, Eraser, Medal, ChevronRight, LayoutGrid, LineChart,
} from 'lucide-react';
import EnemHistorico from './EnemHistorico';
import { EnemResultado, EnemArea } from '../../types';
import {
  getEnemResultados, getEnemAnos, ENEM_AREAS, ENEM_RADAR_AREAS, areaValue, mediaPonderada,
} from '../../lib/enem';

interface EnemDashboardProps {
  onSystemSwitch: () => void;
  onLogout: () => void;
}

const fmt = (v: number | null | undefined, dec = 1) =>
  v == null || Number.isNaN(v) ? '--' : v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtInt = (v: number) => (v || 0).toLocaleString('pt-BR');

// Busca sem acento / caixa (ex.: "sao jose" acha "São José").
const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Média nacional por área — valor de referência fixo (mockado; sem cálculo por enquanto).
const MEDIA_NACIONAL: Record<EnemArea, number> = {
  media: 541.6,
  mt: 525.9,
  lc: 534.8,
  cn: 499.0,
  ch: 513.6,
  rd: 634.8,
};

// ---------------- Radar (SVG puro) ----------------
const RadarChart: React.FC<{ labels: string[]; school: number[]; avg: number[]; dmin: number; dmax: number }> = ({
  labels, school, avg, dmin, dmax,
}) => {
  const size = 300, cx = size / 2, cy = size / 2, R = size / 2 - 52, N = labels.length;
  const ang = (i: number) => (-90 + i * (360 / N)) * (Math.PI / 180);
  const at = (val: number, i: number) => {
    const r = Math.max(0, Math.min(1, (val - dmin) / (dmax - dmin || 1))) * R;
    return [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))] as [number, number];
  };
  const poly = (vals: number[]) => vals.map((v, i) => at(v, i).join(',')).join(' ');
  const rings = [0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[300px] mx-auto">
      {rings.map((rr, ri) => (
        <polygon
          key={ri}
          points={labels.map((_, i) => { const r = rr * R; return [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))].join(','); }).join(' ')}
          fill="none" stroke="#e5e7eb" strokeWidth={1}
        />
      ))}
      {labels.map((_, i) => { const [x, y] = at(dmax, i); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth={1} />; })}
      <polygon points={poly(avg)} fill="none" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 3" />
      <polygon points={poly(school)} fill="#10b981" fillOpacity={0.28} stroke="#059669" strokeWidth={2} />
      {school.map((v, i) => { const [x, y] = at(v, i); return <circle key={i} cx={x} cy={y} r={2.5} fill="#059669" />; })}
      {labels.map((lb, i) => {
        const [x, y] = at(dmax, i);
        const lx = cx + (x - cx) * 1.2, ly = cy + (y - cy) * 1.2;
        return <text key={i} x={lx} y={ly} fontSize={11} fill="#374151" textAnchor="middle" dominantBaseline="middle">{lb}</text>;
      })}
    </svg>
  );
};

// ---------------- Mapa esquemático das cidades ----------------
const CITY_POS: Record<string, [number, number]> = {
  'Cornélio Procópio': [52, 20],
  'Roncador': [33, 47],
  'Guarapuava': [47, 58],
  'Curitiba': [84, 48],
  'São José dos Pinhais': [88, 60],
  'Fazenda Rio Grande': [79, 68],
};

const SchoolMap: React.FC<{
  cidades: { cidade: string; count: number; media: number | null }[];
  selected: string;
  onSelect: (c: string) => void;
}> = ({ cidades, selected, onSelect }) => {
  const maxCount = Math.max(1, ...cidades.map((c) => c.count));
  return (
    <svg viewBox="0 0 100 82" className="w-full h-full">
      <defs>
        <radialGradient id="mapbg" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f0fdf4" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="42" rx="46" ry="34" fill="url(#mapbg)" stroke="#c7d2fe" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
      {/* linhas decorativas */}
      <path d="M8 34 Q 50 20 92 40" fill="none" stroke="#dbeafe" strokeWidth="0.4" strokeDasharray="1 1.5" />
      <path d="M14 56 Q 50 66 90 52" fill="none" stroke="#dbeafe" strokeWidth="0.4" strokeDasharray="1 1.5" />
      {cidades.map((c) => {
        const pos = CITY_POS[c.cidade];
        if (!pos) return null;
        const [x, y] = pos;
        const r = 2.6 + (c.count / maxCount) * 3.6;
        const isSel = c.cidade === selected;
        return (
          <g key={c.cidade} onClick={() => onSelect(c.cidade)} style={{ cursor: 'pointer' }}>
            {isSel && <circle cx={x} cy={y} r={r + 2.4} fill="#10b981" opacity={0.18} />}
            <circle cx={x} cy={y} r={r + 1.2} fill="#a7f3d0" opacity={0.6} />
            <circle cx={x} cy={y} r={r} fill={isSel ? '#059669' : '#34d399'} stroke="#ffffff" strokeWidth={0.6} />
            <text x={x + r + 1.5} y={y + 1.2} fontSize={3.1} fontWeight={isSel ? 700 : 500} fill="#065f46">{c.cidade}</text>
          </g>
        );
      })}
    </svg>
  );
};

const cardBase = 'bg-white rounded-xl border border-gray-200 p-4';

const EnemDashboard: React.FC<EnemDashboardProps> = ({ onSystemSwitch, onLogout }) => {
  const [data, setData] = useState<EnemResultado[]>([]);
  const [anos, setAnos] = useState<string[]>([]);
  const [ano, setAno] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [view, setView] = useState<'dashboard' | 'historico'>('dashboard');
  const [area, setArea] = useState<EnemArea>('media');
  const [busca, setBusca] = useState('');
  // Escopo do ranking: só o grupo Apogeu ou todas as públicas do PR na base.
  const [escopo, setEscopo] = useState<'apg' | 'todas'>('apg');
  const [regionalSel, setRegionalSel] = useState('');
  const [cidadeSel, setCidadeSel] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [mapCidade, setMapCidade] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [rows, listaAnos] = await Promise.all([getEnemResultados(), getEnemAnos()]);
        setData(rows);
        setAnos(listaAnos.length ? listaAnos : ['2025']);
        setAno(listaAnos[0] || '2025');
      } catch (e: any) {
        console.error(e);
        setErro('Não foi possível carregar os dados do ENEM. Verifique se a tabela enem_resultados foi criada.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dataAno = useMemo(() => data.filter((r) => !ano || r.ano === ano), [data, ano]);

  const regionais = useMemo(
    () => Array.from(new Set(dataAno.map((r) => r.regional).filter(Boolean) as string[])).sort(),
    [dataAno]
  );
  const cidades = useMemo(
    () => Array.from(new Set(dataAno.map((r) => r.cidade))).sort(),
    [dataAno]
  );

  // Escopo dos cards/ranking: filtros de regional e cidade (a busca só filtra a lista do ranking).
  const scopeAll = useMemo(
    () => dataAno.filter((r) => (!regionalSel || r.regional === regionalSel) && (!cidadeSel || r.cidade === cidadeSel)),
    [dataAno, regionalSel, cidadeSel]
  );
  const scopeApg = useMemo(() => scopeAll.filter((r) => r.is_apogeu), [scopeAll]);

  // Cards
  const mediaNacional = MEDIA_NACIONAL[area]; // referência fixa (mockada)
  const escolasPR = useMemo(() => scopeAll.filter((r) => r.uf === 'PR'), [scopeAll]);
  const mediaParana = useMemo(() => mediaPonderada(escolasPR, area), [escolasPR, area]);
  const mediaApg = useMemo(() => mediaPonderada(scopeApg, area), [scopeApg, area]);
  const maior = useMemo(() => {
    let best: EnemResultado | null = null;
    let bv = -Infinity;
    scopeApg.forEach((r) => { const v = areaValue(r, area); if (v != null && v > bv) { bv = v; best = r; } });
    return best ? { escola: (best as EnemResultado).escola, valor: bv } : null;
  }, [scopeApg, area]);
  const participantes = useMemo(() => scopeAll.reduce((s, r) => s + (r.alunos || 0), 0), [scopeAll]);
  const participantesApg = useMemo(() => scopeApg.reduce((s, r) => s + (r.alunos || 0), 0), [scopeApg]);

  // Ranking (escopo + busca), ordenado pela área selecionada.
  const ranking = useMemo(() => {
    const q = norm(busca);
    const base = escopo === 'apg' ? scopeApg : scopeAll;
    return base
      .filter((r) => !q || norm(r.escola).includes(q) || norm(r.cidade).includes(q))
      .map((r) => ({ r, v: areaValue(r, area) ?? 0 }))
      .sort((a, b) => b.v - a.v);
  }, [scopeApg, scopeAll, escopo, busca, area]);

  // Quando a busca não acha nada no grupo mas acha na rede pública, oferece ampliar o escopo.
  const foraDoGrupo = useMemo(() => {
    const q = norm(busca);
    if (escopo !== 'apg' || !q || ranking.length) return 0;
    return scopeAll.filter((r) => norm(r.escola).includes(q) || norm(r.cidade).includes(q)).length;
  }, [escopo, busca, ranking.length, scopeAll]);

  const maxRank = ranking.length ? ranking[0].v : 1;

  // Escola selecionada para o radar (default = topo do ranking).
  const selected = useMemo(() => {
    return ranking.find((x) => x.r.id === selectedId)?.r ?? ranking[0]?.r ?? null;
  }, [ranking, selectedId]);

  // Domínio do radar a partir das áreas das escolas APG no escopo.
  const radarDomain = useMemo(() => {
    const vals: number[] = [];
    scopeApg.forEach((r) => ENEM_RADAR_AREAS.forEach((a) => { const v = r[a.field]; if (typeof v === 'number') vals.push(v); }));
    if (!vals.length) return { dmin: 400, dmax: 900 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return { dmin: Math.max(0, Math.floor((lo - 20) / 50) * 50), dmax: Math.ceil((hi + 20) / 50) * 50 };
  }, [scopeApg]);

  const radarSchool = selected ? ENEM_RADAR_AREAS.map((a) => (selected[a.field] as number) ?? 0) : [];
  const radarAvg = ENEM_RADAR_AREAS.map((a) => mediaPonderada(scopeApg, a.key) ?? 0);

  // Mapa: cidades com nº de escolas APG e média (área selecionada).
  const cidadesMapa = useMemo(() => {
    const byCity = new Map<string, EnemResultado[]>();
    dataAno.filter((r) => r.is_apogeu).forEach((r) => {
      byCity.set(r.cidade, [...(byCity.get(r.cidade) || []), r]);
    });
    return Array.from(byCity.entries()).map(([cidade, rows]) => ({
      cidade, count: rows.length, media: mediaPonderada(rows, area), rows,
    }));
  }, [dataAno, area]);

  // Default de cidade do mapa: a da escola selecionada, senão a com mais escolas.
  useEffect(() => {
    if (mapCidade && cidadesMapa.some((c) => c.cidade === mapCidade)) return;
    const def = selected?.cidade || cidadesMapa.slice().sort((a, b) => b.count - a.count)[0]?.cidade || '';
    setMapCidade(def);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cidadesMapa]);

  const mapaSel = cidadesMapa.find((c) => c.cidade === mapCidade);

  const limpar = () => { setBusca(''); setRegionalSel(''); setCidadeSel(''); setEscopo('apg'); };

  const areaLabel = ENEM_AREAS.find((a) => a.key === area)?.label ?? 'Média Geral';

  if (loading) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando ENEM...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/60 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shadow">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Apogeu · Dashboard ENEM</h1>
              <p className="text-sm text-gray-500">Ranking e desempenho das escolas do grupo</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-gray-400">Atualizado com resultados de {ano || '2025'}</span>
            <button onClick={onSystemSwitch} title="Trocar sistema" className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
              <RefreshCw className="w-5 h-5" />
            </button>
            <button onClick={onLogout} title="Sair" className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Alternância Dashboard | Histórico */}
        <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full p-1">
          {([
            { k: 'dashboard', label: 'Dashboard', icon: <LayoutGrid className="w-4 h-4" /> },
            { k: 'historico', label: 'Histórico', icon: <LineChart className="w-4 h-4" /> },
          ] as const).map((t) => (
            <button
              key={t.k}
              onClick={() => setView(t.k)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                view === t.k ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {erro ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{erro}</div>
        ) : view === 'historico' ? (
          <EnemHistorico data={data} />
        ) : (
          <>
            {/* Filtros */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col lg:flex-row gap-3 lg:items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Ano:</span>
                <select value={ano} onChange={(e) => setAno(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500">
                  {anos.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={busca} onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar escola (grupo Apogeu ou rede pública do PR)..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Regional:</span>
                <select value={regionalSel} onChange={(e) => setRegionalSel(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 min-w-[120px]">
                  <option value="">Todas</option>
                  {regionais.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Cidade:</span>
                <select value={cidadeSel} onChange={(e) => setCidadeSel(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 min-w-[120px]">
                  <option value="">Todas</option>
                  {cidades.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={limpar} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 px-2 py-2">
                <Eraser className="w-4 h-4" /> Limpar filtros
              </button>
            </div>

            {/* Abas de área */}
            <div className="flex flex-wrap gap-2">
              {ENEM_AREAS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setArea(a.key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                    area === a.key
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>

            {/* Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              <div className={cardBase}>
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <div className="bg-emerald-100 p-1.5 rounded-lg"><TrendingUp className="w-4 h-4 text-emerald-600" /></div>
                  <span className="text-xs font-medium">Média nacional</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{fmt(mediaNacional)}</p>
                <p className="text-xs text-gray-400 mt-1">referência nacional do ENEM</p>
              </div>
              <div className={cardBase}>
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <div className="bg-teal-100 p-1.5 rounded-lg"><MapPin className="w-4 h-4 text-teal-600" /></div>
                  <span className="text-xs font-medium">Média Paraná</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{fmt(mediaParana)}</p>
                <p className="text-xs text-gray-400 mt-1">{fmtInt(escolasPR.length)} escolas no PR</p>
              </div>
              <div className={`${cardBase} ring-1 ring-emerald-200 bg-emerald-50/40`}>
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <div className="bg-emerald-100 p-1.5 rounded-lg"><Building2 className="w-4 h-4 text-emerald-600" /></div>
                  <span className="text-xs font-medium">Média parceiros APG</span>
                </div>
                <p className="text-2xl font-bold text-emerald-700">{fmt(mediaApg)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {mediaApg != null && mediaNacional != null
                    ? `${mediaApg >= mediaNacional ? '+' : ''}${fmt(mediaApg - mediaNacional)} vs nacional`
                    : `${scopeApg.length} escolas do grupo`}
                </p>
              </div>
              <div className={cardBase}>
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <div className="bg-amber-100 p-1.5 rounded-lg"><Trophy className="w-4 h-4 text-amber-600" /></div>
                  <span className="text-xs font-medium">Maior média</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{fmt(maior?.valor ?? null)}</p>
                <p className="text-xs text-gray-500 mt-1 truncate" title={maior?.escola}>{maior?.escola || '--'}</p>
              </div>
              <div className={cardBase}>
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <div className="bg-indigo-100 p-1.5 rounded-lg"><Users className="w-4 h-4 text-indigo-600" /></div>
                  <span className="text-xs font-medium">Participantes</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{fmtInt(participantes)}</p>
                <p className="text-xs text-gray-400 mt-1">{fmtInt(participantesApg)} no grupo Apogeu</p>
              </div>
            </div>

            {/* Ranking + Skills */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Ranking */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      Ranking · {escopo === 'apg' ? 'Grupo Apogeu' : 'Públicas do PR'}
                    </h3>
                    <p className="text-xs text-gray-500">Ordenado por {areaLabel} · {ranking.length} escolas</p>
                  </div>
                  <Medal className="w-5 h-5 text-emerald-500" />
                </div>

                {/* Escopo do ranking */}
                <div className="inline-flex items-center gap-1 bg-gray-100 rounded-full p-0.5 mb-3">
                  {([
                    { k: 'apg', label: 'Grupo Apogeu' },
                    { k: 'todas', label: 'Todas as públicas' },
                  ] as const).map((o) => (
                    <button
                      key={o.k}
                      onClick={() => setEscopo(o.k)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        escopo === o.k ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
                          className="mt-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
                        >
                          Ver {foraDoGrupo} {foraDoGrupo === 1 ? 'escola' : 'escolas'} fora do grupo
                        </button>
                      )}
                    </div>
                  ) : ranking.map(({ r, v }, idx) => {
                    const isSel = selected?.id === r.id;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setSelectedId(r.id)}
                        className={`w-full text-left rounded-lg p-3 border transition-colors ${
                          isSel ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-100 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            idx === 0 ? 'bg-emerald-600 text-white' : idx < 3 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                          }`}>{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-gray-900 text-sm truncate">
                                {r.escola}
                                {escopo === 'todas' && r.is_apogeu && (
                                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 align-middle">APG</span>
                                )}
                              </p>
                              <span className="text-sm font-bold text-gray-900 shrink-0">{fmt(v)}</span>
                            </div>
                            <p className="text-xs text-gray-500">{r.cidade}/PR · #{fmtInt(r.posicao_geral || 0)} no PR</p>
                            <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${maxRank ? (v / maxRank) * 100 : 0}%` }} />
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Skills da escola */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-semibold text-gray-900">Skills da escola</h3>
                  <span className="text-xs text-gray-400">Radar 5 pontas</span>
                </div>
                <p className="text-sm font-medium text-emerald-700 mb-2 truncate">{selected?.escola || '--'}</p>
                {selected ? (
                  <>
                    <RadarChart labels={ENEM_RADAR_AREAS.map((a) => a.label)} school={radarSchool} avg={radarAvg} dmin={radarDomain.dmin} dmax={radarDomain.dmax} />
                    <div className="flex items-center justify-center gap-5 text-xs text-gray-500 mt-1 mb-3">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Escola</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> Média APG</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm border-t border-gray-100 pt-3">
                      {ENEM_RADAR_AREAS.map((a, i) => {
                        const v = (selected[a.field] as number) ?? null;
                        const diff = v != null ? v - radarAvg[i] : null;
                        return (
                          <div key={a.key} className="flex items-center justify-between">
                            <span className="text-gray-600">{a.label}</span>
                            <span className="flex items-center gap-1.5">
                              <span className="font-semibold text-gray-900">{fmt(v)}</span>
                              {diff != null && (
                                <span className={`text-[10px] ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                  {diff >= 0 ? '▲' : '▼'}{fmt(Math.abs(diff))}
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-100 mt-2 pt-2">
                      <span className="text-sm font-semibold text-gray-700">Média geral</span>
                      <span className="text-lg font-bold text-emerald-700">{fmt(selected.media)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 py-10 text-center">Selecione uma escola no ranking.</p>
                )}
              </div>
            </div>

            {/* Mapa de escolas */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="mb-3">
                <h3 className="text-base font-semibold text-gray-900">Mapa de escolas · Grupo Apogeu</h3>
                <p className="text-xs text-gray-500">{scopeApg.length} escolas · {ano} · clique nos pontos para ver as unidades</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-gray-50/60 rounded-lg border border-gray-100 min-h-[300px]">
                  <SchoolMap cidades={cidadesMapa} selected={mapCidade} onSelect={setMapCidade} />
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 tracking-wide">CIDADE SELECIONADA</p>
                    <p className="text-lg font-bold text-gray-900">{mapCidade || '--'}{mapCidade ? '/PR' : ''}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                      <p className="text-[11px] text-gray-500">Escolas</p>
                      <p className="text-xl font-bold text-gray-900">{mapaSel?.count ?? 0}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                      <p className="text-[11px] text-gray-500">{areaLabel} {ano}</p>
                      <p className="text-xl font-bold text-emerald-700">{fmt(mapaSel?.media ?? null)}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {(mapaSel?.rows || [])
                      .slice()
                      .sort((a, b) => (areaValue(b, area) ?? 0) - (areaValue(a, area) ?? 0))
                      .map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setSelectedId(r.id)}
                          className="w-full flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50 text-left"
                        >
                          <span className="text-sm text-gray-700 truncate">{r.escola}</span>
                          <span className="flex items-center gap-1 shrink-0">
                            <span className="text-sm font-semibold text-gray-900">{fmt(areaValue(r, area))}</span>
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
                Base: ENEM {ano || '2025'} · {fmtInt(dataAno.length)} escolas públicas do PR nas cidades do grupo.
                "Média nacional" é uma referência fixa do INEP; "Média Paraná" é calculada sobre as públicas da base no recorte atual.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EnemDashboard;
