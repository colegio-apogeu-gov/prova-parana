import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Building2, TrendingUp, Search, X, BookOpen, Target, GraduationCap, Repeat } from 'lucide-react';
import { IdebResultado, IdebEtapa, IdebAgregadoPR } from '../../types';
import {
  getIdebParceiros, getIdebAgregadoPR, getIdebHistoricoEscola, buscarEscolasIdeb,
  fmtIndicador, mediaCampo, BRASIL_REF, etapaLabel,
} from '../../lib/ideb';

interface IdebHistoricoProps {
  etapa: IdebEtapa;
}

const fmt = (v: number | null | undefined, dec = 1) =>
  v == null || Number.isNaN(v) ? '--' : v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Cores das séries (uma por métrica, estáveis entre os gráficos).
const COR = {
  escola: '#7c3aed',   // violeta — recorte selecionado
  pr: '#9ca3af',       // cinza — média do Paraná
  brasil: '#f59e0b',   // âmbar — média do Brasil
  mt: '#2563eb',       // azul — Matemática
  lp: '#ec4899',       // rosa — Língua Portuguesa
  meta: '#94a3b8',     // cinza-azulado — meta projetada
  aprendizado: '#8b5cf6',
  fluxo: '#14b8a6',
};

// ---------- helpers de eixo (mesmo padrão do Histórico do ENEM) ----------
const niceDomain = (vals: number[], padPct = 0.12, passo = 10) => {
  const v = vals.filter((x) => Number.isFinite(x));
  if (!v.length) return { min: 0, max: 100 };
  let min = Math.min(...v);
  let max = Math.max(...v);
  if (min === max) { min -= passo; max += passo; }
  const pad = (max - min) * padPct;
  min = Math.max(0, Math.floor((min - pad) / passo) * passo);
  max = Math.ceil((max + pad) / passo) * passo;
  return { min, max };
};
const ticks = (min: number, max: number, n = 4) =>
  Array.from({ length: n + 1 }, (_, i) => min + ((max - min) * i) / n);

const Axes: React.FC<{
  w: number; h: number; pad: { t: number; r: number; b: number; l: number };
  min: number; max: number; xLabels: string[]; dec?: number;
}> = ({ w, h, pad, min, max, xLabels, dec = 0 }) => {
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * ih;
  return (
    <>
      {ticks(min, max).map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} strokeDasharray="3 3" />
          <text x={pad.l - 8} y={y(t)} fontSize={10} fill="#9ca3af" textAnchor="end" dominantBaseline="middle">
            {t.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })}
          </text>
        </g>
      ))}
      {xLabels.map((lb, i) => {
        const step = iw / xLabels.length;
        return (
          <text key={lb} x={pad.l + step * i + step / 2} y={h - pad.b + 16} fontSize={11} fill="#6b7280" textAnchor="middle">{lb}</text>
        );
      })}
      <line x1={pad.l} x2={w - pad.r} y1={h - pad.b} y2={h - pad.b} stroke="#d1d5db" strokeWidth={1} />
    </>
  );
};

const Card: React.FC<{ title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  title, subtitle, icon, children,
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <div className="flex items-start justify-between mb-3">
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-violet-700">{subtitle}</p>
      </div>
      <span className="text-violet-500">{icon}</span>
    </div>
    {children}
  </div>
);

const Legend = ({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) => (
  <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500 mt-1">
    {items.map((it) => (
      <span key={it.label} className="flex items-center gap-1.5">
        <span
          className="inline-block w-4 h-0.5"
          style={{ background: it.dashed ? 'none' : it.color, borderTop: it.dashed ? `2px dashed ${it.color}` : undefined }}
        />
        {it.label}
      </span>
    ))}
  </div>
);

interface EscolaOpcao {
  inep: string;
  escola: string;
  cidade: string;
  parceiro: string | null;
}

interface Ponto {
  ano: string;
  escolas: number;
  ideb: number | null;
  meta: number | null;
  saeb_mt: number | null;
  saeb_lp: number | null;
  aprendizado: number | null;
  fluxo: number | null;
  aprovacao: number | null;
  prIdeb: number | null;
  prMt: number | null;
  prLp: number | null;
  brIdeb: number | null;
  brMt: number | null;
  brLp: number | null;
}

const IdebHistorico: React.FC<IdebHistoricoProps> = ({ etapa }) => {
  // "" = grupo Apogeu (agregado); senão o INEP da escola (do grupo ou não).
  const [escolaSel, setEscolaSel] = useState('');
  const [escolaInfo, setEscolaInfo] = useState<EscolaOpcao | null>(null);
  // "" = todas as regionais. Filtra o recorte do grupo por regional (SJP/GUA/CWT).
  const [regionalSel, setRegionalSel] = useState('');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [resultadosBusca, setResultadosBusca] = useState<EscolaOpcao[]>([]);
  const [buscando, setBuscando] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  const [parceiros, setParceiros] = useState<IdebResultado[]>([]);
  const [agregado, setAgregado] = useState<IdebAgregadoPR[]>([]);
  const [linhasEscola, setLinhasEscola] = useState<IdebResultado[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  // Fecha o combo ao clicar fora.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Série histórica das escolas parceiras + médias do PR. São ~1,7 mil linhas e
  // 16 agregados — bem menos que as ~22 mil linhas da base completa.
  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLoading(true);
      try {
        const [p, a] = await Promise.all([getIdebParceiros(), getIdebAgregadoPR()]);
        if (!cancelado) { setParceiros(p); setAgregado(a); setErro(''); }
      } catch (e) {
        console.error(e);
        if (!cancelado) setErro('Não foi possível carregar o histórico do IDEB.');
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  // Busca de escolas no servidor (a base tem ~3,6 mil escolas; não vale baixar todas).
  useEffect(() => {
    const q = busca.trim();
    if (!aberto || q.length < 2) { setResultadosBusca([]); return; }
    let cancelado = false;
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const res = await buscarEscolasIdeb(q, etapa);
        if (!cancelado) setResultadosBusca(res);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 350);
    return () => { cancelado = true; clearTimeout(t); };
  }, [busca, aberto, etapa]);

  // Linhas da escola escolhida: se for parceira já estão em memória; se não, busca.
  useEffect(() => {
    if (!escolaSel) { setLinhasEscola([]); return; }
    const local = parceiros.filter((r) => r.inep_codigo === escolaSel);
    if (local.length) { setLinhasEscola(local); return; }
    let cancelado = false;
    (async () => {
      try {
        const rows = await getIdebHistoricoEscola(escolaSel);
        if (!cancelado) setLinhasEscola(rows);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { cancelado = true; };
  }, [escolaSel, parceiros]);

  const parceirosEtapa = useMemo(() => parceiros.filter((r) => r.etapa === etapa), [parceiros, etapa]);
  const agregadoEtapa = useMemo(() => agregado.filter((a) => a.etapa === etapa), [agregado, etapa]);

  // Regionais disponíveis nesta etapa (só aparecem quando há dado de regional).
  const regionais = useMemo(
    () => Array.from(new Set(parceirosEtapa.map((r) => r.regional).filter(Boolean) as string[])).sort(),
    [parceirosEtapa]
  );

  // Se a regional escolhida deixar de existir (ex.: troca de etapa), volta p/ todas.
  useEffect(() => {
    if (regionalSel && !regionais.includes(regionalSel)) setRegionalSel('');
  }, [regionais, regionalSel]);

  // Escolas parceiras disponíveis no seletor (APG primeiro, depois alfabética).
  const escolasParceiras = useMemo(() => {
    const m = new Map<string, EscolaOpcao>();
    parceirosEtapa.forEach((r) => {
      if (!m.has(r.inep_codigo)) {
        m.set(r.inep_codigo, { inep: r.inep_codigo, escola: r.escola, cidade: r.cidade, parceiro: r.parceiro });
      }
    });
    return Array.from(m.values()).sort((a, b) => {
      const aApg = a.parceiro === 'apg';
      const bApg = b.parceiro === 'apg';
      return aApg === bApg ? a.escola.localeCompare(b.escola) : aApg ? -1 : 1;
    });
  }, [parceirosEtapa]);

  const parceirasFiltradas = useMemo(() => {
    const q = norm(busca);
    if (!q) return escolasParceiras;
    return escolasParceiras.filter((e) => norm(e.escola).includes(q) || norm(e.cidade).includes(q));
  }, [escolasParceiras, busca]);

  // Resultados do servidor que não são escolas parceiras (evita item repetido na lista).
  const outrasEscolas = useMemo(() => {
    const jaListadas = new Set(parceirasFiltradas.map((e) => e.inep));
    return resultadosBusca.filter((e) => !jaListadas.has(e.inep));
  }, [resultadosBusca, parceirasFiltradas]);

  const escolaAtual = escolaSel
    ? escolasParceiras.find((e) => e.inep === escolaSel) ?? escolaInfo
    : null;
  // Rótulo do recorte: uma escola específica, o grupo por regional, ou o grupo todo.
  const escolaLabel = escolaSel
    ? (escolaAtual?.escola ?? '--')
    : regionalSel
    ? `Grupo Apogeu · ${regionalSel}`
    : 'Grupo Apogeu';

  // Edições disponíveis nesta etapa (vêm do agregado do PR, que cobre todas).
  const anos = useMemo(
    () => agregadoEtapa.map((a) => a.ano).sort((a, b) => a.localeCompare(b)),
    [agregadoEtapa]
  );

  // Linhas do recorte selecionado:
  // - escola específica → só ela;
  // - regional escolhida → escolas do grupo daquela regional;
  // - senão → agregado do grupo Apogeu (is_apogeu), como antes.
  const linhasRecorte = useMemo(
    () => (escolaSel
      ? linhasEscola.filter((r) => r.etapa === etapa)
      : regionalSel
      ? parceirosEtapa.filter((r) => r.regional === regionalSel)
      : parceirosEtapa.filter((r) => r.is_apogeu)),
    [escolaSel, linhasEscola, etapa, parceirosEtapa, regionalSel]
  );

  const serie: Ponto[] = useMemo(() => anos.map((ano) => {
    const rows = linhasRecorte.filter((r) => r.ano === ano);
    const pr = agregadoEtapa.find((a) => a.ano === ano);
    const br = BRASIL_REF[etapa]?.[ano];
    return {
      ano,
      escolas: rows.length,
      ideb: mediaCampo(rows, 'ideb'),
      meta: mediaCampo(rows, 'meta'),
      saeb_mt: mediaCampo(rows, 'saeb_mt'),
      saeb_lp: mediaCampo(rows, 'saeb_lp'),
      aprendizado: mediaCampo(rows, 'aprendizado'),
      fluxo: mediaCampo(rows, 'fluxo'),
      aprovacao: mediaCampo(rows, 'aprovacao'),
      prIdeb: pr?.ideb ?? null,
      prMt: pr?.saeb_mt ?? null,
      prLp: pr?.saeb_lp ?? null,
      brIdeb: br?.ideb ?? null,
      brMt: br?.saeb_mt ?? null,
      brLp: br?.saeb_lp ?? null,
    };
  }), [anos, agregadoEtapa, etapa, linhasRecorte]);

  const semDados = serie.every((s) => s.ideb == null && s.saeb_mt == null);
  const temMeta = serie.some((s) => s.meta != null);

  // Variação entre a primeira e a última edição com dado (resumo do topo).
  const variacao = (get: (p: Ponto) => number | null) => {
    const comDado = serie.filter((s) => get(s) != null);
    if (comDado.length < 2) return null;
    const ini = comDado[0];
    const fim = comDado[comDado.length - 1];
    return { de: ini.ano, ate: fim.ano, delta: (get(fim) as number) - (get(ini) as number), valor: get(fim) as number };
  };
  const varIdeb = variacao((p) => p.ideb);
  const varMt = variacao((p) => p.saeb_mt);
  const varLp = variacao((p) => p.saeb_lp);

  // ---------- 1) Evolução do IDEB ----------
  const LineIdeb = () => {
    const w = 900, h = 260, pad = { t: 16, r: 16, b: 30, l: 44 };
    const vals = serie.flatMap((s) => [s.ideb, s.prIdeb, s.brIdeb, s.meta]).filter((v): v is number => v != null);
    const { min, max } = niceDomain(vals, 0.12, 0.5);
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const step = iw / serie.length;
    const x = (i: number) => pad.l + step * i + step / 2;
    const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * ih;
    const path = (get: (s: Ponto) => number | null) =>
      serie.map((s, i) => { const v = get(s); return v == null ? null : `${x(i)},${y(v)}`; }).filter(Boolean).join(' ');
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <Axes w={w} h={h} pad={pad} min={min} max={max} xLabels={serie.map((s) => s.ano)} dec={1} />
        <polyline points={path((s) => s.brIdeb)} fill="none" stroke={COR.brasil} strokeWidth={2} strokeDasharray="2 3" />
        <polyline points={path((s) => s.prIdeb)} fill="none" stroke={COR.pr} strokeWidth={2} strokeDasharray="5 4" />
        <polyline points={path((s) => s.ideb)} fill="none" stroke={COR.escola} strokeWidth={3} />
        {serie.map((s, i) => s.ideb != null && (
          <g key={s.ano}>
            {/* Alvo de hover generoso: o ponto visível (r=4.5) é pequeno demais para o mouse. */}
            <circle cx={x(i)} cy={y(s.ideb)} r={14} fill="transparent" />
            <circle cx={x(i)} cy={y(s.ideb)} r={4.5} fill="#fff" stroke={COR.escola} strokeWidth={2.5} />
            <title>
              {`${s.ano} · ${escolaLabel}: ${fmt(s.ideb)}`}
              {s.prIdeb != null ? ` | Média PR: ${fmt(s.prIdeb)} (${s.ideb >= s.prIdeb ? '+' : ''}${fmt(s.ideb - s.prIdeb)})` : ''}
              {s.brIdeb != null ? ` | Brasil: ${fmt(s.brIdeb)}` : ''}
            </title>
          </g>
        ))}
        {serie.map((s, i) => s.ideb != null && (
          <text key={`l${s.ano}`} x={x(i)} y={y(s.ideb) - 12} fontSize={11} fill="#5b21b6" textAnchor="middle" fontWeight={600}>
            {fmt(s.ideb)}
          </text>
        ))}
      </svg>
    );
  };

  // ---------- 2) Evolução das notas SAEB ----------
  const LineSaeb = () => {
    const w = 900, h = 280, pad = { t: 16, r: 16, b: 30, l: 44 };
    const vals = serie.flatMap((s) => [s.saeb_mt, s.saeb_lp, s.prMt, s.prLp]).filter((v): v is number => v != null);
    const { min, max } = niceDomain(vals, 0.1, 10);
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const step = iw / serie.length;
    const x = (i: number) => pad.l + step * i + step / 2;
    const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * ih;
    const path = (get: (s: Ponto) => number | null) =>
      serie.map((s, i) => { const v = get(s); return v == null ? null : `${x(i)},${y(v)}`; }).filter(Boolean).join(' ');
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <Axes w={w} h={h} pad={pad} min={min} max={max} xLabels={serie.map((s) => s.ano)} />
        <polyline points={path((s) => s.prMt)} fill="none" stroke={COR.mt} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.55} />
        <polyline points={path((s) => s.prLp)} fill="none" stroke={COR.lp} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.55} />
        <polyline points={path((s) => s.saeb_mt)} fill="none" stroke={COR.mt} strokeWidth={3} />
        <polyline points={path((s) => s.saeb_lp)} fill="none" stroke={COR.lp} strokeWidth={3} />
        {serie.map((s, i) => (
          <g key={s.ano}>
            <rect x={x(i) - step / 2} y={pad.t} width={step} height={ih} fill="transparent" />
            <title>
              {`${s.ano} · ${escolaLabel}`}
              {s.saeb_mt != null ? ` | Matemática: ${fmt(s.saeb_mt)}` : ''}
              {s.saeb_lp != null ? ` | Português: ${fmt(s.saeb_lp)}` : ''}
              {s.prMt != null ? ` | PR MT: ${fmt(s.prMt)}` : ''}
              {s.prLp != null ? ` | PR LP: ${fmt(s.prLp)}` : ''}
            </title>
          </g>
        ))}
        {serie.map((s, i) => (
          <g key={`p${s.ano}`}>
            {s.saeb_mt != null && <circle cx={x(i)} cy={y(s.saeb_mt)} r={4} fill="#fff" stroke={COR.mt} strokeWidth={2.5} />}
            {s.saeb_lp != null && <circle cx={x(i)} cy={y(s.saeb_lp)} r={4} fill="#fff" stroke={COR.lp} strokeWidth={2.5} />}
          </g>
        ))}
      </svg>
    );
  };

  // ---------- 3) Barras genéricas por edição ----------
  const BarSerie = ({
    get, cor, dec, passo, sufixo, escala = 1,
  }: { get: (s: Ponto) => number | null; cor: string; dec: number; passo: number; sufixo?: string; escala?: number }) => {
    const w = 900, h = 240, pad = { t: 18, r: 16, b: 30, l: 44 };
    const vals = serie.map((s) => { const v = get(s); return v == null ? null : v * escala; }).filter((v): v is number => v != null);
    const { min, max } = niceDomain(vals, 0.12, passo);
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const step = iw / serie.length;
    const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * ih;
    const bw = Math.min(70, step * 0.5);
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <Axes w={w} h={h} pad={pad} min={min} max={max} xLabels={serie.map((s) => s.ano)} dec={dec} />
        {serie.map((s, i) => {
          const bruto = get(s);
          if (bruto == null) return null;
          const v = bruto * escala;
          const cx = pad.l + step * i + step / 2;
          return (
            <g key={s.ano}>
              <rect x={cx - bw / 2} y={y(v)} width={bw} height={Math.max(0, h - pad.b - y(v))} fill={cor} rx={3} />
              <text x={cx} y={y(v) - 6} fontSize={11} fill="#374151" textAnchor="middle" fontWeight={600}>
                {fmt(v, dec)}{sufixo || ''}
              </text>
              <title>{`${s.ano}: ${fmt(v, dec)}${sufixo || ''}`}</title>
            </g>
          );
        })}
      </svg>
    );
  };

  // ---------- 4) IDEB observado x meta projetada ----------
  const BarMeta = () => {
    const w = 900, h = 260, pad = { t: 18, r: 16, b: 30, l: 44 };
    const pontos = serie.filter((s) => s.meta != null || s.ideb != null);
    const vals = pontos.flatMap((s) => [s.ideb, s.meta]).filter((v): v is number => v != null);
    const { min, max } = niceDomain(vals, 0.12, 0.5);
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const step = iw / Math.max(1, pontos.length);
    const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * ih;
    const bw = Math.min(30, step * 0.3);
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <Axes w={w} h={h} pad={pad} min={min} max={max} xLabels={pontos.map((s) => s.ano)} dec={1} />
        {pontos.map((s, i) => {
          const cx = pad.l + step * i + step / 2;
          const bateu = s.ideb != null && s.meta != null && s.ideb >= s.meta;
          return (
            <g key={s.ano}>
              {s.ideb != null && (
                <>
                  <rect x={cx - bw - 2} y={y(s.ideb)} width={bw} height={Math.max(0, h - pad.b - y(s.ideb))} fill={COR.escola} rx={3} />
                  <text x={cx - bw / 2 - 2} y={y(s.ideb) - 6} fontSize={10} fill="#5b21b6" textAnchor="middle" fontWeight={600}>{fmt(s.ideb)}</text>
                </>
              )}
              {s.meta != null && (
                <>
                  <rect x={cx + 2} y={y(s.meta)} width={bw} height={Math.max(0, h - pad.b - y(s.meta))} fill={COR.meta} rx={3} />
                  <text x={cx + bw / 2 + 2} y={y(s.meta) - 6} fontSize={10} fill="#64748b" textAnchor="middle" fontWeight={600}>{fmt(s.meta)}</text>
                </>
              )}
              <title>
                {`${s.ano}: IDEB ${fmt(s.ideb)} · meta ${fmt(s.meta)}`}
                {s.meta != null && s.ideb != null ? ` — ${bateu ? 'meta atingida' : 'meta não atingida'}` : ''}
              </title>
            </g>
          );
        })}
      </svg>
    );
  };

  // ---------- seletor de escola ----------
  const escolherEscola = (e: EscolaOpcao | null) => {
    setEscolaSel(e?.inep ?? '');
    setEscolaInfo(e);
    setRegionalSel(''); // recorte por escola/grupo limpa o filtro de regional
    setAberto(false);
    setBusca('');
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600 mx-auto mb-4"></div>
        <p className="text-gray-500 text-sm">Carregando histórico do IDEB e do SAEB...</p>
      </div>
    );
  }

  if (erro) {
    return <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{erro}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filtro de escola (grupo Apogeu, escolas parceiras ou qualquer escola do PR) */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Escola:</span>
        </div>

        <div ref={comboRef} className="relative min-w-[300px]">
          <button
            type="button"
            onClick={() => { setAberto((v) => !v); setBusca(''); }}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-left hover:bg-gray-50 focus:ring-2 focus:ring-violet-500"
          >
            <span className="truncate">
              {escolaSel ? escolaLabel : 'Grupo Apogeu (todas)'}
              {escolaAtual && <span className="text-gray-400 font-normal"> · {escolaAtual.cidade}</span>}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {escolaAtual && escolaAtual.parceiro !== 'apg' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {escolaAtual.parceiro ? escolaAtual.parceiro : 'fora do grupo'}
                </span>
              )}
              <Search className="w-4 h-4 text-gray-400" />
            </span>
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
                <button
                  onClick={() => escolherEscola(null)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${!escolaSel ? 'bg-violet-50 text-violet-700 font-medium' : 'text-gray-700'}`}
                >
                  Grupo Apogeu (todas)
                </button>
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
                        : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">{e.parceiro}</span>}
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

        {regionais.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Regional:</span>
            <select
              value={regionalSel}
              onChange={(e) => {
                const v = e.target.value;
                setRegionalSel(v);
                // A regional define o recorte do grupo — limpa a escola específica.
                if (v) { setEscolaSel(''); setEscolaInfo(null); }
              }}
              className="px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
            >
              <option value="">Todas</option>
              {regionais.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}

        <span className="text-xs text-violet-700">
          {anos.length ? `${etapaLabel(etapa)} · edições de ${anos[0]} a ${anos[anos.length - 1]}` : 'Sem edições na base'}
        </span>
      </div>

      {semDados ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-500">
          Nenhum dado para o recorte selecionado nesta etapa.
        </div>
      ) : (
        <>
          {/* Resumo da evolução */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {([
              { label: 'IDEB', v: varIdeb, dec: 1, icon: <Target className="w-4 h-4 text-violet-600" />, bg: 'bg-violet-100' },
              { label: 'SAEB Matemática', v: varMt, dec: 1, icon: <GraduationCap className="w-4 h-4 text-blue-600" />, bg: 'bg-blue-100' },
              { label: 'SAEB Português', v: varLp, dec: 1, icon: <BookOpen className="w-4 h-4 text-pink-600" />, bg: 'bg-pink-100' },
            ] as const).map((c) => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <div className={`${c.bg} p-1.5 rounded-lg`}>{c.icon}</div>
                  <span className="text-xs font-medium">{c.label}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{fmt(c.v?.valor ?? null, c.dec)}</p>
                <p className="text-xs mt-1">
                  {c.v ? (
                    <span className={c.v.delta >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                      {c.v.delta >= 0 ? '▲' : '▼'} {fmt(Math.abs(c.v.delta), c.dec)} de {c.v.de} a {c.v.ate}
                    </span>
                  ) : (
                    <span className="text-gray-400">série insuficiente para comparar</span>
                  )}
                </p>
              </div>
            ))}
          </div>

          {/* 1º IDEB */}
          <Card
            title="Evolução do IDEB"
            subtitle={`${escolaLabel} · ${etapaLabel(etapa)} · nota final (Aprendizado x Fluxo)`}
            icon={<TrendingUp className="w-5 h-5" />}
          >
            <LineIdeb />
            <Legend items={[
              { color: COR.escola, label: escolaSel ? 'Escola' : 'Grupo Apogeu' },
              { color: COR.pr, label: 'Média PR (todas as escolas)', dashed: true },
              { color: COR.brasil, label: 'Brasil (INEP)', dashed: true },
            ]} />
          </Card>

          {/* 2º SAEB */}
          <Card
            title="Evolução das notas do SAEB"
            subtitle={`${escolaLabel} · proficiência média em Matemática e Língua Portuguesa`}
            icon={<GraduationCap className="w-5 h-5" />}
          >
            <LineSaeb />
            <Legend items={[
              { color: COR.mt, label: 'Matemática' },
              { color: COR.lp, label: 'Língua Portuguesa' },
              { color: COR.mt, label: 'Matemática · média PR', dashed: true },
              { color: COR.lp, label: 'Português · média PR', dashed: true },
            ]} />
          </Card>

          {/* 3º Aprendizado (N) */}
          <Card
            title="Aprendizado (N)"
            subtitle={`${escolaLabel} · nota média padronizada do SAEB, de 0 a 10`}
            icon={<BookOpen className="w-5 h-5" />}
          >
            <BarSerie get={(s) => s.aprendizado} cor={COR.aprendizado} dec={2} passo={0.5} />
            <Legend items={[{ color: COR.aprendizado, label: 'Aprendizado (N)' }]} />
          </Card>

          {/* 4º Fluxo (P) */}
          <Card
            title="Fluxo (P) e aprovação"
            subtitle={`${escolaLabel} · indicador de rendimento (quanto do fluxo escolar é aprovado)`}
            icon={<Repeat className="w-5 h-5" />}
          >
            <BarSerie get={(s) => s.fluxo} cor={COR.fluxo} dec={1} passo={5} sufixo="%" escala={100} />
            <Legend items={[{ color: COR.fluxo, label: 'Fluxo (P) em %' }]} />
          </Card>

          {/* 5º Meta */}
          {temMeta && (
            <Card
              title="IDEB observado x meta do INEP"
              subtitle={`${escolaLabel} · o INEP projetou metas até a edição de 2021`}
              icon={<Target className="w-5 h-5" />}
            >
              <BarMeta />
              <Legend items={[
                { color: COR.escola, label: 'IDEB observado' },
                { color: COR.meta, label: 'Meta projetada' },
              ]} />
            </Card>
          )}

          {/* Tabela-resumo — colunas do IDEB/SAEB, diferentes das áreas do ENEM */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Tabela de notas por edição</h3>
              <p className="text-xs text-gray-500">
                {escolaLabel} · {etapaLabel(etapa)} · IDEB = Aprendizado (N) x Fluxo (P)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-700">
                    <th className="px-4 py-2.5 text-left font-semibold">Edição</th>
                    <th className="px-4 py-2.5 text-center font-semibold">IDEB</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Meta</th>
                    <th className="px-4 py-2.5 text-center font-semibold">SAEB Matemática</th>
                    <th className="px-4 py-2.5 text-center font-semibold">SAEB Português</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Aprendizado (N)</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Fluxo (P)</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Aprovação</th>
                    <th className="px-4 py-2.5 text-center font-semibold">IDEB PR</th>
                    <th className="px-4 py-2.5 text-center font-semibold">IDEB Brasil</th>
                    {!escolaSel && <th className="px-4 py-2.5 text-center font-semibold">Escolas</th>}
                  </tr>
                </thead>
                <tbody>
                  {serie.map((s) => {
                    const bateu = s.ideb != null && s.meta != null && s.ideb >= s.meta;
                    return (
                      <tr key={s.ano} className="border-b border-gray-100">
                        <td className="px-4 py-2.5 font-medium text-gray-900">{s.ano}</td>
                        <td className="px-4 py-2.5 text-center font-semibold text-violet-700">{fmt(s.ideb)}</td>
                        <td className="px-4 py-2.5 text-center text-gray-500">
                          {fmt(s.meta)}
                          {s.meta != null && s.ideb != null && (
                            <span className={`ml-1 text-[10px] ${bateu ? 'text-emerald-600' : 'text-red-500'}`}>{bateu ? '▲' : '▼'}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-700">{fmt(s.saeb_mt)}</td>
                        <td className="px-4 py-2.5 text-center text-gray-700">{fmt(s.saeb_lp)}</td>
                        <td className="px-4 py-2.5 text-center text-gray-700">{fmt(s.aprendizado, 2)}</td>
                        <td className="px-4 py-2.5 text-center text-gray-700">{fmtIndicador(s.fluxo, 'fluxo')}</td>
                        <td className="px-4 py-2.5 text-center text-gray-700">{fmt(s.aprovacao)}%</td>
                        <td className="px-4 py-2.5 text-center text-gray-500">{fmt(s.prIdeb)}</td>
                        <td className="px-4 py-2.5 text-center text-gray-500">{fmt(s.brIdeb)}</td>
                        {!escolaSel && <td className="px-4 py-2.5 text-center text-gray-500">{s.escolas}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-5 py-2.5 text-[11px] text-gray-400 border-t border-gray-100">
              Fonte: INEP. "Meta" é a projeção do 1º ciclo do IDEB (publicada até 2021).
              "IDEB PR" é a média de todas as escolas do Paraná na edição; "IDEB Brasil" é a média nacional da rede total.
              Sem participantes por escola no dado do INEP, as médias de grupo são aritméticas.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default IdebHistorico;
