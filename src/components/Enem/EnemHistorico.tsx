import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Building2, TrendingUp, Users, PenLine, Search, X } from 'lucide-react';
import { EnemResultado, EnemArea } from '../../types';
import { areaValue, mediaPonderada } from '../../lib/enem';

interface EnemHistoricoProps {
  data: EnemResultado[]; // todas as edições (todas as escolas públicas)
}

const fmt = (v: number | null | undefined, dec = 1) =>
  v == null || Number.isNaN(v) ? '--' : v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtInt = (v: number) => (v || 0).toLocaleString('pt-BR');

// Busca sem acento / caixa (ex.: "sao jose" acha "São José").
const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Disciplinas (sem Redação — ela tem gráfico próprio e escala bem diferente).
const DISCIPLINAS: { key: EnemArea; label: string }[] = [
  { key: 'lc', label: 'Linguagens' },
  { key: 'ch', label: 'Humanas' },
  { key: 'cn', label: 'Natureza' },
  { key: 'mt', label: 'Matemática' },
];

// Cores por ano (mesma ideia do protótipo).
const YEAR_COLORS = ['#8b5cf6', '#3b82f6', '#ec4899', '#ef4444', '#f59e0b', '#10b981'];
const yearColor = (i: number) => YEAR_COLORS[i % YEAR_COLORS.length];

// ---------- helpers de eixo ----------
const niceDomain = (vals: number[], padPct = 0.12) => {
  const v = vals.filter((x) => Number.isFinite(x));
  if (!v.length) return { min: 0, max: 100 };
  let min = Math.min(...v), max = Math.max(...v);
  if (min === max) { min -= 10; max += 10; }
  const pad = (max - min) * padPct;
  min = Math.max(0, Math.floor((min - pad) / 10) * 10);
  max = Math.ceil((max + pad) / 10) * 10;
  return { min, max };
};
const ticks = (min: number, max: number, n = 4) =>
  Array.from({ length: n + 1 }, (_, i) => min + ((max - min) * i) / n);

const Axes: React.FC<{
  w: number; h: number; pad: { t: number; r: number; b: number; l: number };
  min: number; max: number; xLabels: string[];
}> = ({ w, h, pad, min, max, xLabels }) => {
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * ih;
  return (
    <>
      {ticks(min, max).map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} strokeDasharray="3 3" />
          <text x={pad.l - 8} y={y(t)} fontSize={10} fill="#9ca3af" textAnchor="end" dominantBaseline="middle">{Math.round(t)}</text>
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
        <p className="text-xs text-emerald-700">{subtitle}</p>
      </div>
      <span className="text-emerald-500">{icon}</span>
    </div>
    {children}
  </div>
);

const EnemHistorico: React.FC<EnemHistoricoProps> = ({ data }) => {
  // "" = grupo Apogeu (agregado); senão o INEP da escola (do grupo ou não).
  const [escolaSel, setEscolaSel] = useState('');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  // Fecha o combo ao clicar fora.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const anos = useMemo(
    () => Array.from(new Set(data.map((r) => r.ano))).sort((a, b) => a.localeCompare(b)),
    [data]
  );

  // Todas as escolas da base (distintas por INEP, dados da edição mais recente).
  const escolas = useMemo(() => {
    const m = new Map<string, { inep: string; escola: string; cidade: string; apg: boolean }>();
    data.slice().sort((a, b) => a.ano.localeCompare(b.ano))
      .forEach((r) => {
        if (r.inep_codigo) m.set(r.inep_codigo, { inep: r.inep_codigo, escola: r.escola, cidade: r.cidade, apg: !!r.is_apogeu });
      });
    // Escolas do grupo primeiro, depois alfabética.
    return Array.from(m.values()).sort((a, b) =>
      a.apg === b.apg ? a.escola.localeCompare(b.escola) : a.apg ? -1 : 1
    );
  }, [data]);

  const escolasFiltradas = useMemo(() => {
    const q = norm(busca);
    if (!q) return escolas;
    return escolas.filter((e) => norm(e.escola).includes(q) || norm(e.cidade).includes(q));
  }, [escolas, busca]);

  const escolaAtual = escolaSel ? escolas.find((e) => e.inep === escolaSel) : null;
  const escolaLabel = escolaSel ? (escolaAtual?.escola ?? '--') : 'Grupo Apogeu';

  // Linhas do recorte selecionado, por ano.
  const rowsOf = (ano: string): EnemResultado[] => {
    const doAno = data.filter((r) => r.ano === ano);
    return escolaSel ? doAno.filter((r) => r.inep_codigo === escolaSel) : doAno.filter((r) => r.is_apogeu);
  };
  // Referência: todas as escolas públicas do PR na base.
  const rowsPR = (ano: string) => data.filter((r) => r.ano === ano);

  const serie = useMemo(() => anos.map((ano) => {
    const rows = rowsOf(ano);
    return {
      ano,
      media: mediaPonderada(rows, 'media'),
      prMedia: mediaPonderada(rowsPR(ano), 'media'),
      participantes: rows.reduce((s, r) => s + (r.alunos || 0), 0),
      areas: Object.fromEntries(DISCIPLINAS.map((d) => [d.key, mediaPonderada(rows, d.key)])) as Record<string, number | null>,
      rd: mediaPonderada(rows, 'rd'),
      escolas: rows.length,
    };
  }), [data, anos, escolaSel]);

  const semDados = serie.every((s) => s.media == null);

  // ---------- 1) Evolução das médias ----------
  const LineMedias = () => {
    const w = 900, h = 260, pad = { t: 16, r: 16, b: 30, l: 44 };
    const vals = serie.flatMap((s) => [s.media, s.prMedia]).filter((v): v is number => v != null);
    const { min, max } = niceDomain(vals);
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const step = iw / serie.length;
    const x = (i: number) => pad.l + step * i + step / 2;
    const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * ih;
    const path = (get: (s: typeof serie[number]) => number | null) =>
      serie.map((s, i) => { const v = get(s); return v == null ? null : `${x(i)},${y(v)}`; })
        .filter(Boolean).join(' ');
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <Axes w={w} h={h} pad={pad} min={min} max={max} xLabels={serie.map((s) => s.ano)} />
        <polyline points={path((s) => s.prMedia)} fill="none" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 4" />
        <polyline points={path((s) => s.media)} fill="none" stroke="#10b981" strokeWidth={3} />
        {serie.map((s, i) => s.media != null && (
          <g key={s.ano}>
            {/* Alvo de hover generoso: o ponto visível (r=4.5) é pequeno demais para o mouse. */}
            <circle cx={x(i)} cy={y(s.media)} r={14} fill="transparent" />
            <circle cx={x(i)} cy={y(s.media)} r={4.5} fill="#fff" stroke="#10b981" strokeWidth={2.5} />
            <title>
              {`${s.ano} · ${escolaLabel}: ${fmt(s.media)}`}
              {s.prMedia != null ? ` | Média PR (todas): ${fmt(s.prMedia)} (${s.media >= s.prMedia ? '+' : ''}${fmt(s.media - s.prMedia)})` : ''}
            </title>
          </g>
        ))}
        {serie.map((s, i) => s.media != null && (
          <text key={`l${s.ano}`} x={x(i)} y={y(s.media) - 12} fontSize={11} fill="#065f46" textAnchor="middle" fontWeight={600}>
            {fmt(s.media)}
          </text>
        ))}
      </svg>
    );
  };

  // ---------- 2) Participantes ----------
  const BarParticipantes = () => {
    const w = 900, h = 240, pad = { t: 16, r: 16, b: 30, l: 44 };
    const { min, max } = niceDomain([0, ...serie.map((s) => s.participantes)], 0.1);
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const step = iw / serie.length;
    const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * ih;
    const bw = Math.min(90, step * 0.5);
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <Axes w={w} h={h} pad={pad} min={min} max={max} xLabels={serie.map((s) => s.ano)} />
        {serie.map((s, i) => {
          const cx = pad.l + step * i + step / 2;
          return (
            <g key={s.ano}>
              <rect x={cx - bw / 2} y={y(s.participantes)} width={bw} height={Math.max(0, h - pad.b - y(s.participantes))} fill="#10b981" rx={3} />
              <text x={cx} y={y(s.participantes) - 6} fontSize={11} fill="#065f46" textAnchor="middle" fontWeight={600}>{fmtInt(s.participantes)}</text>
              <title>{`${s.ano}: ${fmtInt(s.participantes)} participantes em ${s.escolas} escola(s)`}</title>
            </g>
          );
        })}
      </svg>
    );
  };

  // ---------- 3) Áreas de conhecimento (sem redação) ----------
  const GroupedAreas = () => {
    const w = 900, h = 260, pad = { t: 16, r: 16, b: 30, l: 44 };
    const vals = serie.flatMap((s) => DISCIPLINAS.map((d) => s.areas[d.key])).filter((v): v is number => v != null);
    const { min, max } = niceDomain([0, ...vals], 0.05);
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const gstep = iw / DISCIPLINAS.length;
    const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * ih;
    const bw = Math.min(34, (gstep * 0.62) / Math.max(1, serie.length));
    // Com muitas edições as barras estreitam e os rótulos passariam a se sobrepor;
    // abaixo desse ponto fica só o tooltip.
    const mostrarRotulos = bw >= 24;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <Axes w={w} h={h} pad={pad} min={min} max={max} xLabels={DISCIPLINAS.map((d) => d.label)} />
        {DISCIPLINAS.map((d, gi) => {
          const gx = pad.l + gstep * gi + gstep / 2;
          const total = serie.length;
          return serie.map((s, si) => {
            const v = s.areas[d.key];
            if (v == null) return null;
            const bx = gx - (total * bw) / 2 + si * bw + bw * 0.1;
            return (
              <g key={`${d.key}-${s.ano}`}>
                <rect x={bx} y={y(v)} width={bw * 0.8}
                  height={Math.max(0, h - pad.b - y(v))} fill={yearColor(si)} rx={2} />
                {/* Fonte menor que a dos outros gráficos: a barra agrupada é estreita. */}
                {mostrarRotulos && (
                  <text x={bx + bw * 0.4} y={y(v) - 5} fontSize={9} fill="#4b5563" textAnchor="middle" fontWeight={600}>
                    {fmt(v)}
                  </text>
                )}
                <title>{`${d.label} · ${s.ano}: ${fmt(v)}`}</title>
              </g>
            );
          });
        })}
      </svg>
    );
  };

  // ---------- 4) Redação ----------
  const BarRedacao = () => {
    const w = 900, h = 240, pad = { t: 16, r: 16, b: 30, l: 44 };
    const vals = serie.map((s) => s.rd).filter((v): v is number => v != null);
    const { min, max } = niceDomain([0, ...vals], 0.05);
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const step = iw / serie.length;
    const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * ih;
    const bw = Math.min(90, step * 0.5);
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <Axes w={w} h={h} pad={pad} min={min} max={max} xLabels={serie.map((s) => s.ano)} />
        {serie.map((s, i) => {
          if (s.rd == null) return null;
          const cx = pad.l + step * i + step / 2;
          return (
            <g key={s.ano}>
              <rect x={cx - bw / 2} y={y(s.rd)} width={bw} height={Math.max(0, h - pad.b - y(s.rd))} fill={yearColor(i)} rx={3} />
              <text x={cx} y={y(s.rd) - 6} fontSize={11} fill="#374151" textAnchor="middle" fontWeight={600}>{fmt(s.rd)}</text>
              <title>{`Redação ${s.ano}: ${fmt(s.rd)}`}</title>
            </g>
          );
        })}
      </svg>
    );
  };

  const Legend = ({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) => (
    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500 mt-1">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5" style={{ background: it.dashed ? 'none' : it.color, borderTop: it.dashed ? `2px dashed ${it.color}` : undefined }} />
          {it.label}
        </span>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Filtro de escola (grupo Apogeu ou qualquer pública do PR na base) */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Escola:</span>
        </div>

        <div ref={comboRef} className="relative min-w-[280px]">
          <button
            type="button"
            onClick={() => { setAberto((v) => !v); setBusca(''); }}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-left hover:bg-gray-50 focus:ring-2 focus:ring-emerald-500"
          >
            <span className="truncate">
              {escolaSel ? escolaLabel : 'Grupo Apogeu (todas)'}
              {escolaAtual && (
                <span className="text-gray-400 font-normal"> · {escolaAtual.cidade}</span>
              )}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {escolaAtual && !escolaAtual.apg && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">fora do grupo</span>
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
                  className="w-full pl-8 pr-7 py-1.5 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-emerald-500"
                />
                {busca && (
                  <button onClick={() => setBusca('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                <button
                  onClick={() => { setEscolaSel(''); setAberto(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${!escolaSel ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700'}`}
                >
                  Grupo Apogeu (todas)
                </button>
                {escolasFiltradas.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-gray-400 text-center">Nenhuma escola encontrada.</p>
                ) : escolasFiltradas.slice(0, 80).map((e) => (
                  <button
                    key={e.inep}
                    onClick={() => { setEscolaSel(e.inep); setAberto(false); }}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${escolaSel === e.inep ? 'bg-emerald-50' : ''}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`text-sm truncate ${escolaSel === e.inep ? 'text-emerald-700 font-medium' : 'text-gray-700'}`}>{e.escola}</span>
                      {e.apg && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">APG</span>}
                    </span>
                    <span className="text-xs text-gray-400">{e.cidade}/PR</span>
                  </button>
                ))}
              </div>
              <p className="px-3 py-1.5 text-[11px] text-gray-400 border-t border-gray-100">
                {escolasFiltradas.length > 80 ? `mostrando 80 de ${escolasFiltradas.length} — refine a busca` : `${escolasFiltradas.length} de ${escolas.length} escolas na base`}
              </p>
            </div>
          )}
        </div>

        <span className="text-xs text-emerald-700">
          {anos.length ? `Evolução histórica de ${anos[0]} a ${anos[anos.length - 1]}` : 'Sem edições na base'}
        </span>
      </div>

      {semDados ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-500">
          Nenhum dado para o recorte selecionado.
        </div>
      ) : (
        <>
          {/* 1º Média */}
          <Card title="Evolução das médias" subtitle={`${escolaLabel} · média geral ENEM`} icon={<TrendingUp className="w-5 h-5" />}>
            <LineMedias />
            <Legend items={[{ color: '#10b981', label: escolaSel ? 'Escola' : 'Grupo Apogeu' }, { color: '#9ca3af', label: 'Média PR (todas as escolas)', dashed: true }]} />
          </Card>

          {/* 2º Participantes */}
          <Card title="Histórico de participantes" subtitle={`${escolaLabel} · total de inscritos por ano`} icon={<Users className="w-5 h-5" />}>
            <BarParticipantes />
            <Legend items={[{ color: '#10b981', label: 'Participantes' }]} />
          </Card>

          {/* 3º Disciplinas */}
          <Card title="Comparativo por Área de Conhecimento" subtitle={`${escolaLabel} · média por área e ano`} icon={<TrendingUp className="w-5 h-5" />}>
            <GroupedAreas />
            <Legend items={serie.map((s, i) => ({ color: yearColor(i), label: s.ano }))} />
          </Card>

          {/* 4º Redação */}
          <Card title="Redação" subtitle={`${escolaLabel} · média da redação por ano`} icon={<PenLine className="w-5 h-5" />}>
            <BarRedacao />
            <Legend items={serie.map((s, i) => ({ color: yearColor(i), label: s.ano }))} />
          </Card>

          {/* Tabela-resumo */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-700">
                    <th className="px-4 py-2.5 text-left font-semibold">Ano</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Média geral</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Média PR (todas)</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Participantes</th>
                    {DISCIPLINAS.map((d) => <th key={d.key} className="px-4 py-2.5 text-center font-semibold">{d.label}</th>)}
                    <th className="px-4 py-2.5 text-center font-semibold">Redação</th>
                  </tr>
                </thead>
                <tbody>
                  {serie.map((s) => (
                    <tr key={s.ano} className="border-b border-gray-100">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{s.ano}</td>
                      <td className="px-4 py-2.5 text-center font-semibold text-emerald-700">{fmt(s.media)}</td>
                      <td className="px-4 py-2.5 text-center text-gray-500">{fmt(s.prMedia)}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{fmtInt(s.participantes)}</td>
                      {DISCIPLINAS.map((d) => <td key={d.key} className="px-4 py-2.5 text-center text-gray-700">{fmt(s.areas[d.key])}</td>)}
                      <td className="px-4 py-2.5 text-center text-gray-700">{fmt(s.rd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EnemHistorico;
