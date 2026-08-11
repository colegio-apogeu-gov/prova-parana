import React, { useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import {
  RelatorioRegional, RelatorioRegionalEtapa, PontoSerieReg,
  INCREMENTO_N_CENARIO, rotuloRegional,
} from '../../lib/idebRegionalRelatorio';

// Paleta fixa (hex explícito — html2canvas rasteriza melhor sem depender de
// classes de cor; e mantém o relatório fiel independentemente do tema).
// Idêntica à do relatório individual de escola, para a identidade visual bater.
const C = {
  navy: '#0f2544',
  navySoft: '#1e3a8a',
  teal: '#0d9488',
  amber: '#f59e0b',
  green: '#10b981',
  blue: '#1d4ed8',
  ink: '#0f172a',
  gray: '#64748b',
  grayL: '#94a3b8',
  line: '#e2e8f0',
  bg: '#ffffff',
  cardBg: '#f8fafc',
};
const SR = 'sem registro';

// ---- formatação (pt-BR) ----
const num = (v: number | null | undefined, dec: number): string =>
  typeof v === 'number' && !Number.isNaN(v)
    ? v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    : SR;
const pct100 = (v: number | null | undefined): string => // v em 0..1
  typeof v === 'number' && !Number.isNaN(v) ? `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : SR;
const pctNum = (v: number | null | undefined): string => // v já em %
  typeof v === 'number' && !Number.isNaN(v) ? `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : SR;
const delta = (v: number | null): string => (v === null ? SR : `${v >= 0 ? '+' : '−'}${num(Math.abs(v), 1)}`);

// ===========================================================================
// Gráficos SVG (inline, sem libs) — mesmos visuais do relatório de escola
// ===========================================================================
const escalaY = (v: number, min: number, max: number, top: number, h: number) =>
  top + (1 - (v - min) / (max - min || 1)) * h;

const dominio = (vals: number[], pad = 0.12, passo = 0.5) => {
  const v = vals.filter((x) => Number.isFinite(x));
  if (!v.length) return { min: 0, max: 10 };
  let min = Math.min(...v), max = Math.max(...v);
  if (min === max) { min -= passo; max += passo; }
  const p = (max - min) * pad;
  return { min: Math.max(0, Math.floor((min - p) / passo) * passo), max: Math.ceil((max + p) / passo) * passo };
};

// Linha múltipla (regional / APG / PR) por edição
const LinhaSerie: React.FC<{ serie: PontoSerieReg[]; w?: number; h?: number }> = ({ serie, w = 720, h = 210 }) => {
  const pad = { t: 14, r: 14, b: 26, l: 34 };
  const pts = serie;
  const vals = pts.flatMap((p) => [p.regional, p.apg, p.pr]).filter((x): x is number => x != null);
  const { min, max } = dominio(vals, 0.12, 0.5);
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const x = (i: number) => pad.l + (pts.length <= 1 ? iw / 2 : (iw * i) / (pts.length - 1));
  const y = (v: number) => escalaY(v, min, max, pad.t, ih);
  const path = (get: (p: PontoSerieReg) => number | null) =>
    pts.map((p, i) => { const v = get(p); return v == null ? null : `${x(i)},${y(v)}`; }).filter(Boolean).join(' ');
  const serieEl = (get: (p: PontoSerieReg) => number | null, cor: string, wd: number) => (
    <>
      <polyline points={path(get)} fill="none" stroke={cor} strokeWidth={wd} />
      {pts.map((p, i) => { const v = get(p); return v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={3} fill={cor} />; })}
    </>
  );
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={C.line} strokeWidth={1} />
          <text x={pad.l - 6} y={y(t)} fontSize={9} fill={C.grayL} textAnchor="end" dominantBaseline="middle">{num(t, 1)}</text>
        </g>
      ))}
      {pts.map((p, i) => {
        const passo = pts.length > 8 ? 2 : 1;
        if (i % passo !== 0 && i !== pts.length - 1) return null;
        return <text key={p.ano} x={x(i)} y={h - pad.b + 15} fontSize={9} fill={C.gray} textAnchor="middle">{p.ano}</text>;
      })}
      {serieEl((p) => p.pr, C.amber, 1.6)}
      {serieEl((p) => p.apg, C.navySoft, 1.6)}
      {serieEl((p) => p.regional, C.teal, 2.4)}
    </svg>
  );
};

// Barras agrupadas: Regional/APG/PR estadual × (AF, EM)
const BarrasContexto: React.FC<{ af: RelatorioRegionalEtapa; em: RelatorioRegionalEtapa; w?: number; h?: number }> = ({ af, em, w = 720, h = 250 }) => {
  const pad = { t: 16, r: 14, b: 30, l: 34 };
  const grupos = [
    { label: 'Regional', af: af.compRegional, em: em.compRegional },
    { label: 'APG', af: af.compApg.media, em: em.compApg.media },
    { label: 'PR estadual', af: af.compPr.media, em: em.compPr.media },
  ];
  const vals = grupos.flatMap((g) => [g.af, g.em]).filter((x): x is number => x != null);
  const max = Math.max(7, Math.ceil((Math.max(...vals, 1)))); const min = 0;
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const y = (v: number) => escalaY(v, min, max, pad.t, ih);
  const gw = iw / grupos.length;
  const bw = Math.min(30, gw * 0.24);
  const ticks = [0, 1.8, 3.5, 5.2, 7].filter((t) => t <= max);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={C.line} strokeWidth={1} strokeDasharray="3 3" />
          <text x={pad.l - 6} y={y(t)} fontSize={9} fill={C.grayL} textAnchor="end" dominantBaseline="middle">{num(t, 1)}</text>
        </g>
      ))}
      {grupos.map((g, i) => {
        const cx = pad.l + gw * i + gw / 2;
        const bar = (v: number | null, off: number, cor: string) => v == null ? null : (
          <>
            <rect x={cx + off} y={y(v)} width={bw} height={Math.max(0, h - pad.b - y(v))} fill={cor} rx={2} />
            <text x={cx + off + bw / 2} y={y(v) - 4} fontSize={9} fill={C.ink} textAnchor="middle" fontWeight={600}>{num(v, 2)}</text>
          </>
        );
        return (
          <g key={g.label}>
            {bar(g.af, -bw - 2, C.teal)}
            {bar(g.em, 2, C.navySoft)}
            <text x={cx} y={h - pad.b + 15} fontSize={9} fill={C.gray} textAnchor="middle">{g.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

// Barras comparando todas as regionais (edição atual) por etapa; destaca a atual.
const BarrasRegionais: React.FC<{ af: RelatorioRegionalEtapa; em: RelatorioRegionalEtapa; w?: number; h?: number }> = ({ af, em, w = 720, h = 190 }) => {
  const pad = { t: 16, r: 14, b: 28, l: 34 };
  const codigos = Array.from(new Set([...af.regionais, ...em.regionais].map((r) => r.codigo))).sort();
  const valOf = (e: RelatorioRegionalEtapa, cod: string) => e.regionais.find((r) => r.codigo === cod)?.media ?? null;
  const vals = codigos.flatMap((c) => [valOf(af, c), valOf(em, c)]).filter((x): x is number => x != null);
  const max = Math.max(7, Math.ceil(Math.max(...vals, 1))); const min = 0;
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const y = (v: number) => escalaY(v, min, max, pad.t, ih);
  const gw = iw / (codigos.length || 1);
  const bw = Math.min(30, gw * 0.24);
  const ticks = [0, 1.8, 3.5, 5.2, 7].filter((t) => t <= max);
  const destaque = af.regionais.find((r) => r.destaque)?.codigo;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={C.line} strokeWidth={1} strokeDasharray="3 3" />
          <text x={pad.l - 6} y={y(t)} fontSize={9} fill={C.grayL} textAnchor="end" dominantBaseline="middle">{num(t, 1)}</text>
        </g>
      ))}
      {codigos.map((cod, i) => {
        const cx = pad.l + gw * i + gw / 2;
        const forte = cod === destaque;
        const bar = (v: number | null, off: number, cor: string) => v == null ? null : (
          <>
            <rect x={cx + off} y={y(v)} width={bw} height={Math.max(0, h - pad.b - y(v))} fill={cor} rx={2} opacity={forte ? 1 : 0.45} />
            <text x={cx + off + bw / 2} y={y(v) - 4} fontSize={9} fill={C.ink} textAnchor="middle" fontWeight={600}>{num(v, 2)}</text>
          </>
        );
        return (
          <g key={cod}>
            {bar(valOf(af, cod), -bw - 2, C.teal)}
            {bar(valOf(em, cod), 2, C.navySoft)}
            <text x={cx} y={h - pad.b + 15} fontSize={9} fill={forte ? C.ink : C.gray} textAnchor="middle" fontWeight={forte ? 700 : 400}>{cod}</text>
          </g>
        );
      })}
    </svg>
  );
};

// Duas barras por ano (ex.: P×N ou MT×LP)
const BarrasDuplas: React.FC<{
  anoA: string | null; anoB: string | null;
  serie1: { a: number | null; b: number | null; cor: string; escala?: number };
  serie2: { a: number | null; b: number | null; cor: string; escala?: number };
  dec?: number; sufixo1?: string; sufixo2?: string; w?: number; h?: number;
}> = ({ anoA, anoB, serie1, serie2, dec = 1, sufixo1 = '', sufixo2 = '', w = 340, h = 200 }) => {
  const pad = { t: 18, r: 10, b: 26, l: 30 };
  const e1 = serie1.escala ?? 1, e2 = serie2.escala ?? 1;
  const raw = [serie1.a, serie1.b].map((v) => v == null ? null : v * e1)
    .concat([serie2.a, serie2.b].map((v) => v == null ? null : v * e2))
    .filter((x): x is number => x != null);
  if (!raw.length) return <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}><text x={w / 2} y={h / 2} fontSize={11} fill={C.grayL} textAnchor="middle">{SR}</text></svg>;
  const min = Math.max(0, Math.floor(Math.min(...raw) * 0.9)), max = Math.ceil(Math.max(...raw) * 1.05);
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const y = (v: number) => escalaY(v, min, max, pad.t, ih);
  const cols = [{ ano: anoA, a1: serie1.a, a2: serie2.a }, { ano: anoB, a1: serie1.b, a2: serie2.b }];
  const gw = iw / 2; const bw = Math.min(30, gw * 0.28);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}>
      <line x1={pad.l} x2={w - pad.r} y1={h - pad.b} y2={h - pad.b} stroke={C.line} />
      {cols.map((c, i) => {
        const cx = pad.l + gw * i + gw / 2;
        const bar = (v: number | null, esc: number, off: number, cor: string, suf: string) => {
          if (v == null) return null; const vv = v * esc;
          return (<>
            <rect x={cx + off} y={y(vv)} width={bw} height={Math.max(0, h - pad.b - y(vv))} fill={cor} rx={2} />
            <text x={cx + off + bw / 2} y={y(vv) - 4} fontSize={9} fill={C.ink} textAnchor="middle" fontWeight={600}>{num(vv, dec)}{suf}</text>
          </>);
        };
        return (<g key={i}>
          {bar(c.a1, e1, -bw - 2, serie1.cor, sufixo1)}
          {bar(c.a2, e2, 2, serie2.cor, sufixo2)}
          <text x={cx} y={h - pad.b + 15} fontSize={9} fill={C.gray} textAnchor="middle">{c.ano ?? SR}</text>
        </g>);
      })}
    </svg>
  );
};

// Dispersão P × IDEB (grupo APG), escolas da regional destacadas
const Dispersao: React.FC<{ etapa: RelatorioRegionalEtapa; w?: number; h?: number }> = ({ etapa, w = 340, h = 210 }) => {
  const pad = { t: 12, r: 12, b: 28, l: 30 };
  const pts = etapa.scatter;
  if (!pts.length) return <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}><text x={w / 2} y={h / 2} fontSize={11} fill={C.grayL} textAnchor="middle">{SR}</text></svg>;
  const px = pts.map((p) => p.p), py = pts.map((p) => p.ideb);
  const xmin = Math.min(...px, 95), xmax = Math.max(...px, 100);
  const ymin = Math.floor(Math.min(...py) * 0.98 * 10) / 10, ymax = Math.ceil(Math.max(...py) * 1.02 * 10) / 10;
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const X = (v: number) => pad.l + ((v - xmin) / (xmax - xmin || 1)) * iw;
  const Y = (v: number) => escalaY(v, ymin, ymax, pad.t, ih);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%' }}>
      {[ymin, (ymin + ymax) / 2, ymax].map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={Y(t)} y2={Y(t)} stroke={C.line} strokeDasharray="3 3" />
          <text x={pad.l - 5} y={Y(t)} fontSize={8} fill={C.grayL} textAnchor="end" dominantBaseline="middle">{num(t, 1)}</text>
        </g>
      ))}
      {[xmin, xmax].map((t, i) => (
        <text key={i} x={X(t)} y={h - pad.b + 14} fontSize={8} fill={C.gray} textAnchor="middle">{num(t, 0)}</text>
      ))}
      <text x={pad.l + iw / 2} y={h - 4} fontSize={8} fill={C.gray} textAnchor="middle">Rendimento P (%)</text>
      {pts.filter((p) => !p.destaque).map((p, i) => <circle key={i} cx={X(p.p)} cy={Y(p.ideb)} r={4} fill="#cbd5e1" opacity={0.8} />)}
      {pts.filter((p) => p.destaque).map((p, i) => (
        <circle key={`d${i}`} cx={X(p.p)} cy={Y(p.ideb)} r={5} fill={C.teal} stroke="#0f766e" strokeWidth={1.2} />
      ))}
    </svg>
  );
};

// ===========================================================================
// Blocos de página
// ===========================================================================
const Pagina: React.FC<{ children: React.ReactNode; escuro?: boolean }> = ({ children, escuro }) => (
  <div
    className="rel-page"
    style={{
      width: 794, minHeight: 1123, background: escuro ? C.navy : C.bg, color: escuro ? '#fff' : C.ink,
      padding: escuro ? 0 : 48, boxSizing: 'border-box', position: 'relative', fontFamily: 'Inter, Arial, sans-serif',
    }}
  >
    {children}
    {!escuro && (
      <div style={{ position: 'absolute', left: 48, right: 48, bottom: 20, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.grayL, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
        <span>Fonte: divulgação IDEB/SAEB 2025 — Inep. Médias simples de escolas com resultado disponível.</span>
        <span>RADAR IDEB</span>
      </div>
    )}
  </div>
);

const Secao: React.FC<{ n: string; kicker: string; titulo: string; sub?: string }> = ({ n, kicker, titulo, sub }) => (
  <div style={{ marginBottom: 18 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: C.teal, letterSpacing: 0.5, textTransform: 'uppercase' }}>{n}. {kicker}</div>
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
// Relatório completo (regional)
// ===========================================================================
const IdebRegionalRelatorio: React.FC<{ relatorio: RelatorioRegional; onClose: () => void }> = ({ relatorio, onClose }) => {
  const [exportando, setExportando] = useState(false);
  const af = relatorio.etapas.find((e) => e.etapa === 'anos_finais')!;
  const em = relatorio.etapas.find((e) => e.etapa === 'ensino_medio')!;
  const nomeReg = rotuloRegional(relatorio.regional);

  // União das edições (AF e EM têm séries diferentes) — colunas alinhadas.
  const anosUniao = Array.from(new Set([...af.serie, ...em.serie].map((p) => p.ano))).sort();
  const valorAno = (e: RelatorioRegionalEtapa, ano: string): string => {
    const p = e.serie.find((s) => s.ano === ano);
    return p ? num(p.regional, 1) : '—';
  };

  const baixarPdf = async () => {
    setExportando(true);
    try {
      const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const paginas = Array.from(document.querySelectorAll<HTMLElement>('.rel-page'));
      const pdf = new JsPDF('p', 'mm', 'a4');
      const wmm = 210, hmm = 297;
      for (let i = 0; i < paginas.length; i++) {
        const canvas = await html2canvas(paginas[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
        const img = canvas.toDataURL('image/png');
        if (i > 0) pdf.addPage();
        pdf.addImage(img, 'PNG', 0, 0, wmm, hmm, undefined, 'FAST');
      }
      pdf.save(`Relatorio_IDEB_Regional_${relatorio.regional}.pdf`);
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
        <td key={i} style={{
          padding: '6px 8px', fontSize: 11, textAlign: i === 0 ? 'left' : 'center',
          fontWeight: head ? 700 : 400, color: head ? '#fff' : C.ink,
          background: head ? C.navySoft : 'transparent', borderBottom: `1px solid ${C.line}`,
        }}>{c}</td>
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
      {/* Barra de ações */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <div className="text-sm font-semibold text-gray-800">Relatório regional · {nomeReg} ({relatorio.regional})</div>
        <div className="flex items-center gap-2">
          <button
            onClick={baixarPdf}
            disabled={exportando}
            className="flex items-center gap-2 bg-violet-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-50"
          >
            {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exportando ? 'Gerando PDF...' : 'Baixar PDF'}
          </button>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Preview rolável com as páginas A4 */}
      <div className="flex-1 overflow-auto py-6">
        <div className="mx-auto flex flex-col items-center gap-6" style={{ width: 'fit-content' }}>

          {/* Página 1 — Capa */}
          <Pagina escuro>
            <div style={{ padding: 56, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1 }}>RADAR IDEB</div>
              <div style={{ marginTop: 90, fontSize: 11, fontWeight: 700, color: '#5eead4', letterSpacing: 1 }}>RELATÓRIO REGIONAL DE DESEMPENHO</div>
              <div style={{ marginTop: 16, fontSize: 40, fontWeight: 800, lineHeight: 1.1 }}>Regional {relatorio.regional}</div>
              <div style={{ marginTop: 10, fontSize: 18, color: '#e2e8f0', fontWeight: 600 }}>{nomeReg}</div>
              <div style={{ marginTop: 20, fontSize: 13, color: '#cbd5e1' }}>
                {relatorio.totalEscolas} escola(s) do grupo APG{relatorio.municipios.length ? ` · ${relatorio.municipios.length} município(s)` : ''}
              </div>
              {relatorio.municipios.length > 0 && (
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{relatorio.municipios.join(' · ')}</div>
              )}
              <div style={{ height: 1, background: '#334155', margin: '28px 0' }} />
              <div style={{ fontSize: 22, fontWeight: 800 }}>IDEB {af.anoAtual ?? em.anoAtual ?? ''}</div>
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8' }}>
                <span>Anos finais e ensino médio</span>
                <span>Gerado em {relatorio.geradoEm}</span>
              </div>
            </div>
          </Pagina>

          {/* Página 2 — Resumo executivo */}
          <Pagina>
            <Secao n="1" kicker="Resumo executivo" titulo={relatorio.tituloExecutivo}
              sub={`Regional ${relatorio.regional} · ${nomeReg} · médias das escolas do grupo APG na regional.`} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              {[af, em].map((e) => (
                <div key={e.etapa} style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: e.etapa === 'anos_finais' ? C.teal : C.navySoft, textTransform: 'uppercase' }}>{e.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 40, fontWeight: 800 }}>{num(e.idebAtual, 1)}</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: e.deltaIdeb != null && e.deltaIdeb >= 0 ? C.green : '#ef4444' }}>{delta(e.deltaIdeb)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: C.grayL }}>
                    <span>IDEB médio {e.anoAnterior ?? '—'}: {num(e.idebAnterior, 1)}</span>
                    <span>{e.nEscolas} escola(s) na média</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
              <CardMini cor={C.navySoft} label="Aprovação méd. AF" valor={pctNum(af.aprovacao)} nota={af.anoAtual ?? ''} />
              <CardMini cor={C.teal} label="Aprendizagem N AF" valor={num(af.nAtual, 2)} nota="média · escala 0–10" />
              <CardMini cor={C.navySoft} label="Aprovação méd. EM" valor={pctNum(em.aprovacao)} nota={em.anoAtual ?? ''} />
              <CardMini cor={C.teal} label="Aprendizagem N EM" valor={num(em.nAtual, 2)} nota="média · escala 0–10" />
            </div>
            <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.navySoft, marginBottom: 8 }}>Leitura executiva</div>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {relatorio.leituraExecutiva.map((b, i) => <li key={i} style={{ fontSize: 11.5, color: C.ink, marginBottom: 5 }}>{b}</li>)}
              </ol>
            </div>
          </Pagina>

          {/* Página 3 — Contexto e posicionamento */}
          <Pagina>
            <Secao n="2" kicker="Contexto e posicionamento" titulo="Como a regional se posiciona"
              sub="Média da regional comparada ao grupo APG e à rede estadual do Paraná, e frente às demais regionais." />
            <Legenda itens={[{ cor: C.teal, label: 'Anos finais' }, { cor: C.navySoft, label: 'Ensino médio' }]} />
            <BarrasContexto af={af} em={em} />
            <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginTop: 8, marginBottom: 2 }}>IDEB médio por regional</div>
            <BarrasRegionais af={af} em={em} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
              <CardMini cor={C.teal} label="Anos finais | entre regionais" valor={rk(af.rankRegionais)} />
              <CardMini cor={C.teal} label="AF | escolas ≥ média APG" valor={frac(af.acimaApg)} />
              <CardMini cor={C.teal} label="AF | escolas ≥ média PR" valor={frac(af.acimaPr)} />
              <CardMini cor={C.navySoft} label="Ensino médio | entre regionais" valor={rk(em.rankRegionais)} />
              <CardMini cor={C.navySoft} label="EM | escolas ≥ média APG" valor={frac(em.acimaApg)} />
              <CardMini cor={C.navySoft} label="EM | escolas ≥ média PR" valor={frac(em.acimaPr)} />
            </div>
            <div style={{ fontSize: 10, color: C.grayL, marginTop: 14 }}>
              Rankings entre regionais consideram apenas regionais com IDEB médio divulgado; empates recebem a mesma posição. As médias são simples, não ponderadas por matrículas.
            </div>
          </Pagina>

          {/* Página 4 — Evolução histórica */}
          <Pagina>
            <Secao n="3" kicker="Evolução histórica" titulo="Trajetória do IDEB médio"
              sub="A série mostra a média da regional, a média do grupo APG e a média das escolas estaduais do Paraná." />
            {[af, em].map((e) => (
              <div key={e.etapa} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 4 }}>{e.label}</div>
                <LinhaSerie serie={e.serie} />
              </div>
            ))}
            <Legenda itens={[{ cor: C.teal, label: 'Regional' }, { cor: C.navySoft, label: 'APG' }, { cor: C.amber, label: 'PR estadual' }]} />
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
              <tbody>
                {linhaTabela(['Etapa', ...anosUniao, 'Δ'], true)}
                {[af, em].map((e) => linhaTabela([
                  e.label,
                  ...anosUniao.map((a) => valorAno(e, a)),
                  delta(e.deltaIdeb),
                ]))}
              </tbody>
            </table>
          </Pagina>

          {/* Página 5 — O que explica */}
          <Pagina>
            <Secao n="4" kicker="O que explica o resultado" titulo="IDEB = aprendizagem (N) × rendimento (P)"
              sub="Cada barra é a média da regional. A nota combina proficiência no SAEB (N) e fluxo escolar (P)." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {[af, em].map((e) => (
                <div key={e.etapa}>
                  <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>{e.label}</div>
                  <BarrasDuplas anoA={e.anoAnterior} anoB={e.anoAtual}
                    serie1={{ a: e.pAnterior, b: e.pAtual, cor: C.navySoft, escala: 100 }}
                    serie2={{ a: e.nAnterior, b: e.nAtual, cor: C.green }}
                    dec={1} sufixo1="%" />
                </div>
              ))}
            </div>
            <Legenda itens={[{ cor: C.navySoft, label: 'Rendimento P (%)' }, { cor: C.green, label: 'Aprendizagem N' }]} />
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
              <tbody>
                {linhaTabela(['Etapa', `P ${af.anoAnterior ?? '—'}`, `P ${af.anoAtual ?? '—'}`, `N ${af.anoAnterior ?? '—'}`, `N ${af.anoAtual ?? '—'}`, `IDEB ${af.anoAtual ?? '—'}`], true)}
                {[af, em].map((e) => linhaTabela([e.label, pct100(e.pAnterior), pct100(e.pAtual), num(e.nAnterior, 2), num(e.nAtual, 2), num(e.idebAtual, 1)]))}
              </tbody>
            </table>
            <div style={{ background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: 10, padding: 14, marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#047857', marginBottom: 6 }}>Diagnóstico</div>
              <div style={{ fontSize: 11.5, color: C.ink }}>
                Na edição atual, o rendimento médio (P) foi {pct100(af.pAtual)} nos anos finais e {pct100(em.pAtual)} no ensino médio;
                a aprendizagem média (N) foi {num(af.nAtual, 2)} e {num(em.nAtual, 2)}, respectivamente (escala 0–10).
                O acompanhamento separado de Matemática e Língua Portuguesa apoia a leitura por componente na regional.
              </div>
            </div>
          </Pagina>

          {/* Página 6 — Aprendizagem e fluxo */}
          <Pagina>
            <Secao n="5" kicker="Aprendizagem e fluxo" titulo="Onde concentrar o acompanhamento"
              sub="Médias do SAEB por componente na regional. A aprovação por série não consta na base do IDEB." />
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>SAEB (média da regional): Matemática e Língua Portuguesa</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {[af, em].map((e) => (
                <div key={e.etapa}>
                  <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', marginBottom: 4 }}>{e.label}</div>
                  <BarrasDuplas anoA={e.anoAnterior} anoB={e.anoAtual}
                    serie1={{ a: e.mtAnterior, b: e.mtAtual, cor: C.navySoft }}
                    serie2={{ a: e.lpAnterior, b: e.lpAtual, cor: C.teal }}
                    dec={1} />
                </div>
              ))}
            </div>
            <Legenda itens={[{ cor: C.navySoft, label: 'Matemática' }, { cor: C.teal, label: 'Língua Portuguesa' }]} />
            <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Aprovação por série</div>
              <div style={{ fontSize: 11.5, color: C.gray }}>
                {SR} — a fonte do IDEB traz apenas a taxa de aprovação total da etapa
                (anos finais: {pctNum(af.aprovacao)}; ensino médio: {pctNum(em.aprovacao)} na média da regional, edição atual).
              </div>
            </div>
            <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 10, padding: 14, marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.navySoft, marginBottom: 6 }}>Sinais para a gestão pedagógica</div>
              <div style={{ fontSize: 11.5, color: C.ink }}>
                Nos anos finais, a média de Matemática foi {num(af.mtAtual, 1)} e a de Língua Portuguesa {num(af.lpAtual, 1)}.
                No ensino médio, {num(em.mtAtual, 1)} e {num(em.lpAtual, 1)}, respectivamente.
              </div>
            </div>
          </Pagina>

          {/* Página 7 — Posição no grupo APG + escolas da regional */}
          <Pagina>
            <Secao n="6" kicker="Posição no grupo APG" titulo="As escolas da regional no conjunto APG"
              sub="Cada ponto é uma escola-etapa do grupo APG na edição atual; as escolas da regional aparecem destacadas." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {[af, em].map((e) => (
                <div key={e.etapa}>
                  <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', marginBottom: 4 }}>{e.label}</div>
                  <Dispersao etapa={e} />
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginTop: 18, marginBottom: 6 }}>
              Escolas da regional — anos finais ({af.anoAtual ?? '—'})
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {linhaTabela(['#', 'Escola', 'Município', 'IDEB', 'N', 'P'], true)}
                {af.escolas.length === 0
                  ? linhaTabela(['—', 'Sem escolas com registro nesta etapa', '', '', '', ''])
                  : af.escolas.map((s, i) => linhaTabela([i + 1, s.escola, s.cidade, num(s.ideb, 1), num(s.n, 2), pct100(s.p)]))}
              </tbody>
            </table>
            <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 10, padding: 14, marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.navySoft, marginBottom: 6 }}>Leitura do quadrante</div>
              <div style={{ fontSize: 11.5, color: C.ink }}>
                A regional ocupa {rk(af.rankRegionais)} nos anos finais e {rk(em.rankRegionais)} no ensino médio entre as regionais
                (por IDEB médio, empates na mesma posição). {frac(af.acimaApg)} escola(s) dos anos finais estão igual ou acima da média do grupo APG.
              </div>
            </div>
          </Pagina>

          {/* Página 8 — Prioridades */}
          <Pagina>
            <Secao n="7" kicker="Prioridades e próximos passos" titulo="Transformar o diagnóstico em ação"
              sub="Proposta inicial para discussão com as escolas da regional. Os cenários abaixo não são metas oficiais do Inep." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                ['Nivelar dentro da regional', 'Aproximar as escolas de menor IDEB das de referência da própria regional, compartilhando práticas entre as unidades.'],
                ['Sustentar a aprendizagem', 'Acompanhar Matemática e Língua Portuguesa nas escolas da regional, preservando os avanços e observando a transição entre etapas.'],
                ['Proteger o fluxo', 'Manter a aprovação com evidências de aprendizagem, evitando que o rendimento alto oculte defasagens em parte das escolas.'],
                ['Monitorar comparáveis', 'Revisar a posição da regional no grupo APG e frente às demais regionais a cada nova divulgação, olhando a dispersão interna.'],
              ].map(([t, d], i) => (
                <div key={i} style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.teal, marginBottom: 4 }}>{i + 1}. {t}</div>
                  <div style={{ fontSize: 11, color: C.ink }}>{d}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, marginTop: 22, marginBottom: 10 }}>Cenário interno de evolução</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[af, em].map((e) => (
                <div key={e.etapa} style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16, borderLeft: `4px solid ${e.etapa === 'anos_finais' ? C.teal : C.navySoft}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.gray, textTransform: 'uppercase' }}>{e.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{num(e.cenarioIdeb, 1)}</div>
                  <div style={{ fontSize: 10, color: C.grayL, marginTop: 2 }}>
                    P constante e N {`+${num(INCREMENTO_N_CENARIO, 2)}`} por escola | média atual {num(e.idebAtual, 1)}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: C.grayL, marginTop: 20 }}>
              Metodologia: a nota da regional em cada indicador é a média simples das escolas com valor naquela edição. Rankings entre regionais
              incluem apenas regionais com IDEB médio disponível. O cenário soma {num(INCREMENTO_N_CENARIO, 2)} ao N de cada escola, mantém P e tira a média (IDEB = N × P).
            </div>
          </Pagina>

        </div>
      </div>
    </div>
  );
};

export default IdebRegionalRelatorio;
