// Comparativo entre edições do ENEM (base × comparada) para o Consolidado e o
// Desempenho — o análogo do idebComparacao. Puro/determinístico: recebe a base
// (todas as escolas, todas as edições) e devolve tabelas/séries prontas.
//
// Diferenças em relação ao IDEB: o ENEM não tem "etapa" (só uma dimensão) e a
// média de um grupo é PONDERADA pelo nº de alunos válidos (mediaPonderada), como
// no resto do dashboard. A métrica de comparação é a média geral por padrão.

import { EnemResultado, EnemArea, EnemParceiro } from '../types';
import { PARCEIROS, mediaPonderada, areaValue } from './enem';

// Edições (anos) presentes na base, em ordem crescente.
export const edicoesTodas = (data: EnemResultado[]): string[] =>
  Array.from(new Set(data.map((r) => r.ano))).sort((a, b) => a.localeCompare(b));

// ---- Tabela "Consolidado por grupo" ----
export interface ConsolidadoLinha {
  grupo: EnemParceiro;
  mediaBase: number | null;
  mediaComp: number | null;
  variacao: number | null;      // mediaComp − mediaBase
  escolas: number;              // escolas comparáveis (com nota nas duas edições)
  melhoraram: number;
  pctMelhoraram: number | null;
}

// Mapa inep→valor (da área) de uma edição, só escolas com nota.
const valorPorInep = (rows: EnemResultado[], ano: string, area: EnemArea): Map<string, number> => {
  const m = new Map<string, number>();
  rows.forEach((r) => {
    if (r.ano === ano) {
      const v = areaValue(r, area);
      if (v != null) m.set(r.inep_codigo ?? r.id, v);
    }
  });
  return m;
};

export const consolidadoPorGrupo = (
  data: EnemResultado[],
  base: string,
  comparada: string,
  area: EnemArea = 'media'
): ConsolidadoLinha[] =>
  PARCEIROS.map((p) => {
    const rows = data.filter((r) => r.parceiro === p.key);
    const bmap = valorPorInep(rows, base, area);
    const cmap = valorPorInep(rows, comparada, area);
    const mediaBase = mediaPonderada(rows.filter((r) => r.ano === base), area);
    const mediaComp = mediaPonderada(rows.filter((r) => r.ano === comparada), area);
    let escolas = 0;
    let melhoraram = 0;
    bmap.forEach((vb, inep) => {
      const vc = cmap.get(inep);
      if (vc != null) {
        escolas += 1;
        if (vc > vb) melhoraram += 1;
      }
    });
    return {
      grupo: p.key,
      mediaBase,
      mediaComp,
      variacao: mediaBase != null && mediaComp != null ? mediaComp - mediaBase : null,
      escolas,
      melhoraram,
      pctMelhoraram: escolas > 0 ? (melhoraram / escolas) * 100 : null,
    };
  });

// ---- Série "Média por grupo" (para o gráfico de linhas) ----
export interface SerieGrupo {
  grupo: EnemParceiro;
  label: string;
  color: string;
  pontos: { ano: string; media: number | null }[];
}

export const seriePorGrupo = (
  data: EnemResultado[],
  edicoes: string[],
  area: EnemArea = 'media'
): SerieGrupo[] =>
  PARCEIROS.map((p) => ({
    grupo: p.key,
    label: p.label,
    color: p.color,
    pontos: edicoes.map((ano) => ({
      ano,
      media: mediaPonderada(data.filter((r) => r.parceiro === p.key && r.ano === ano), area),
    })),
  }));

// ---- Maiores melhoras / quedas por escola (base → comparada) ----
export interface VariacaoEscola {
  inep: string;
  escola: string;
  cidade: string;
  grupo: EnemParceiro | null;
  base: number;
  comparada: number;
  variacao: number;
}

export const variacaoEscolas = (
  data: EnemResultado[],
  base: string,
  comparada: string,
  area: EnemArea = 'media'
): VariacaoEscola[] => {
  // Só escolas dos grupos parceiros (apg/salta/tom).
  const rows = data.filter((r) => r.parceiro != null);
  const bmap = valorPorInep(rows, base, area);
  const cmap = valorPorInep(rows, comparada, area);
  const info = new Map<string, EnemResultado>();
  rows.forEach((r) => { const k = r.inep_codigo ?? r.id; if (!info.has(k)) info.set(k, r); });
  const out: VariacaoEscola[] = [];
  bmap.forEach((vb, inep) => {
    const vc = cmap.get(inep);
    const meta = info.get(inep);
    if (vc != null && meta) {
      out.push({ inep, escola: meta.escola, cidade: meta.cidade, grupo: meta.parceiro, base: vb, comparada: vc, variacao: vc - vb });
    }
  });
  return out;
};

export const topMelhoras = (v: VariacaoEscola[], n = 10): VariacaoEscola[] =>
  v.filter((x) => x.variacao > 0).sort((a, b) => b.variacao - a.variacao).slice(0, n);

export const topQuedas = (v: VariacaoEscola[], n = 10): VariacaoEscola[] =>
  v.filter((x) => x.variacao < 0).sort((a, b) => a.variacao - b.variacao).slice(0, n);

// ---- Série de UMA escola (para a "Trajetória" no Desempenho) ----
export const serieEscola = (
  data: EnemResultado[],
  inep: string,
  edicoes: string[],
  area: EnemArea = 'media'
): { ano: string; valor: number | null }[] =>
  edicoes.map((ano) => {
    const r = data.find((x) => (x.inep_codigo ?? x.id) === inep && x.ano === ano);
    return { ano, valor: r ? areaValue(r, area) : null };
  });

// Presets de seleção das edições do gráfico.
export type PresetEdicoes = 'todas' | 'ultimas3' | 'par';
export const aplicarPreset = (
  todas: string[],
  preset: PresetEdicoes,
  base: string,
  comparada: string
): string[] => {
  if (preset === 'ultimas3') return todas.slice(-3);
  if (preset === 'par') return todas.filter((a) => a === base || a === comparada);
  return todas;
};
