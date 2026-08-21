import React, { useState } from 'react';

export interface SerieChart {
  label: string;
  color: string;
  pontos: { ano: string; valor: number | null }[];
}

interface Props {
  series: SerieChart[];
  area?: boolean;       // preenche sob a linha (gráfico de 1 série)
  height?: number;
  dec?: number;         // casas decimais no tooltip (média ENEM = 1)
}

// Domínio "bonito" a partir dos valores (ENEM anda na casa dos ~500, não em 0–10).
const niceDomain = (vals: number[]) => {
  const v = vals.filter((x) => Number.isFinite(x));
  if (!v.length) return { min: 0, max: 100 };
  let min = Math.min(...v), max = Math.max(...v);
  if (min === max) { min -= 10; max += 10; }
  const pad = (max - min) * 0.15;
  min = Math.max(0, Math.floor((min - pad) / 10) * 10);
  max = Math.ceil((max + pad) / 10) * 10;
  return { min, max };
};

// Gráfico de linhas em SVG puro, com guia vertical e tooltip no hover mostrando o
// valor de cada série na edição sob o cursor. Edições sem registro viram lacuna.
const EnemSerieChart: React.FC<Props> = ({ series, area = false, height = 260, dec = 1 }) => {
  const [hover, setHover] = useState<number | null>(null);
  const w = 900, h = height, pad = { t: 18, r: 16, b: 30, l: 44 };
  const anos = series[0]?.pontos.map((p) => p.ano) ?? [];
  const n = anos.length;
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const fmt = (v: number | null | undefined) =>
    v == null || Number.isNaN(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

  const todos = series.flatMap((s) => s.pontos.map((p) => p.valor)).filter((v): v is number => v != null);
  const { min, max } = niceDomain(todos);
  const x = (i: number) => (n <= 1 ? pad.l + iw / 2 : pad.l + (iw * i) / (n - 1));
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * ih;
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);

  const pathOf = (pts: { valor: number | null }[]) => {
    const segs: string[] = [];
    let cur: string[] = [];
    pts.forEach((p, i) => {
      if (p.valor == null) { if (cur.length) { segs.push(cur.join(' ')); cur = []; } }
      else cur.push(`${cur.length ? 'L' : 'M'}${x(i)},${y(p.valor)}`);
    });
    if (cur.length) segs.push(cur.join(' '));
    return segs.join(' ');
  };

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" onMouseLeave={() => setHover(null)}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="#eef2f7" strokeWidth={1} />
          <text x={pad.l - 8} y={y(t)} fontSize={10} fill="#9ca3af" textAnchor="end" dominantBaseline="middle">{Math.round(t)}</text>
        </g>
      ))}
      {anos.map((a, i) => (
        <text key={a} x={x(i)} y={h - pad.b + 16} fontSize={10} fill="#6b7280" textAnchor="middle">{a}</text>
      ))}

      {hover != null && (
        <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={h - pad.b} stroke="#a7f3d0" strokeWidth={1} strokeDasharray="3 3" />
      )}

      {series.map((s) => (
        <g key={s.label}>
          {area && (
            <path d={`${pathOf(s.pontos)} L${x(n - 1)},${y(min)} L${x(0)},${y(min)} Z`} fill={s.color} fillOpacity={0.12} stroke="none" />
          )}
          <path d={pathOf(s.pontos)} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" />
          {s.pontos.map((p, i) =>
            p.valor == null ? null : (
              <circle key={i} cx={x(i)} cy={y(p.valor)} r={hover === i ? 4.5 : 3} fill="#fff" stroke={s.color} strokeWidth={2} />
            )
          )}
        </g>
      ))}

      {anos.map((a, i) => (
        <rect key={a} x={x(i) - (n > 1 ? iw / (n - 1) : iw) / 2} y={pad.t}
          width={n > 1 ? iw / (n - 1) : iw} height={ih} fill="transparent"
          onMouseEnter={() => setHover(i)} />
      ))}

      {hover != null && (() => {
        const linhas = series.map((s) => ({ label: s.label, color: s.color, v: s.pontos[hover]?.valor ?? null }));
        const boxW = 150, lineH = 16, boxH = 20 + linhas.length * lineH;
        let bx = x(hover) + 10;
        if (bx + boxW > w - pad.r) bx = x(hover) - boxW - 10;
        const by = pad.t + 6;
        return (
          <g pointerEvents="none">
            <rect x={bx} y={by} width={boxW} height={boxH} rx={6} fill="#111827" fillOpacity={0.92} />
            <text x={bx + 10} y={by + 15} fontSize={11} fill="#fff" fontWeight={600}>Edição {anos[hover]}</text>
            {linhas.map((l, k) => (
              <g key={l.label}>
                <circle cx={bx + 14} cy={by + 20 + k * lineH + 6} r={3.5} fill={l.color} />
                <text x={bx + 24} y={by + 20 + k * lineH + 9} fontSize={10.5} fill="#e5e7eb">{l.label}</text>
                <text x={bx + boxW - 10} y={by + 20 + k * lineH + 9} fontSize={10.5} fill="#fff" fontWeight={600} textAnchor="end">{fmt(l.v)}</text>
              </g>
            ))}
          </g>
        );
      })()}
    </svg>
  );
};

export default EnemSerieChart;
