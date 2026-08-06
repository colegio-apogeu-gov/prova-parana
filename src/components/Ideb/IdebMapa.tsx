import React from 'react';
import { IdebIndicador } from '../../types';
import { CITY_COORDS, PR_BOUNDS, APG_BLUE, fmtIndicador } from '../../lib/ideb';

export interface CidadeMapa {
  cidade: string;
  count: number;
  media: number | null;
  apg: boolean;
}

interface IdebMapaProps {
  cidades: CidadeMapa[];
  grupoColor: string;
  selected: string;
  onSelect: (c: string) => void;
  indicador: IdebIndicador;
}

/*
  Mapa geográfico do Paraná (mesma projeção do Consolidado do ENEM). As escolas do
  IDEB são as mesmas dos grupos parceiros, então CITY_COORDS já cobre todas as
  cidades — por isso aqui não existe o mapa esquemático de 6 pontos do ENEM.
*/
const IdebMapa: React.FC<IdebMapaProps> = ({ cidades, grupoColor, selected, onSelect, indicador }) => {
  const W = 100;
  const H = 66;
  const { north, south, west, east } = PR_BOUNDS;
  const proj = (lat: number, lon: number): [number, number] => [
    ((lon - west) / (east - west)) * (W - 8) + 4,
    ((north - lat) / (north - south)) * (H - 8) + 4,
  ];
  const posicionadas = cidades.filter((c) => CITY_COORDS[c.cidade]);
  const semCoord = cidades.length - posicionadas.length;
  const maxCount = Math.max(1, ...cidades.map((c) => c.count));

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
        <defs>
          <radialGradient id="idebmapbg" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f5f3ff" />
          </radialGradient>
        </defs>
        <rect x="1.5" y="1.5" width={W - 3} height={H - 3} rx="4" fill="url(#idebmapbg)" stroke="#ddd6fe" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
        {posicionadas.map((c) => {
          const [lat, lon] = CITY_COORDS[c.cidade];
          const [x, y] = proj(lat, lon);
          const r = 1.4 + (c.count / maxCount) * 2.8;
          const isSel = c.cidade === selected;
          const fill = c.apg ? APG_BLUE : grupoColor;
          return (
            <g key={c.cidade} onClick={() => onSelect(c.cidade)} style={{ cursor: 'pointer' }}>
              {isSel && <circle cx={x} cy={y} r={r + 1.8} fill={fill} opacity={0.18} />}
              <circle
                cx={x} cy={y} r={r} fill={fill} fillOpacity={c.apg ? 0.85 : 0.6}
                stroke={c.apg ? APG_BLUE : '#ffffff'} strokeWidth={c.apg ? 0.8 : 0.4}
              />
              {isSel && <text x={x + r + 0.8} y={y + 1} fontSize={2.6} fontWeight={700} fill="#4c1d95">{c.cidade}</text>}
              <title>
                {`${c.cidade}: ${c.count} escola(s)${c.media != null ? ` · média ${fmtIndicador(c.media, indicador)}` : ''}`}
              </title>
            </g>
          );
        })}
      </svg>
      {semCoord > 0 && (
        <p className="text-[11px] text-gray-400 px-3 pb-2">
          {semCoord} cidade(s) sem posição no mapa — veja na lista ao lado.
        </p>
      )}
    </>
  );
};

export default IdebMapa;
