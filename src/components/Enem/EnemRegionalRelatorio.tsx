import React, { useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import {
  RelatorioEnemRegional, RelatorioEnemRegional as R, AreaLinhaReg, PontoSerieReg,
} from '../../lib/enemRegionalRelatorio';
import { rotuloRegional } from '../../lib/regionais';

// Paleta esmeralda (idêntica ao relatório individual do ENEM).
const C = {
  dark: '#064e3b', green: '#059669', greenSoft: '#10b981', teal: '#0d9488', amber: '#f59e0b',
  blue: '#1d4ed8', ink: '#0f172a', gray: '#64748b', grayL: '#94a3b8', line: '#e2e8f0', bg: '#ffffff', cardBg: '#f8fafc',
};
const SR = 'sem registro';

const num = (v: number | null | undefined, dec: number): string =>
  typeof v === 'number' && !Number.isNaN(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : SR;
const int = (v: number | null | undefined): string =>
  typeof v === 'number' && !Number.isNaN(v) ? v.toLocaleString('pt-BR') : SR;
const delta = (v: number | null): string => (v === null ? SR : `${v >= 0 ? '+' : '−'}${num(Math.abs(v), 1)}`);

const escalaY = (v: number, min: number, max: number, top: number, h: number) => top + (1 - (v - min) / (max - min || 1)) * h;
const dominio = (vals: number[], pad = 0.1, passo = 25) => {
  const v = vals.filter((x) => Number.isFinite(x));
  if (!v.length) return { min: 0, max: 1000 };
  let min = Math.min(...v), max = Math.max(...v);
  if (min === max) { min -= passo; max += passo; }
  const p = (max - min) * pad;
  return { min: Math.max(0, Math.floor((min - p) / passo) * passo), max: Math.ceil((max + p) / passo) * passo };
};

const LinhaSerie: React.FC<{ serie: PontoSerieReg[]; w?: number; h?: number }> = ({ serie, w = 720, h = 220 }) => {
  const pad = { t: 14, r: 14, b: 26, l: 40 };
  const pts = serie;
  const vals = pts.flatMap((p) => [p.regional, p.apg, p.pr]).filter((x): x is number => x != null);
  const { min, max } = dominio(vals, 0.15, 25);
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const x = (i: number) => pad.l + (pts.length <= 1 ? iw / 2 : (iw * i) / (pts.length - 1));
  const y = (v: number) => escalaY(v, min, max, pad.t, ih);
  const path = (get: (p: PontoSerieReg) => number | null) => pts.map((p, i) => { const v = get(p); return v == null ? null : `${x(i)},${y(v)}`; }).filter(Boolean).join(' ');
  const serieEl = (get: (p: PontoSerieReg) => number | null, cor: string, wd: number) => (
    <>
      <polyline points={path(get)} fill="none" stroke={cor} strokeWidth={wd} />
      {pts.map((p, i) => { const v = get(p); return v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={cor} />; })}
    </>
  );
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={C.line} strokeWidth={1} />
          <text x={pad.l - 6} y={y(t)} fontSize={9} fill={C.grayL} textAnchor="end" dominantBaseline="middle">{num(t, 0)}</text>
        </g>
      ))}
      {pts.map((p, i) => <text key={p.ano} x={x(i)} y={h - pad.b + 15} fontSize={9} fill={C.gray} textAnchor="middle">{p.ano}</text>)}
      {serieEl((p) => p.pr, C.amber, 1.6)}
      {serieEl((p) => p.apg, C.blue, 1.6)}
      {serieEl((p) => p.regional, C.green, 2.6)}
    </svg>
  );
};

const BarrasContexto: React.FC<{ regional: number | null; apg: number | null; pr: number | null; brasil: number; w?: number; h?: number }> = ({ regional, apg, pr, brasil, w = 720, h = 230 }) => {
  const pad = { t: 16, r: 14, b: 30, l: 40 };
  const grupos = [
    { label: 'Regional', v: regional, cor: C.green }, { label: 'APG', v: apg, cor: C.blue },
    { label: 'PR', v: pr, cor: C.teal }, { label: 'Brasil', v: brasil, cor: C.grayL },
  ];
  const vals = grupos.map((g) => g.v).filter((x): x is number => x != null);
  const { min, max } = dominio(vals.concat([brasil]), 0.18, 25);
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const y = (v: number) => escalaY(v, min, max, pad.t, ih);
  const gw = iw / grupos.length, bw = Math.min(56, gw * 0.5);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={C.line} strokeWidth={1} strokeDasharray="3 3" />
          <text x={pad.l - 6} y={y(t)} fontSize={9} fill={C.grayL} textAnchor="end" dominantBaseline="middle">{num(t, 0)}</text>
        </g>
      ))}
      {grupos.map((g, i) => {
        const cx = pad.l + gw * i + gw / 2;
        if (g.v == null) return <text key={g.label} x={cx} y={h - pad.b + 15} fontSize={9} fill={C.gray} textAnchor="middle">{g.label}</text>;
        return (
          <g key={g.label}>
            <rect x={cx - bw / 2} y={y(g.v)} width={bw} height={Math.max(0, h - pad.b - y(g.v))} fill={g.cor} rx={3} />
            <text x={cx} y={y(g.v) - 5} fontSize={11} fill={C.ink} textAnchor="middle" fontWeight={700}>{num(g.v, 1)}</text>
            <text x={cx} y={h - pad.b + 15} fontSize={9} fill={C.gray} textAnchor="middle">{g.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

// Barras comparando todas as regionais (edição atual); destaca a atual.
const BarrasRegionais: React.FC<{ regionais: R['regionais']; w?: number; h?: number }> = ({ regionais, w = 720, h = 180 }) => {
  const pad = { t: 16, r: 14, b: 28, l: 40 };
  const vals = regionais.map((r) => r.media).filter((x): x is number => x != null);
  const { min, max } = dominio(vals, 0.18, 25);
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const y = (v: number) => escalaY(v, min, max, pad.t, ih);
  const gw = iw / (regionais.length || 1), bw = Math.min(60, gw * 0.42);
  const ticks = [0, 0.5, 1].map((t) => min + (max - min) * t);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={C.line} strokeWidth={1} strokeDasharray="3 3" />
          <text x={pad.l - 6} y={y(t)} fontSize={9} fill={C.grayL} textAnchor="end" dominantBaseline="middle">{num(t, 0)}</text>
        </g>
      ))}
      {regionais.map((r, i) => {
        const cx = pad.l + gw * i + gw / 2;
        if (r.media == null) return <text key={r.codigo} x={cx} y={h - pad.b + 15} fontSize={9} fill={C.gray} textAnchor="middle">{r.codigo}</text>;
        return (
          <g key={r.codigo}>
            <rect x={cx - bw / 2} y={y(r.media)} width={bw} height={Math.max(0, h - pad.b - y(r.media))} fill={r.destaque ? C.green : C.grayL} opacity={r.destaque ? 1 : 0.5} rx={3} />
            <text x={cx} y={y(r.media) - 5} fontSize={10} fill={C.ink} textAnchor="middle" fontWeight={700}>{num(r.media, 1)}</text>
            <text x={cx} y={h - pad.b + 15} fontSize={9} fill={r.destaque ? C.ink : C.gray} textAnchor="middle" fontWeight={r.destaque ? 700 : 400}>{r.codigo}</text>
          </g>
        );
      })}
    </svg>
  );
};

const Radar: React.FC<{ areas: AreaLinhaReg[]; w?: number }> = ({ areas, w = 320 }) => {
  const size = w, cx = size / 2, cy = size / 2, R2 = size / 2 - 54, N = areas.length;
  const vals = areas.flatMap((a) => [a.regional, a.apg, a.brasil]).filter((x): x is number => x != null);
  const dmin = vals.length ? Math.max(0, Math.floor((Math.min(...vals) - 20) / 50) * 50) : 400;
  const dmax = vals.length ? Math.ceil((Math.max(...vals) + 20) / 50) * 50 : 900;
  const ang = (i: number) => (-90 + i * (360 / N)) * (Math.PI / 180);
  const at = (val: number | null, i: number): [number, number] => {
    const r = val == null ? 0 : Math.max(0, Math.min(1, (val - dmin) / (dmax - dmin || 1))) * R2;
    return [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  };
  const poly = (get: (a: AreaLinhaReg) => number | null) => areas.map((a, i) => at(get(a), i).join(',')).join(' ');
  const rings = [0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: size, margin: '0 auto', display: 'block' }}>
      {rings.map((rr, ri) => (
        <polygon key={ri} points={areas.map((_, i) => { const r = rr * R2; return [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))].join(','); }).join(' ')} fill="none" stroke={C.line} strokeWidth={1} />
      ))}
      {areas.map((_, i) => { const [x, y] = at(dmax, i); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={C.line} strokeWidth={1} />; })}
      <polygon points={poly((a) => a.brasil)} fill="none" stroke={C.grayL} strokeWidth={1.4} strokeDasharray="4 3" />
      <polygon points={poly((a) => a.apg)} fill="none" stroke={C.blue} strokeWidth={1.6} />
      <polygon points={poly((a) => a.regional)} fill={C.green} fillOpacity={0.22} stroke={C.green} strokeWidth={2.2} />
      {areas.map((a, i) => { const v = a.regional; if (v == null) return null; const [x, y] = at(v, i); return <circle key={i} cx={x} cy={y} r={2.6} fill={C.green} />; })}
      {areas.map((a, i) => { const [x, y] = at(dmax, i); const lx = cx + (x - cx) * 1.22, ly = cy + (y - cy) * 1.22; return <text key={i} x={lx} y={ly} fontSize={10} fill={C.ink} textAnchor="middle" dominantBaseline="middle" fontWeight={600}>{a.label}</text>; })}
    </svg>
  );
};

const BarrasAreas: React.FC<{ areas: AreaLinhaReg[]; w?: number; h?: number }> = ({ areas, w = 720, h = 250 }) => {
  const pad = { t: 16, r: 14, b: 44, l: 40 };
  const vals = areas.flatMap((a) => [a.regional, a.apg]).filter((x): x is number => x != null);
  const { min, max } = dominio(vals, 0.12, 25);
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const y = (v: number) => escalaY(v, min, max, pad.t, ih);
  const gw = iw / areas.length, bw = Math.min(26, gw * 0.3);
  const ticks = [0, 0.33, 0.66, 1].map((t) => min + (max - min) * t);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={C.line} strokeWidth={1} strokeDasharray="3 3" />
          <text x={pad.l - 6} y={y(t)} fontSize={9} fill={C.grayL} textAnchor="end" dominantBaseline="middle">{num(t, 0)}</text>
        </g>
      ))}
      {areas.map((a, i) => {
        const cx = pad.l + gw * i + gw / 2;
        const bar = (v: number | null, off: number, cor: string) => v == null ? null : (
          <>
            <rect x={cx + off} y={y(v)} width={bw} height={Math.max(0, h - pad.b - y(v))} fill={cor} rx={2} />
            <text x={cx + off + bw / 2} y={y(v) - 4} fontSize={8.5} fill={C.ink} textAnchor="middle" fontWeight={600}>{num(v, 0)}</text>
          </>
        );
        return (
          <g key={a.key}>
            {bar(a.regional, -bw - 2, C.green)}
            {bar(a.apg, 2, C.blue)}
            <text x={cx} y={h - pad.b + 14} fontSize={8.5} fill={C.gray} textAnchor="middle">{a.label.split(' ')[0]}</text>
          </g>
        );
      })}
    </svg>
  );
};

const Dispersao: React.FC<{ pts: { alunos: number; media: number; destaque: boolean }[]; w?: number; h?: number }> = ({ pts, w = 720, h = 240 }) => {
  const pad = { t: 14, r: 16, b: 34, l: 42 };
  if (!pts.length) return <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}><text x={w / 2} y={h / 2} fontSize={11} fill={C.grayL} textAnchor="middle">{SR}</text></svg>;
  const ax = pts.map((p) => p.alunos), ay = pts.map((p) => p.media);
  const xmin = 0, xmax = Math.ceil(Math.max(...ax) * 1.05);
  const ymin = Math.floor((Math.min(...ay) - 15) / 25) * 25, ymax = Math.ceil((Math.max(...ay) + 15) / 25) * 25;
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const X = (v: number) => pad.l + ((v - xmin) / (xmax - xmin || 1)) * iw;
  const Y = (v: number) => escalaY(v, ymin, ymax, pad.t, ih);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}>
      {[ymin, (ymin + ymax) / 2, ymax].map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={Y(t)} y2={Y(t)} stroke={C.line} strokeDasharray="3 3" />
          <text x={pad.l - 5} y={Y(t)} fontSize={8} fill={C.grayL} textAnchor="end" dominantBaseline="middle">{num(t, 0)}</text>
        </g>
      ))}
      {[xmin, xmax / 2, xmax].map((t, i) => <text key={i} x={X(t)} y={h - pad.b + 14} fontSize={8} fill={C.gray} textAnchor="middle">{int(Math.round(t))}</text>)}
      <text x={pad.l + iw / 2} y={h - 4} fontSize={8} fill={C.gray} textAnchor="middle">Alunos válidos</text>
      {pts.filter((p) => !p.destaque).map((p, i) => <circle key={i} cx={X(p.alunos)} cy={Y(p.media)} r={4} fill="#cbd5e1" opacity={0.8} />)}
      {pts.filter((p) => p.destaque).map((p, i) => <circle key={`d${i}`} cx={X(p.alunos)} cy={Y(p.media)} r={5.5} fill={C.green} stroke="#047857" strokeWidth={1.3} />)}
    </svg>
  );
};

// ===========================================================================
const Pagina: React.FC<{ children: React.ReactNode; escuro?: boolean }> = ({ children, escuro }) => (
  <div className="rel-page" style={{ width: 794, minHeight: 1123, background: escuro ? C.dark : C.bg, color: escuro ? '#fff' : C.ink, padding: escuro ? 0 : 48, boxSizing: 'border-box', position: 'relative', fontFamily: 'Inter, Arial, sans-serif' }}>
    {children}
    {!escuro && (
      <div style={{ position: 'absolute', left: 48, right: 48, bottom: 20, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.grayL, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
        <span>Fonte: microdados do ENEM por escola — Inep. Médias ponderadas pelo nº de alunos válidos.</span>
        <span>RADAR ENEM</span>
      </div>
    )}
  </div>
);
const Secao: React.FC<{ n: string; kicker: string; titulo: string; sub?: string }> = ({ n, kicker, titulo, sub }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: C.green, letterSpacing: 0.5, textTransform: 'uppercase' }}>{n}. {kicker}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: C.ink, marginTop: 2 }}>{titulo}</div>
    {sub && <div style={{ fontSize: 12, color: C.gray, marginTop: 4 }}>{sub}</div>}
  </div>
);
const CardMini: React.FC<{ cor: string; label: string; valor: string; nota?: string }> = ({ cor, label, valor, nota }) => (
  <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, borderLeft: `4px solid ${cor}` }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, marginTop: 4 }}>{valor}</div>
    {nota && <div style={{ fontSize: 10, color: C.grayL, marginTop: 2 }}>{nota}</div>}
  </div>
);
const rk = (r: { pos: number; total: number } | null): string => (r ? `${r.pos}º entre ${r.total}` : SR);
const frac = (r: { x: number; n: number } | null): string => (r ? `${r.x} de ${r.n}` : SR);

// ===========================================================================
const EnemRegionalRelatorio: React.FC<{ relatorio: RelatorioEnemRegional; onClose: () => void }> = ({ relatorio, onClose }) => {
  const [exportando, setExportando] = useState(false);
  const r = relatorio;
  const nomeReg = rotuloRegional(r.regional);

  const baixarPdf = async () => {
    setExportando(true);
    try {
      const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const paginas = Array.from(document.querySelectorAll<HTMLElement>('.rel-page'));
      const pdf = new JsPDF('p', 'mm', 'a4');
      for (let i = 0; i < paginas.length; i++) {
        const canvas = await html2canvas(paginas[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      }
      pdf.save(`Relatorio_ENEM_Regional_${r.regional}.pdf`);
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      alert('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setExportando(false);
    }
  };

  const linhaTabela = (rows: (string | number)[], head = false) => (
    <tr>
      {rows.map((c, i) => (
        <td key={i} style={{ padding: '6px 8px', fontSize: 11, textAlign: i === 0 ? 'left' : 'center', fontWeight: head ? 700 : 400, color: head ? '#fff' : C.ink, background: head ? C.green : 'transparent', borderBottom: `1px solid ${C.line}` }}>{c}</td>
      ))}
    </tr>
  );
  const Legenda: React.FC<{ itens: { cor: string; label: string }[] }> = ({ itens }) => (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 6 }}>
      {itens.map((it) => (
        <span key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: C.gray }}>
          <span style={{ width: 14, height: 3, background: it.cor, display: 'inline-block' }} /> {it.label}
        </span>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="text-sm font-semibold text-gray-800">Relatório regional ENEM · {nomeReg} ({r.regional})</div>
        <div className="flex items-center gap-2">
          <button onClick={baixarPdf} disabled={exportando} className="flex items-center gap-2 bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exportando ? 'Gerando PDF...' : 'Baixar PDF'}
          </button>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-auto py-6">
        <div className="mx-auto flex flex-col items-center gap-6" style={{ width: 'fit-content' }}>

          {/* Página 1 — Capa */}
          <Pagina escuro>
            <div style={{ padding: 56, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1 }}>RADAR ENEM</div>
              <div style={{ marginTop: 90, fontSize: 11, fontWeight: 700, color: '#6ee7b7', letterSpacing: 1 }}>RELATÓRIO REGIONAL DE DESEMPENHO</div>
              <div style={{ marginTop: 16, fontSize: 40, fontWeight: 800, lineHeight: 1.1 }}>Regional {r.regional}</div>
              <div style={{ marginTop: 10, fontSize: 18, color: '#e2e8f0', fontWeight: 600 }}>{nomeReg}</div>
              <div style={{ marginTop: 20, fontSize: 13, color: '#d1fae5' }}>
                {r.totalEscolas} escola(s) do grupo APG{r.municipios.length ? ` · ${r.municipios.length} município(s)` : ''}
              </div>
              {r.municipios.length > 0 && <div style={{ fontSize: 12, color: '#a7f3d0', marginTop: 4 }}>{r.municipios.join(' · ')}</div>}
              <div style={{ height: 1, background: '#065f46', margin: '28px 0' }} />
              <div style={{ fontSize: 22, fontWeight: 800 }}>ENEM {r.anoAtual ?? ''}</div>
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#a7f3d0' }}>
                <span>Média geral e 5 áreas de conhecimento</span>
                <span>Gerado em {r.geradoEm}</span>
              </div>
            </div>
          </Pagina>

          {/* Página 2 — Resumo executivo */}
          <Pagina>
            <Secao n="1" kicker="Resumo executivo" titulo={r.tituloExecutivo}
              sub={`Regional ${r.regional} · ${nomeReg} · médias ponderadas das escolas do grupo APG na regional.`} />
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: 'uppercase' }}>Média geral ponderada</div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 44, fontWeight: 800 }}>{num(r.mediaAtual, 1)}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: r.deltaMedia != null && r.deltaMedia >= 0 ? C.green : '#ef4444' }}>{delta(r.deltaMedia)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: C.grayL }}>
                  <span>{r.anoAnterior ?? '—'}: {num(r.mediaAnterior, 1)}</span>
                  <span>{r.nEscolas} escola(s) na média</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <CardMini cor={C.blue} label="Redação" valor={num(r.redacaoAtual, 1)} nota="ponderada" />
                <CardMini cor={C.teal} label="Alunos válidos" valor={int(r.alunosAtual)} nota="na regional" />
                <CardMini cor={C.green} label="Entre regionais" valor={rk(r.rankRegionais)} />
                <CardMini cor={C.amber} label="≥ média APG" valor={frac(r.acimaApg)} nota="escolas" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
              {r.areas.map((a) => (
                <div key={a.key} style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.gray, textTransform: 'uppercase' }}>{a.label.split(' ')[0]}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.ink, marginTop: 3 }}>{num(a.regional, 0)}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#047857', marginBottom: 8 }}>Leitura executiva</div>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {r.leituraExecutiva.map((b, i) => <li key={i} style={{ fontSize: 11.5, color: C.ink, marginBottom: 5 }}>{b}</li>)}
              </ol>
            </div>
          </Pagina>

          {/* Página 3 — Contexto e posicionamento */}
          <Pagina>
            <Secao n="2" kicker="Contexto e posicionamento" titulo="Como a regional se posiciona"
              sub="Média da regional comparada ao grupo APG, às escolas do Paraná e à referência nacional, e frente às demais regionais." />
            <BarrasContexto regional={r.compRegional} apg={r.compApg.media} pr={r.compPr.media} brasil={r.brasilMedia} />
            <Legenda itens={[{ cor: C.green, label: 'Regional' }, { cor: C.blue, label: 'APG' }, { cor: C.teal, label: 'Paraná' }, { cor: C.grayL, label: 'Brasil (ref.)' }]} />
            <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginTop: 10, marginBottom: 2 }}>Média geral por regional</div>
            <BarrasRegionais regionais={r.regionais} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 14 }}>
              <CardMini cor={C.green} label="Entre regionais" valor={rk(r.rankRegionais)} />
              <CardMini cor={C.blue} label="Escolas ≥ média APG" valor={frac(r.acimaApg)} />
              <CardMini cor={C.teal} label="Escolas ≥ média PR" valor={frac(r.acimaPr)} />
            </div>
            <div style={{ fontSize: 10, color: C.grayL, marginTop: 12 }}>
              Rankings entre regionais por média geral ponderada; empates recebem a mesma posição. A referência nacional é um valor divulgado pelo INEP.
            </div>
          </Pagina>

          {/* Página 4 — Evolução histórica */}
          <Pagina>
            <Secao n="3" kicker="Evolução histórica" titulo="Trajetória da média geral"
              sub="A série mostra a média ponderada da regional, do grupo APG e das escolas do Paraná." />
            <LinhaSerie serie={r.serie} />
            <Legenda itens={[{ cor: C.green, label: 'Regional' }, { cor: C.blue, label: 'APG' }, { cor: C.amber, label: 'Paraná' }]} />
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 18 }}>
              <tbody>
                {linhaTabela(['Série', ...r.serie.map((p) => p.ano)], true)}
                {linhaTabela(['Regional', ...r.serie.map((p) => num(p.regional, 1))])}
                {linhaTabela(['APG', ...r.serie.map((p) => num(p.apg, 1))])}
                {linhaTabela(['Paraná', ...r.serie.map((p) => num(p.pr, 1))])}
              </tbody>
            </table>
          </Pagina>

          {/* Página 5 — Perfil por área */}
          <Pagina>
            <Secao n="4" kicker="O que explica o resultado" titulo="Perfil por área de conhecimento"
              sub="A média resulta das 5 provas. O radar cruza a regional com o grupo APG e a referência nacional." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'center' }}>
              <Radar areas={r.areas} />
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {linhaTabela(['Área', 'Regional', 'APG', 'Brasil'], true)}
                  {r.areas.map((a) => linhaTabela([a.label, num(a.regional, 1), num(a.apg, 1), num(a.brasil, 1)]))}
                </tbody>
              </table>
            </div>
            <Legenda itens={[{ cor: C.green, label: 'Regional' }, { cor: C.blue, label: 'APG' }, { cor: C.grayL, label: 'Brasil (ref.)' }]} />
            <div style={{ background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: 10, padding: 14, marginTop: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#047857', marginBottom: 6 }}>Diagnóstico</div>
              <div style={{ fontSize: 11.5, color: C.ink }}>
                A média aritmética das 5 provas da regional é {num(r.mediaAreas, 1)}
                {r.oportunidadeArea ? `, e a maior distância abaixo do grupo APG está em ${r.oportunidadeArea} (regional ${num(r.oportunidadeRegional, 1)} × APG ${num(r.oportunidadeApg, 1)}).` : '. A regional está igual ou acima da média do grupo APG nas áreas com registro.'}
              </div>
            </div>
          </Pagina>

          {/* Página 6 — Áreas e redação */}
          <Pagina>
            <Secao n="5" kicker="Áreas e redação" titulo="Onde concentrar o preparo"
              sub="Comparação por área entre a regional e a média ponderada do grupo APG." />
            <BarrasAreas areas={r.areas} />
            <Legenda itens={[{ cor: C.green, label: 'Regional' }, { cor: C.blue, label: 'APG' }]} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
              <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Redação</div>
                <div style={{ fontSize: 11.5, color: C.gray }}>
                  Nota média (ponderada) de Redação em {r.anoAtual ?? '—'}: <strong style={{ color: C.ink }}>{num(r.redacaoAtual, 1)}</strong>.
                  Referência nacional: {num(r.areas.find((a) => a.key === 'rd')?.brasil ?? null, 1)}.
                </div>
              </div>
              <div style={{ background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#047857', marginBottom: 6 }}>Maior oportunidade</div>
                <div style={{ fontSize: 11.5, color: C.ink }}>
                  {r.oportunidadeArea
                    ? `${r.oportunidadeArea}: regional ${num(r.oportunidadeRegional, 1)} × APG ${num(r.oportunidadeApg, 1)} — diferença de ${num((r.oportunidadeApg ?? 0) - (r.oportunidadeRegional ?? 0), 1)} ponto(s).`
                    : 'A regional está igual ou acima da média do grupo APG nas áreas com registro.'}
                </div>
              </div>
            </div>
          </Pagina>

          {/* Página 7 — Posição no grupo APG + escolas */}
          <Pagina>
            <Secao n="6" kicker="Posição no grupo APG" titulo="As escolas da regional no conjunto APG"
              sub="Cada ponto é uma escola do grupo APG na edição atual (nº de alunos × média); as escolas da regional aparecem destacadas." />
            <Dispersao pts={r.scatter} />
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginTop: 16, marginBottom: 6 }}>
              Escolas da regional — {r.anoAtual ?? '—'}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {linhaTabela(['#', 'Escola', 'Município', 'Média', 'Alunos'], true)}
                {r.escolas.length === 0
                  ? linhaTabela(['—', 'Sem escolas com registro nesta edição', '', '', ''])
                  : r.escolas.map((s, i) => (
                    <tr key={s.inep}>
                      {[i + 1, s.escola, s.cidade, num(s.media, 1), int(s.alunos)].map((c, k) => (
                        <td key={k} style={{ padding: '6px 8px', fontSize: 11, textAlign: (k === 1 || k === 2) ? 'left' : (k === 0 ? 'left' : 'center'), color: C.ink, borderBottom: `1px solid ${C.line}` }}>{c}</td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </Pagina>

          {/* Página 8 — Prioridades */}
          <Pagina>
            <Secao n="7" kicker="Prioridades e próximos passos" titulo="Transformar o diagnóstico em ação"
              sub="Proposta inicial para discussão com as escolas da regional. O cenário abaixo não é meta oficial do Inep." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['Priorizar a área de maior lacuna', r.oportunidadeArea ? `Concentrar o preparo em ${r.oportunidadeArea} nas escolas da regional, onde a distância para a média do grupo APG é maior.` : 'Manter o preparo equilibrado entre as áreas, preservando os resultados acima da média do grupo.'],
                ['Nivelar dentro da regional', 'Aproximar as escolas de menor média das de referência da própria regional, compartilhando práticas entre as unidades.'],
                ['Sustentar a redação', 'Acompanhar a produção textual ao longo do ano, com correções por competência e devolutivas frequentes.'],
                ['Monitorar comparáveis', 'Revisar a posição da regional no grupo APG e frente às demais regionais a cada edição, olhando a dispersão interna.'],
              ].map(([t, d], i) => (
                <div key={i} style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 4 }}>{i + 1}. {t}</div>
                  <div style={{ fontSize: 11, color: C.ink }}>{d}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, marginTop: 22, marginBottom: 10 }}>Cenário por área</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, borderLeft: `4px solid ${C.green}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: 'uppercase' }}>Média das 5 provas (atual)</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{num(r.mediaAreas, 1)}</div>
                <div style={{ fontSize: 10, color: C.grayL, marginTop: 2 }}>média aritmética das áreas da regional</div>
              </div>
              <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, borderLeft: `4px solid ${C.blue}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: 'uppercase' }}>Cenário {r.oportunidadeArea ? `· ${r.oportunidadeArea} = APG` : ''}</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{num(r.cenarioMediaAreas, 1)}</div>
                <div style={{ fontSize: 10, color: C.grayL, marginTop: 2 }}>
                  {r.oportunidadeArea ? `se ${r.oportunidadeArea} alcançar a média APG (${num(r.oportunidadeApg, 1)})` : 'sem lacuna abaixo da média APG'}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: C.grayL, marginTop: 20 }}>
              Metodologia: a nota da regional em cada indicador é a média ponderada pelo nº de alunos válidos das escolas com resultado. Rankings entre regionais por média geral ponderada.
              O cenário eleva apenas a área de maior lacuna à média do grupo APG e recalcula a média aritmética das 5 provas — referência de planejamento, não projeção do INEP.
            </div>
          </Pagina>

        </div>
      </div>
    </div>
  );
};

export default EnemRegionalRelatorio;
