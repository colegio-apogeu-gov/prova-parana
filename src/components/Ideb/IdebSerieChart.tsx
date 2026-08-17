import React, { useState } from 'react';

export interface SerieChart {
  label: string;
  color: string;
  pontos: { ano: string; valor: number | null }[];
}

interface Props {
  series: SerieChart[];
  domainMax?: number;   // IDEB vai de 0 a 10
  area?: boolean;       // preenche sob a linha (usado no gráfico de 1 série)
  height?: number;
}

const fmt = (v: number | null | undefined) =>
  v == null || Number.isNaN(v) ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Gráfico de linhas em SVG puro, com guia vertical e tooltip ao passar o mouse
// mostrando o valor de cada série na edição sob o cursor. Edições sem registro
// viram lacuna (a linha "pula" o ponto nulo).
const IdebSerieChart: React.FC<Props> = ({ series, domainMax = 10, area = false, height = 280 }) => {
  const [hover, setHover] = useState<number | null>(null);
  const w = 900, h = height, pad = { t: 18, r: 16, b: 30, l: 34 };
  const anos = series[0]?.pontos.map((p) => p.ano) ?? [];
  const n = anos.length;
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const x = (i: number) => (n <= 1 ? pad.l + iw / 2 : pad.l + (iw * i) / (n - 1));
  const y = (v: number) => pad.t + (1 - v / domainMax) * ih;
  const ticks = [0, 2, 4, 6, 8, 10].filter((t) => t <= domainMax);

  // Caminho da linha ignorando lacunas (quebra em segmentos contínuos).
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
      {/* grades + eixo Y */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="#eef2f7" strokeWidth={1} />
          <text x={pad.l - 8} y={y(t)} fontSize={10} fill="#9ca3af" textAnchor="end" dominantBaseline="middle">{t}</text>
        </g>
      ))}
      {/* rótulos X */}
      {anos.map((a, i) => (
        <text key={a} x={x(i)} y={h - pad.b + 16} fontSize={10} fill="#6b7280" textAnchor="middle">{a}</text>
      ))}

      {/* guia vertical do hover */}
      {hover != null && (
        <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={h - pad.b} stroke="#c4b5fd" strokeWidth={1} strokeDasharray="3 3" />
      )}

      {/* áreas/linhas */}
      {series.map((s) => (
        <g key={s.label}>
          {area && (
            <path
              d={`${pathOf(s.pontos)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`}
              fill={s.color} fillOpacity={0.12} stroke="none"
            />
          )}
          <path d={pathOf(s.pontos)} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" />
          {s.pontos.map((p, i) =>
            p.valor == null ? null : (
              <circle key={i} cx={x(i)} cy={y(p.valor)} r={hover === i ? 4.5 : 3}
                fill="#fff" stroke={s.color} strokeWidth={2} />
            )
          )}
        </g>
      ))}

      {/* colunas invisíveis p/ capturar o hover */}
      {anos.map((a, i) => (
        <rect key={a} x={x(i) - (n > 1 ? iw / (n - 1) : iw) / 2} y={pad.t}
          width={n > 1 ? iw / (n - 1) : iw} height={ih} fill="transparent"
          onMouseEnter={() => setHover(i)} />
      ))}

      {/* tooltip */}
      {hover != null && (() => {
        const linhas = series.map((s) => ({ label: s.label, color: s.color, v: s.pontos[hover]?.valor ?? null }));
        const boxW = 132, lineH = 16, boxH = 20 + linhas.length * lineH;
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

export default IdebSerieChart;
