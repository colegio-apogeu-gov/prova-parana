import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import type { BaseResultado, buildAlunoComparativos } from '../../types';
import { buildAlunoComparativos as build } from '../../types';

type Props<T extends BaseResultado> = {
  data: T[];
};

function BadgeTrend({ t }: { t: 'up' | 'down' | 'flat' | 'n/a' }) {
  if (t === 'up') return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded"><TrendingUp className="w-3 h-3" />↑</span>;
  if (t === 'down') return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded"><TrendingDown className="w-3 h-3" />↓</span>;
  if (t === 'flat') return <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded"><Minus className="w-3 h-3" />=</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">n/a</span>;
}

function pctFmt(v: number | null, digits = 1) {
  return v === null ? '—' : `${v.toFixed(digits)}%`;
}

function sideColor(trend: 'up' | 'down' | 'flat' | 'n/a', side: 'left' | 'right') {
  // Regra: se melhorou no 2º semestre => direita verde e esquerda vermelha.
  // Se piorou => direita vermelha e esquerda verde. Igual => neutro para ambos.
  if (trend === 'up') return side === 'right' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200';
  if (trend === 'down') return side === 'right' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
}

export default function ComparativoSemestralCards<T extends BaseResultado>({ data }: Props<T>) {
  const comparativos = useMemo(() => build<T>(data), [data]);
  const [openAluno, setOpenAluno] = useState<Record<string, boolean>>({});
  const [openComp, setOpenComp] = useState<Record<string, boolean>>({});

  if (!data?.length) {
    return (
      <div className="border border-dashed border-gray-300 rounded-lg p-6 text-gray-600 text-sm">
        Nenhum dado para comparar. Ajuste os filtros.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comparativos.map((alunoComp) => {
        const isOpen = !!openAluno[alunoComp.aluno];
        return (
          <div key={alunoComp.aluno} className="border rounded-xl overflow-hidden bg-white shadow-sm">
            {/* Header do card do Aluno */}
            <button
              className="w-full flex items-center justify-between px-4 md:px-6 py-4 hover:bg-gray-50"
              onClick={() => setOpenAluno(s => ({ ...s, [alunoComp.aluno]: !s[alunoComp.aluno] }))}
            >
              <div className="flex items-center gap-3">
                {isOpen ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                <div className="flex flex-col">
                  <span className="text-base md:text-lg font-semibold text-gray-900">{alunoComp.aluno} – Comparativo (1º x 2º)</span>
                  <span className="text-xs text-gray-500">Saldo geral: <strong>{pctFmt(alunoComp.deltaGeral)}</strong></span>
                </div>
              </div>
              <BadgeTrend t={alunoComp.trendGeral} />
            </button>

            {/* Painel expandido: Componentes */}
            {isOpen && (
              <div className="border-t divide-y">
                {alunoComp.componentes.map((c) => {
                  const compKey = `${alunoComp.aluno}::${c.componente}`;
                  const compOpen = !!openComp[compKey];

                  const leftCls = `flex-1 border rounded-lg px-3 py-2 text-center ${sideColor(c.trendGeral, 'left')}`;
                  const rightCls = `flex-1 border rounded-lg px-3 py-2 text-center ${sideColor(c.trendGeral, 'right')}`;

                  return (
                    <div key={compKey} className="p-4 md:p-6">
                      {/* Resumo do componente */}
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-indigo-600" />
                          <span className="font-medium text-gray-900">
                            {c.componente === 'MT' ? 'Matemática (MT)' : 'Português (LP)'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto md:min-w-[340px]">
                          <div className={leftCls}>
                            <div className="text-xs uppercase tracking-wide">1º semestre</div>
                            <div className="text-sm font-semibold">{pctFmt(c.mediaS1)}</div>
                          </div>
                          <div className="text-center min-w-[70px]">
                            <div className="text-xs text-gray-500">Δ</div>
                            <div className="text-sm font-semibold">{pctFmt(c.deltaGeral)}</div>
                            <div className="mt-1"><BadgeTrend t={c.trendGeral} /></div>
                          </div>
                          <div className={rightCls}>
                            <div className="text-xs uppercase tracking-wide">2º semestre</div>
                            <div className="text-sm font-semibold">{pctFmt(c.mediaS2)}</div>
                          </div>
                        </div>

                        <button
                          className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline"
                          onClick={() => setOpenComp(s => ({ ...s, [compKey]: !s[compKey] }))}
                        >
                          {compOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          Ver habilidades
                        </button>
                      </div>

                      {/* Lista de habilidades com match S1 x S2 */}
                      {compOpen && (
                        <div className="mt-3 overflow-x-auto">
                          <table className="min-w-[720px] w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr className="text-left text-gray-600">
                                <th className="px-3 py-2 font-medium">Habilidade</th>
                                <th className="px-3 py-2 font-medium">Descrição</th>
                                <th className="px-3 py-2 font-medium">1º Sem.</th>
                                <th className="px-3 py-2 font-medium">2º Sem.</th>
                                <th className="px-3 py-2 font-medium">Δ</th>
                                <th className="px-3 py-2 font-medium">Evolução</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {c.habilidades.map((h) => {
                                const leftCell = `px-3 py-2 rounded border ${sideColor(h.trend, 'left')}`;
                                const rightCell = `px-3 py-2 rounded border ${sideColor(h.trend, 'right')}`;
                                return (
                                  <tr key={h.habilidade_codigo}>
                                    <td className="px-3 py-2 font-mono text-xs md:text-sm">{h.habilidade_codigo}</td>
                                    <td className="px-3 py-2 text-gray-700">{h.descricao ?? '—'}</td>
                                    <td className={leftCell}>
                                      {h.s1 ? `${h.s1.acertos}/${h.s1.total} (${pctFmt(h.s1.pct)})` : '—'}
                                    </td>
                                    <td className={rightCell}>
                                      {h.s2 ? `${h.s2.acertos}/${h.s2.total} (${pctFmt(h.s2.pct)})` : '—'}
                                    </td>
                                    <td className="px-3 py-2">{pctFmt(h.deltaPct)}</td>
                                    <td className="px-3 py-2">
                                      <BadgeTrend t={h.trend} />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
