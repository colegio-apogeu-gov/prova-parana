import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Building2, MapPin, TrendingUp, Trophy, Users, Medal, ChevronRight, Eraser, Handshake,
} from 'lucide-react';
import { EnemResultado, EnemArea, EnemParceiro } from '../../types';
import {
  ENEM_AREAS, ENEM_RADAR_AREAS, areaValue, mediaPonderada,
  PARCEIROS, parceiroLabel, parceiroColor, APG_BLUE, CITY_COORDS, PR_BOUNDS,
} from '../../lib/enem';

interface EnemConsolidadoProps {
  data: EnemResultado[]; // todas as escolas do PR (todas as edições)
}

const fmt = (v: number | null | undefined, dec = 1) =>
  v == null || Number.isNaN(v) ? '--' : v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtInt = (v: number) => (v || 0).toLocaleString('pt-BR');

// Média nacional por área — referência fixa (mockada), igual ao Dashboard.
const MEDIA_NACIONAL: Record<EnemArea, number> = {
  media: 541.6, mt: 525.9, lc: 534.8, cn: 499.0, ch: 513.6, rd: 634.8,
};

const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// ---------------- Radar (SVG puro) ----------------
const RadarChart: React.FC<{ labels: string[]; school: number[]; avg: number[]; dmin: number; dmax: number; accent: string }> = ({
  labels, school, avg, dmin, dmax, accent,
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
        <polygon key={ri}
          points={labels.map((_, i) => { const r = rr * R; return [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))].join(','); }).join(' ')}
          fill="none" stroke="#e5e7eb" strokeWidth={1} />
      ))}
      {labels.map((_, i) => { const [x, y] = at(dmax, i); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth={1} />; })}
      <polygon points={poly(avg)} fill="none" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 3" />
      <polygon points={poly(school)} fill={accent} fillOpacity={0.22} stroke={accent} strokeWidth={2} />
      {school.map((v, i) => { const [x, y] = at(v, i); return <circle key={i} cx={x} cy={y} r={2.5} fill={accent} />; })}
      {labels.map((lb, i) => {
        const [x, y] = at(dmax, i);
        const lx = cx + (x - cx) * 1.2, ly = cy + (y - cy) * 1.2;
        return <text key={i} x={lx} y={ly} fontSize={11} fill="#374151" textAnchor="middle" dominantBaseline="middle">{lb}</text>;
      })}
    </svg>
  );
};

// ---------------- Mapa geográfico do PR ----------------
const GeoMap: React.FC<{
  cidades: { cidade: string; count: number; media: number | null; apg: boolean }[];
  grupoColor: string;
  selected: string;
  onSelect: (c: string) => void;
}> = ({ cidades, grupoColor, selected, onSelect }) => {
  const W = 100, H = 66;
  const { north, south, west, east } = PR_BOUNDS;
  const proj = (lat: number, lon: number): [number, number] => [
    ((lon - west) / (east - west)) * (W - 8) + 4,
    ((north - lat) / (north - south)) * (H - 8) + 4,
  ];
  const posicionadas = cidades.filter((c) => CITY_COORDS[c.cidade]);
  const maxCount = Math.max(1, ...cidades.map((c) => c.count));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <defs>
        <radialGradient id="prbg" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#eff6ff" />
        </radialGradient>
      </defs>
      <rect x="1.5" y="1.5" width={W - 3} height={H - 3} rx="4" fill="url(#prbg)" stroke="#dbeafe" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
      {posicionadas.map((c) => {
        const [lat, lon] = CITY_COORDS[c.cidade];
        const [x, y] = proj(lat, lon);
        const r = 1.4 + (c.count / maxCount) * 2.8;
        const isSel = c.cidade === selected;
        const fill = c.apg ? APG_BLUE : grupoColor;
        return (
          <g key={c.cidade} onClick={() => onSelect(c.cidade)} style={{ cursor: 'pointer' }}>
            {isSel && <circle cx={x} cy={y} r={r + 1.8} fill={fill} opacity={0.18} />}
            <circle cx={x} cy={y} r={r} fill={fill} fillOpacity={c.apg ? 0.85 : 0.6}
              stroke={c.apg ? APG_BLUE : '#ffffff'} strokeWidth={c.apg ? 0.8 : 0.4} />
            {isSel && <text x={x + r + 0.8} y={y + 1} fontSize={2.6} fontWeight={700} fill="#1e3a8a">{c.cidade}</text>}
            <title>{`${c.cidade}: ${c.count} escola(s)${c.media != null ? ` · média ${fmt(c.media)}` : ''}`}</title>
          </g>
        );
      })}
    </svg>
  );
};

const cardBase = 'bg-white rounded-xl border border-gray-200 p-4';

const EnemConsolidado: React.FC<EnemConsolidadoProps> = ({ data }) => {
  const [ano, setAno] = useState<string>('');
  const [area, setArea] = useState<EnemArea>('media');
  const [busca, setBusca] = useState('');
  const [regionalSel, setRegionalSel] = useState('');
  const [cidadeSel, setCidadeSel] = useState('');
  const [parceirosFiltro, setParceirosFiltro] = useState<EnemParceiro[]>([]); // vazio = todas
  const [rankGrupo, setRankGrupo] = useState<EnemParceiro | 'todos'>('apg');
  const [skillGrupo, setSkillGrupo] = useState<EnemParceiro>('apg');
  const [mapGrupo, setMapGrupo] = useState<EnemParceiro>('apg');
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [mapCidade, setMapCidade] = useState('');

  const anos = useMemo(
    () => Array.from(new Set(data.map((r) => r.ano))).sort((a, b) => b.localeCompare(a)),
    [data]
  );
  useEffect(() => { if (!ano && anos.length) setAno(anos[0]); }, [anos, ano]);

  const dataAno = useMemo(() => data.filter((r) => !ano || r.ano === ano), [data, ano]);

  const regionais = useMemo(
    () => Array.from(new Set(dataAno.map((r) => r.regional).filter(Boolean) as string[])).sort(),
    [dataAno]
  );
  // Cidades: só as que têm escola parceira (mantém o dropdown utilizável; a base tem ~380 municípios).
  const cidades = useMemo(
    () => Array.from(new Set(dataAno.filter((r) => r.parceiro).map((r) => r.cidade))).sort(),
    [dataAno]
  );

  const toggleParceiro = (p: EnemParceiro) =>
    setParceirosFiltro((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  // Escopo dos cards: obedece regional, cidade e o filtro Parceiros.
  const scopeAll = useMemo(
    () => dataAno.filter((r) =>
      (!regionalSel || r.regional === regionalSel) &&
      (!cidadeSel || r.cidade === cidadeSel) &&
      (parceirosFiltro.length === 0 || (r.parceiro != null && parceirosFiltro.includes(r.parceiro)))
    ),
    [dataAno, regionalSel, cidadeSel, parceirosFiltro]
  );
  const scopeApg = useMemo(() => scopeAll.filter((r) => r.parceiro === 'apg'), [scopeAll]);
  const scopeParceiros = useMemo(() => scopeAll.filter((r) => r.parceiro != null), [scopeAll]);

  // ---- Cards ----
  const mediaNacional = MEDIA_NACIONAL[area];
  const escolasPR = useMemo(() => scopeAll.filter((r) => r.uf === 'PR'), [scopeAll]);
  const mediaParana = useMemo(() => mediaPonderada(escolasPR, area), [escolasPR, area]);
  const mediaApg = useMemo(() => mediaPonderada(scopeApg, area), [scopeApg, area]);
  const mediaParceiros = useMemo(() => mediaPonderada(scopeParceiros, area), [scopeParceiros, area]);
  const maior = useMemo(() => {
    let best: EnemResultado | null = null, bv = -Infinity;
    scopeApg.forEach((r) => { const v = areaValue(r, area); if (v != null && v > bv) { bv = v; best = r; } });
    return best ? { escola: (best as EnemResultado).escola, valor: bv } : null;
  }, [scopeApg, area]);
  const participantes = useMemo(() => scopeAll.reduce((s, r) => s + (r.alunos || 0), 0), [scopeAll]);
  const participantesParceiros = useMemo(() => scopeParceiros.reduce((s, r) => s + (r.alunos || 0), 0), [scopeParceiros]);

  // ---- Ranking (grupo próprio; 'todos' = as 3 parceiras juntas) ----
  const ranking = useMemo(() => {
    const q = norm(busca);
    return dataAno
      .filter((r) => (rankGrupo === 'todos' ? r.parceiro != null : r.parceiro === rankGrupo))
      .filter((r) => (!regionalSel || r.regional === regionalSel) && (!cidadeSel || r.cidade === cidadeSel))
      .filter((r) => !q || norm(r.escola).includes(q) || norm(r.cidade).includes(q))
      .map((r) => ({ r, v: areaValue(r, area) ?? 0 }))
      .sort((a, b) => b.v - a.v);
  }, [dataAno, rankGrupo, regionalSel, cidadeSel, busca, area]);
  const maxRank = ranking.length ? ranking[0].v : 1;

  // ---- Skills (grupo próprio) ----
  const escolasSkill = useMemo(
    () => dataAno.filter((r) => r.parceiro === skillGrupo && (!regionalSel || r.regional === regionalSel) && (!cidadeSel || r.cidade === cidadeSel))
      .map((r) => ({ r, v: areaValue(r, 'media') ?? 0 }))
      .sort((a, b) => b.v - a.v),
    [dataAno, skillGrupo, regionalSel, cidadeSel]
  );
  const selectedSkill = useMemo(
    () => escolasSkill.find((x) => x.r.id === selectedSkillId)?.r ?? escolasSkill[0]?.r ?? null,
    [escolasSkill, selectedSkillId]
  );
  const skillRows = useMemo(() => escolasSkill.map((x) => x.r), [escolasSkill]);
  const radarDomain = useMemo(() => {
    const vals: number[] = [];
    skillRows.forEach((r) => ENEM_RADAR_AREAS.forEach((a) => { const v = r[a.field]; if (typeof v === 'number') vals.push(v); }));
    if (!vals.length) return { dmin: 400, dmax: 900 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return { dmin: Math.max(0, Math.floor((lo - 20) / 50) * 50), dmax: Math.ceil((hi + 20) / 50) * 50 };
  }, [skillRows]);
  const radarSchool = selectedSkill ? ENEM_RADAR_AREAS.map((a) => (selectedSkill[a.field] as number) ?? 0) : [];
  const radarAvg = ENEM_RADAR_AREAS.map((a) => mediaPonderada(skillRows, a.key) ?? 0);
  const skillIsApg = skillGrupo === 'apg';
  const skillAccent = skillIsApg ? APG_BLUE : parceiroColor(skillGrupo);

  // ---- Mapa (grupo próprio) ----
  const cidadesMapa = useMemo(() => {
    const byCity = new Map<string, EnemResultado[]>();
    dataAno.filter((r) => r.parceiro === mapGrupo).forEach((r) => {
      byCity.set(r.cidade, [...(byCity.get(r.cidade) || []), r]);
    });
    return Array.from(byCity.entries()).map(([cidade, rows]) => ({
      cidade, count: rows.length, media: mediaPonderada(rows, area), rows, apg: mapGrupo === 'apg',
    }));
  }, [dataAno, mapGrupo, area]);
  useEffect(() => {
    if (mapCidade && cidadesMapa.some((c) => c.cidade === mapCidade)) return;
    setMapCidade(cidadesMapa.slice().sort((a, b) => b.count - a.count)[0]?.cidade || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cidadesMapa]);
  const mapaSel = cidadesMapa.find((c) => c.cidade === mapCidade);
  const semCoord = cidadesMapa.filter((c) => !CITY_COORDS[c.cidade]).length;

  const limpar = () => { setBusca(''); setRegionalSel(''); setCidadeSel(''); setParceirosFiltro([]); };
  const areaLabel = ENEM_AREAS.find((a) => a.key === area)?.label ?? 'Média Geral';

  // Toggle de grupo reutilizável (Apg/Salta/Tom) para ranking, skills e mapa.
  // `withTodos` acrescenta a opção "Todos" (usada só no ranking).
  const GrupoToggle = ({ value, onChange, withTodos }: { value: string; onChange: (p: any) => void; withTodos?: boolean }) => {
    const opcoes: { key: string; label: string }[] = [
      ...(withTodos ? [{ key: 'todos', label: 'Todos' }] : []),
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

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Ano:</span>
          <select value={ano} onChange={(e) => setAno(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
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
          <span className="text-sm text-gray-600">Regional:</span>
          <select value={regionalSel} onChange={(e) => setRegionalSel(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-w-[100px]">
            <option value="">Todas</option>
            {regionais.map((r) => <option key={r} value={r}>{r}</option>)}
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

      {/* Filtro Parceiros (multi) + abas de área */}
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
          {ENEM_AREAS.map((a) => (
            <button key={a.key} onClick={() => setArea(a.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                area === a.key ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards (6) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className={cardBase}>
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <div className="bg-slate-100 p-1.5 rounded-lg"><TrendingUp className="w-4 h-4 text-slate-600" /></div>
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
        {/* APG destacado com contorno azul */}
        <div className={`${cardBase} ring-2 ring-blue-500 bg-blue-50/40`}>
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <div className="bg-blue-100 p-1.5 rounded-lg"><Building2 className="w-4 h-4 text-blue-600" /></div>
            <span className="text-xs font-medium">Média parceiros APG</span>
          </div>
          <p className="text-2xl font-bold text-blue-700">{fmt(mediaApg)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {mediaApg != null ? `${mediaApg >= mediaNacional ? '+' : ''}${fmt(mediaApg - mediaNacional)} vs nacional` : `${scopeApg.length} escolas`}
          </p>
        </div>
        <div className={cardBase}>
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <div className="bg-violet-100 p-1.5 rounded-lg"><Handshake className="w-4 h-4 text-violet-600" /></div>
            <span className="text-xs font-medium">Média Parceiros da Escola</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{fmt(mediaParceiros)}</p>
          <p className="text-xs text-gray-400 mt-1">Apg + Salta + Tom · {scopeParceiros.length} escolas</p>
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
          <p className="text-xs text-gray-400 mt-1">{fmtInt(participantesParceiros)} nos parceiros</p>
        </div>
      </div>

      {/* Ranking + Skills */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ranking */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Ranking · Parceiros da Escola</h3>
              <p className="text-xs text-gray-500">{rankGrupo === 'todos' ? 'Todos' : parceiroLabel(rankGrupo)} · ordenado por {areaLabel} · {ranking.length} escolas</p>
            </div>
            <Medal className="w-5 h-5 text-blue-500" />
          </div>
          <div className="mb-3"><GrupoToggle value={rankGrupo} onChange={setRankGrupo} withTodos /></div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {ranking.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Nenhuma escola encontrada.</p>
            ) : ranking.map(({ r, v }, idx) => {
              const apg = r.parceiro === 'apg';
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
                        </p>
                        <div className="shrink-0 text-right">
                          <span className="block text-sm font-bold text-gray-900 leading-tight">{fmt(v)}</span>
                          <span className="block text-[11px] text-gray-500 leading-tight">{fmtInt(r.alunos || 0)} part.</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">{r.cidade}/{r.uf} · #{fmtInt(r.posicao_geral || 0)} no PR</p>
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

        {/* Skills das escolas parceiras */}
        <div className={`bg-white rounded-xl border p-5 ${skillIsApg ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">Skills das escolas parceiras</h3>
            <GrupoToggle value={skillGrupo} onChange={setSkillGrupo} />
          </div>
          <select
            value={selectedSkill?.id ?? ''}
            onChange={(e) => setSelectedSkillId(e.target.value)}
            className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
            {skillRows.length === 0 && <option value="">Sem escolas</option>}
            {skillRows.map((r) => <option key={r.id} value={r.id}>{r.escola} — {r.cidade}</option>)}
          </select>
          {selectedSkill ? (
            <>
              <RadarChart labels={ENEM_RADAR_AREAS.map((a) => a.label)} school={radarSchool} avg={radarAvg}
                dmin={radarDomain.dmin} dmax={radarDomain.dmax} accent={skillAccent} />
              <div className="flex items-center justify-center gap-5 text-xs text-gray-500 mt-1 mb-3">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: skillAccent }} /> Escola</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> Média {parceiroLabel(skillGrupo)}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm border-t border-gray-100 pt-3">
                {ENEM_RADAR_AREAS.map((a, i) => {
                  const v = (selectedSkill[a.field] as number) ?? null;
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
                <span className="text-lg font-bold" style={{ color: skillAccent }}>{fmt(selectedSkill.media)}</span>
              </div>
            </>
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
            <p className="text-xs text-gray-500">{parceiroLabel(mapGrupo)} · {cidadesMapa.reduce((s, c) => s + c.count, 0)} escolas · {ano}</p>
          </div>
          <GrupoToggle value={mapGrupo} onChange={setMapGrupo} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-gray-50/60 rounded-lg border border-gray-100 min-h-[320px]">
            <GeoMap cidades={cidadesMapa} grupoColor={parceiroColor(mapGrupo)} selected={mapCidade} onSelect={setMapCidade} />
            {semCoord > 0 && (
              <p className="text-[11px] text-gray-400 px-3 pb-2">{semCoord} cidade(s) sem posição no mapa — veja na lista ao lado.</p>
            )}
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
                <p className="text-[11px] text-gray-500">{areaLabel} {ano}</p>
                <p className="text-xl font-bold text-blue-700">{fmt(mapaSel?.media ?? null)}</p>
              </div>
            </div>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
              {(mapaSel?.rows || []).slice().sort((a, b) => (areaValue(b, area) ?? 0) - (areaValue(a, area) ?? 0)).map((r) => (
                <div key={r.id}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${r.parceiro === 'apg' ? 'border-blue-300 ring-1 ring-blue-200 bg-blue-50/40' : 'border-gray-100'}`}>
                  <span className="text-sm text-gray-700 truncate">
                    {r.escola}
                    {r.parceiro === 'apg' && <span className="ml-1 text-[10px] px-1 py-0.5 rounded-full bg-blue-100 text-blue-700">APG</span>}
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-semibold text-gray-900">{fmt(areaValue(r, area))}</span>
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
          Base: ENEM {ano} · {fmtInt(dataAno.length)} escolas do PR (todas as dependências).
          APG (nosso grupo) sempre destacado em azul. "Média nacional" é referência fixa do INEP.
        </span>
      </div>
    </div>
  );
};

export default EnemConsolidado;
