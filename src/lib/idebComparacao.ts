// Comparativo entre edições do IDEB (base × comparada) para o Consolidado e o
// Desempenho. Tudo aqui é PURO/determinístico — recebe a série histórica das
// escolas parceiras (getIdebParceiros) e devolve tabelas/séries prontas.

import { IdebResultado, IdebEtapa, EnemParceiro } from '../types';
import { PARCEIROS } from './ideb';

const media = (vals: number[]): number | null =>
  vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;

// Edições (anos) presentes na etapa, em ordem crescente.
export const edicoesDaEtapa = (hist: IdebResultado[], etapa: IdebEtapa): string[] =>
  Array.from(new Set(hist.filter((r) => r.etapa === etapa && r.ideb != null).map((r) => r.ano))).sort(
    (a, b) => a.localeCompare(b)
  );

// Edições válidas para os seletores base/comparada (união das duas etapas).
export const edicoesTodas = (hist: IdebResultado[]): string[] =>
  Array.from(new Set(hist.filter((r) => r.ideb != null).map((r) => r.ano))).sort((a, b) => a.localeCompare(b));

// ---- Tabela "Consolidado por grupo e etapa" ----
export interface ConsolidadoLinha {
  grupo: EnemParceiro;
  etapa: IdebEtapa;
  mediaBase: number | null;
  mediaComp: number | null;
  variacao: number | null;      // mediaComp − mediaBase
  escolas: number;              // escolas comparáveis (com IDEB nas duas edições)
  melhoraram: number;           // dessas, quantas subiram
  pctMelhoraram: number | null; // melhoraram / escolas
}

// Mapa inep→ideb de uma edição (só escolas com nota).
const idebPorInep = (rows: IdebResultado[], ano: string): Map<string, number> => {
  const m = new Map<string, number>();
  rows.forEach((r) => {
    if (r.ano === ano && r.ideb != null) m.set(r.inep_codigo, r.ideb as number);
  });
  return m;
};

export const consolidadoGrupoEtapa = (
  hist: IdebResultado[],
  base: string,
  comparada: string
): ConsolidadoLinha[] => {
  const etapas: IdebEtapa[] = ['anos_finais', 'ensino_medio'];
  const linhas: ConsolidadoLinha[] = [];
  etapas.forEach((etapa) => {
    PARCEIROS.forEach((p) => {
      const rows = hist.filter((r) => r.etapa === etapa && r.parceiro === p.key);
      const bmap = idebPorInep(rows, base);
      const cmap = idebPorInep(rows, comparada);
      const mediaBase = media(Array.from(bmap.values()));
      const mediaComp = media(Array.from(cmap.values()));
      let escolas = 0;
      let melhoraram = 0;
      bmap.forEach((vb, inep) => {
        const vc = cmap.get(inep);
        if (vc != null) {
          escolas += 1;
          if (vc > vb) melhoraram += 1;
        }
      });
      linhas.push({
        grupo: p.key,
        etapa,
        mediaBase,
        mediaComp,
        variacao: mediaBase != null && mediaComp != null ? mediaComp - mediaBase : null,
        escolas,
        melhoraram,
        pctMelhoraram: escolas > 0 ? (melhoraram / escolas) * 100 : null,
      });
    });
  });
  return linhas;
};

// ---- Série "Média do IDEB por grupo" (para o gráfico de linhas) ----
export interface SerieGrupo {
  grupo: EnemParceiro;
  label: string;
  color: string;
  pontos: { ano: string; media: number | null }[];
}

export const seriePorGrupo = (
  hist: IdebResultado[],
  etapa: IdebEtapa,
  edicoes: string[]
): SerieGrupo[] =>
  PARCEIROS.map((p) => ({
    grupo: p.key,
    label: p.label,
    color: p.color,
    pontos: edicoes.map((ano) => ({
      ano,
      media: media(
        hist
          .filter((r) => r.etapa === etapa && r.parceiro === p.key && r.ano === ano && r.ideb != null)
          .map((r) => r.ideb as number)
      ),
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
  hist: IdebResultado[],
  etapa: IdebEtapa,
  base: string,
  comparada: string
): VariacaoEscola[] => {
  // Só escolas dos grupos parceiros (apg/salta/tom); ignora escolas avulsas que
  // entram no histórico apenas por terem regional preenchida.
  const rows = hist.filter((r) => r.etapa === etapa && r.parceiro != null);
  const bmap = idebPorInep(rows, base);
  const cmap = idebPorInep(rows, comparada);
  const info = new Map<string, IdebResultado>();
  rows.forEach((r) => { if (!info.has(r.inep_codigo)) info.set(r.inep_codigo, r); });
  const out: VariacaoEscola[] = [];
  bmap.forEach((vb, inep) => {
    const vc = cmap.get(inep);
    const meta = info.get(inep);
    if (vc != null && meta) {
      out.push({
        inep,
        escola: meta.escola,
        cidade: meta.cidade,
        grupo: meta.parceiro,
        base: vb,
        comparada: vc,
        variacao: vc - vb,
      });
    }
  });
  return out;
};

// Top N melhoras (variação > 0, desc) e quedas (variação < 0, asc).
export const topMelhoras = (v: VariacaoEscola[], n = 10): VariacaoEscola[] =>
  v.filter((x) => x.variacao > 0).sort((a, b) => b.variacao - a.variacao).slice(0, n);

export const topQuedas = (v: VariacaoEscola[], n = 10): VariacaoEscola[] =>
  v.filter((x) => x.variacao < 0).sort((a, b) => a.variacao - b.variacao).slice(0, n);

// ---- Série de UMA escola (para a "Trajetória do IDEB" no Desempenho) ----
export const serieEscola = (
  hist: IdebResultado[],
  inep: string,
  etapa: IdebEtapa,
  edicoes: string[]
): { ano: string; ideb: number | null }[] =>
  edicoes.map((ano) => {
    const r = hist.find((x) => x.inep_codigo === inep && x.etapa === etapa && x.ano === ano);
    return { ano, ideb: r && r.ideb != null ? (r.ideb as number) : null };
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
