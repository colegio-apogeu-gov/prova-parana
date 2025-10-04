import React from 'react';

interface ProficiencyGaugeProps {
  value: number;        // 0–100
  color: string;        // cor do texto do valor
  size?: number;        // largura do SVG (px). Default 300
  height?: number;      // altura do SVG (px). Se omitir, usa metade do círculo: radius + strokeWidth
  strokeWidth?: number; // espessura do arco. Default 16
}

const ProficiencyGauge: React.FC<ProficiencyGaugeProps> = ({
  value,
  color,
  size = 300,
  height,
  strokeWidth = 16,
}) => {
  const v = Math.min(Math.max(value, 0), 100);

  // Se height foi informado, o radius é limitado por ela; caso contrário, derive a altura ideal.
  const baseRadius = (size - strokeWidth) / 2;
  const resolvedHeight = height ?? baseRadius + strokeWidth;
  const radius = Math.min(baseRadius, resolvedHeight - strokeWidth);

  const centerX = size / 2;
  const centerY = resolvedHeight - strokeWidth / 2; // centro na base do SVG

  // 0% -> 180° (esq), 100% -> 0° (dir)
  const angleDeg = 180 - (v / 100) * 180;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const polar = (r: number, deg: number) => {
    const rad = toRad(deg);
    return {
      x: centerX + r * Math.cos(rad),
      y: centerY - r * Math.sin(rad), // y do SVG cresce p/ baixo
    };
  };

  // Arcos (semicírculo superior), varrendo no sentido horário
  const arc = (startDeg: number, endDeg: number) => {
    const start = polar(radius, startDeg);
    const end = polar(radius, endDeg);
    const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    const sweep = 1; // <- CORREÇÃO: força arco pelo topo
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
  };

  // Segmentos: esquerda, meio, direita
  const redPath = arc(180, 150);
  const yellowPath = arc(150, 30);
  const greenPath = arc(30, 0);

  // Ponteiro
  const needleLen = radius * 0.82;
  const needleEnd = polar(needleLen, angleDeg);

  return (
    <div className="flex items-center justify-center" style={{ height: resolvedHeight }}>
      <svg width={size} height={resolvedHeight} viewBox={`0 0 ${size} ${resolvedHeight}`}>
        {/* Arcos coloridos */}
        <path d={redPath} fill="none" stroke="#ef4444" strokeWidth={strokeWidth} strokeLinecap="round" />
        <path d={yellowPath} fill="none" stroke="#f59e0b" strokeWidth={strokeWidth} strokeLinecap="round" />
        <path d={greenPath} fill="none" stroke="#10b981" strokeWidth={strokeWidth} strokeLinecap="round" />

        {/* Ponteiro */}
        <line
          x1={centerX}
          y1={centerY}
          x2={needleEnd.x}
          y2={needleEnd.y}
          stroke="#374151"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={centerX} cy={centerY} r={4} fill="#374151" />

        {/* Texto central */}
        <text
          x={centerX}
          y={centerY - radius * 0.55}
          textAnchor="middle"
          fontSize="28"
          fontWeight={700}
          fill={color}
        >
          {v.toFixed(1)}%
        </text>
        <text
          x={centerX}
          y={centerY - radius * 0.38}
          textAnchor="middle"
          fontSize="11"
          fill="#6b7280"
        >
          Proficiência
        </text>
      </svg>
    </div>
  );
};

export default ProficiencyGauge;
