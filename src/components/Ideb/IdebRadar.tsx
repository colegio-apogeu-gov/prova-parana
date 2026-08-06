import React, { useMemo } from 'react';
import { IdebResultado } from '../../types';
import { IDEB_RADAR, indicadorValue, fmtIndicador, mediaSimples } from '../../lib/ideb';

interface IdebRadarProps {
  escola: IdebResultado;
  referencia: IdebResultado[]; // escolas do recorte, para a média e a escala de cada eixo
  refLabel: string;
  accent: string;
}

/*
  Radar do IDEB. Diferente do ENEM (5 provas na mesma escala 0–1000), aqui cada
  eixo tem unidade própria — IDEB de 0 a 10, SAEB em torno de 250, Fluxo de 0 a 1.
  Por isso a normalização é POR EIXO: o raio de cada ponta é a posição do valor
  entre o mínimo e o máximo daquele indicador no recorte. O que o desenho mostra é
  a posição relativa da escola, e os números crus ficam na lista abaixo do gráfico.
*/
const IdebRadar: React.FC<IdebRadarProps> = ({ escola, referencia, refLabel, accent }) => {
  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 52;
  const N = IDEB_RADAR.length;

  // Domínio de cada eixo a partir do recorte (com folga de 8% para o polígono não colar na borda).
  const eixos = useMemo(() => IDEB_RADAR.map((a) => {
    const vals = referencia
      .map((r) => indicadorValue(r, a.key))
      .filter((v): v is number => v != null);
    const daEscola = indicadorValue(escola, a.key);
    if (daEscola != null) vals.push(daEscola);
    if (!vals.length) return { ...a, min: 0, max: 1 };
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    if (min === max) { min = min * 0.9; max = max * 1.1 || 1; }
    const pad = (max - min) * 0.08;
    return { ...a, min: Math.max(0, min - pad), max: max + pad };
  }), [referencia, escola]);

  const media = useMemo(
    () => IDEB_RADAR.map((a) => mediaSimples(referencia, a.key)),
    [referencia]
  );

  const ang = (i: number) => (-90 + i * (360 / N)) * (Math.PI / 180);
  const at = (val: number | null, i: number): [number, number] => {
    const { min, max } = eixos[i];
    const t = val == null ? 0 : Math.max(0, Math.min(1, (val - min) / (max - min || 1)));
    const r = t * R;
    return [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  };
  const poly = (vals: (number | null)[]) => vals.map((v, i) => at(v, i).join(',')).join(' ');
  const rings = [0.25, 0.5, 0.75, 1];

  const valoresEscola = IDEB_RADAR.map((a) => indicadorValue(escola, a.key));

  return (
    <>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[300px] mx-auto">
        {rings.map((rr, ri) => (
          <polygon
            key={ri}
            points={IDEB_RADAR.map((_, i) => {
              const r = rr * R;
              return [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))].join(',');
            }).join(' ')}
            fill="none" stroke="#e5e7eb" strokeWidth={1}
          />
        ))}
        {IDEB_RADAR.map((_, i) => {
          const r = R;
          return (
            <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(ang(i))} y2={cy + r * Math.sin(ang(i))} stroke="#e5e7eb" strokeWidth={1} />
          );
        })}
        <polygon points={poly(media)} fill="none" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="4 3" />
        <polygon points={poly(valoresEscola)} fill={accent} fillOpacity={0.24} stroke={accent} strokeWidth={2} />
        {valoresEscola.map((v, i) => {
          const [x, y] = at(v, i);
          return <circle key={i} cx={x} cy={y} r={2.5} fill={accent} />;
        })}
        {IDEB_RADAR.map((a, i) => {
          const r = R;
          const x = cx + r * Math.cos(ang(i));
          const y = cy + r * Math.sin(ang(i));
          const lx = cx + (x - cx) * 1.22;
          const ly = cy + (y - cy) * 1.22;
          return (
            <text key={a.key} x={lx} y={ly} fontSize={11} fill="#374151" textAnchor="middle" dominantBaseline="middle">
              {a.label}
            </text>
          );
        })}
      </svg>

      <div className="flex items-center justify-center gap-5 text-xs text-gray-500 mt-1 mb-3">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent }} /> Escola</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> {refLabel}</span>
      </div>
      <p className="text-[11px] text-gray-400 text-center mb-3">
        Cada eixo tem escala própria (IDEB, SAEB e Fluxo têm unidades diferentes) — a área mostra a posição relativa no recorte.
      </p>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm border-t border-gray-100 pt-3">
        {IDEB_RADAR.map((a, i) => {
          const v = valoresEscola[i];
          const ref = media[i];
          const diff = v != null && ref != null ? v - ref : null;
          return (
            <div key={a.key} className="flex items-center justify-between">
              <span className="text-gray-600">{a.label}</span>
              <span className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-900">{fmtIndicador(v, a.key)}</span>
                {diff != null && (
                  <span className={`text-[10px] ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {diff >= 0 ? '▲' : '▼'}{fmtIndicador(Math.abs(diff), a.key)}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 mt-2 pt-2">
        <span className="text-sm font-semibold text-gray-700">
          Meta do INEP {escola.meta != null ? `(${fmtIndicador(escola.meta, 'ideb')})` : ''}
        </span>
        <span className="text-lg font-bold" style={{ color: accent }}>
          {escola.meta != null && escola.ideb != null
            ? `${escola.ideb >= escola.meta ? 'atingida' : 'não atingida'}`
            : 'sem projeção'}
        </span>
      </div>
    </>
  );
};

export default IdebRadar;
