// =============================================================================
// Monta os dados do "Relatório Regional de Desempenho" do ENEM (exportável em
// PDF). Versão agregada por REGIONAL (SJP/GUA/CWT) do relatório individual de
// escola (ver enemRelatorio.ts). 100% determinístico e por cálculo.
//
// A "nota da regional" em cada indicador é a MÉDIA PONDERADA pelo nº de alunos
// válidos das escolas da regional com valor naquela edição (mesma ponderação do
// restante do sistema ENEM). Escolas sem dado não entram.
// =============================================================================

import { EnemResultado, EnemArea } from '../types';
import { AREAS_5, MEDIA_NACIONAL } from './enemInsights';

const ehNumero = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);
const arred = (v: number, dec: number): number => Number(v.toFixed(dec));

const areaField = (area: EnemArea): keyof EnemResultado =>
  (AREAS_5.find((a) => a.key === area)?.field ?? 'media');
const areaValue = (r: EnemResultado, area: EnemArea): number | null => {
  const v = area === 'media' ? r.media : r[areaField(area)];
  return ehNumero(v) ? (v as number) : null;
};

// Média ponderada pelo nº de alunos válidos (escolas sem valor não entram).
const mediaPond = (rows: EnemResultado[], area: EnemArea): { media: number | null; n: number; alunos: number } => {
  let soma = 0, alunos = 0, n = 0;
  rows.forEach((r) => {
    const v = areaValue(r, area);
    if (v !== null) { soma += v * (r.alunos || 0); alunos += r.alunos || 0; n += 1; }
  });
  return { media: alunos > 0 ? soma / alunos : null, n, alunos };
};

// ---------------------------------------------------------------------------
// Tipos de saída
// ---------------------------------------------------------------------------
export interface PontoSerieReg { ano: string; regional: number | null; apg: number | null; pr: number | null; }
export interface MediaN { media: number | null; n: number; }
export interface Ranking { pos: number; total: number; }
export interface AreaLinhaReg { key: Exclude<EnemArea, 'media'>; label: string; regional: number | null; regionalAnt: number | null; apg: number | null; brasil: number; }
export interface RegionalBarra { codigo: string; media: number | null; n: number; destaque: boolean; }
export interface PontoScatterEnem { alunos: number; media: number; destaque: boolean; }
export interface EscolaRegional { inep: string; escola: string; cidade: string; media: number | null; alunos: number | null; }

export interface RelatorioEnemRegional {
  regional: string;
  municipios: string[];
  totalEscolas: number;
  geradoEm: string;
  anoAtual: string | null;
  anoAnterior: string | null;
  tituloExecutivo: string;
  leituraExecutiva: string[];

  mediaAtual: number | null;
  mediaAnterior: number | null;
  deltaMedia: number | null;
  nEscolas: number;            // escolas da regional com média na edição atual
  alunosAtual: number;         // total de alunos válidos da regional (edição atual)
  redacaoAtual: number | null; // redação ponderada da regional

  serie: PontoSerieReg[];
  areas: AreaLinhaReg[];

  compRegional: number | null;
  compApg: MediaN; compPr: MediaN;
  brasilMedia: number;

  regionais: RegionalBarra[];
  rankRegionais: Ranking | null;
  acimaApg: { x: number; n: number } | null;
  acimaPr: { x: number; n: number } | null;

  scatter: PontoScatterEnem[];
  escolas: EscolaRegional[];

  // Cenário por área (média aritmética das 5 provas da regional).
  mediaAreas: number | null;
  oportunidadeArea: string | null;
  oportunidadeRegional: number | null;
  oportunidadeApg: number | null;
  cenarioMediaAreas: number | null;
}

export interface DadosRelatorioEnemRegional {
  regional: string;
  data: EnemResultado[];   // todas as escolas, todas as edições
  anos: string[];          // ascendente
  geradoEm: string;
}

const n1 = (v: number | null): string => (ehNumero(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : 'sem registro');
const delta1 = (d: number | null): string => (d === null ? 'sem registro' : `${d >= 0 ? '+' : '−'}${Math.abs(d).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`);

export function montarRelatorioEnemRegional(dados: DadosRelatorioEnemRegional): RelatorioEnemRegional {
  const { regional, data, anos, geradoEm } = dados;
  const anoAtual = anos[anos.length - 1] ?? null;
  const anoAnterior = anos[anos.length - 2] ?? null;

  const linhasReg = data.filter((r) => r.regional === regional);
  const regNoAno = (ano: string | null): EnemResultado[] => (ano ? linhasReg.filter((r) => r.ano === ano) : []);
  const rowsAtual = regNoAno(anoAtual);
  const rowsAnt = regNoAno(anoAnterior);
  const baseAtual = anoAtual ? data.filter((r) => r.ano === anoAtual) : [];

  const municipios = Array.from(new Set(linhasReg.map((r) => r.cidade).filter(Boolean))).sort();
  const totalEscolas = new Set(linhasReg.map((r) => r.inep_codigo)).size;

  // Série: regional, grupo APG e PR (todas ponderadas por alunos) por edição.
  const serie: PontoSerieReg[] = anos.map((ano) => {
    const baseAno = data.filter((r) => r.ano === ano);
    return {
      ano,
      regional: mediaPond(linhasReg.filter((r) => r.ano === ano), 'media').media,
      apg: mediaPond(baseAno.filter((r) => r.is_apogeu), 'media').media,
      pr: mediaPond(baseAno.filter((r) => r.uf === 'PR'), 'media').media,
    };
  });

  const mMediaAtual = mediaPond(rowsAtual, 'media');
  const mMediaAnt = mediaPond(rowsAnt, 'media');
  const mediaAtual = mMediaAtual.media;
  const mediaAnterior = mMediaAnt.media;
  const deltaMedia = ehNumero(mediaAtual) && ehNumero(mediaAnterior) ? arred(arred(mediaAtual, 1) - arred(mediaAnterior, 1), 1) : null;

  const gApg = baseAtual.filter((r) => r.is_apogeu);
  const gPr = baseAtual.filter((r) => r.uf === 'PR');
  const compApg = mediaPond(gApg, 'media');
  const compPr = mediaPond(gPr, 'media');

  const areas: AreaLinhaReg[] = AREAS_5.map((a) => ({
    key: a.key,
    label: a.label,
    regional: mediaPond(rowsAtual, a.key).media,
    regionalAnt: mediaPond(rowsAnt, a.key).media,
    apg: mediaPond(gApg, a.key).media,
    brasil: MEDIA_NACIONAL[a.key],
  }));

  // Média aritmética das 5 provas da regional (base do cenário).
  const areaVals = areas.map((a) => a.regional).filter(ehNumero) as number[];
  const mediaAreas = areaVals.length === AREAS_5.length ? arred(areaVals.reduce((s, v) => s + v, 0) / AREAS_5.length, 1) : null;

  let oportunidadeArea: string | null = null, oportunidadeRegional: number | null = null,
    oportunidadeApg: number | null = null, cenarioMediaAreas: number | null = null;
  {
    const gaps = areas
      .map((a) => ({ a, gap: ehNumero(a.regional) && ehNumero(a.apg) ? (a.apg as number) - (a.regional as number) : null }))
      .filter((x) => ehNumero(x.gap) && (x.gap as number) > 0)
      .sort((x, y) => (y.gap as number) - (x.gap as number));
    if (gaps.length > 0 && mediaAreas !== null) {
      const top = gaps[0].a;
      oportunidadeArea = top.label;
      oportunidadeRegional = top.regional;
      oportunidadeApg = top.apg;
      const novas = areas.map((a) => (a.key === top.key ? (top.apg as number) : (a.regional as number)));
      cenarioMediaAreas = arred(novas.reduce((s, v) => s + v, 0) / AREAS_5.length, 1);
    }
  }

  // Todas as regionais na edição atual (barra + ranking).
  const codigos = Array.from(new Set(baseAtual.map((r) => r.regional).filter(Boolean) as string[])).sort();
  const regionais: RegionalBarra[] = codigos.map((cod) => {
    const m = mediaPond(baseAtual.filter((r) => r.regional === cod), 'media');
    return { codigo: cod, media: m.media, n: m.n, destaque: cod === regional };
  });
  const comValor = regionais.filter((r) => ehNumero(r.media));
  const eu = comValor.find((r) => r.codigo === regional);
  const rankRegionais = eu
    ? { pos: 1 + comValor.filter((r) => (r.media as number) > (eu.media as number)).length, total: comValor.length }
    : null;

  const escComMedia = rowsAtual.filter((r) => ehNumero(r.media));
  const acimaApg = ehNumero(compApg.media)
    ? { x: escComMedia.filter((r) => (r.media as number) >= (compApg.media as number)).length, n: escComMedia.length }
    : null;
  const acimaPr = ehNumero(compPr.media)
    ? { x: escComMedia.filter((r) => (r.media as number) >= (compPr.media as number)).length, n: escComMedia.length }
    : null;

  const scatter: PontoScatterEnem[] = gApg
    .filter((r) => ehNumero(r.media) && ehNumero(r.alunos))
    .map((r) => ({ alunos: r.alunos as number, media: r.media as number, destaque: r.regional === regional }));

  const escolas: EscolaRegional[] = [...rowsAtual]
    .map((r) => ({ inep: r.inep_codigo ?? '', escola: r.escola, cidade: r.cidade, media: r.media, alunos: r.alunos }))
    .sort((a, b) => (b.media ?? -1) - (a.media ?? -1) || a.escola.localeCompare(b.escola));

  // Título executivo por regra.
  let tituloExecutivo: string;
  if (deltaMedia === null) tituloExecutivo = 'Panorama de desempenho da regional';
  else if (deltaMedia >= 1) tituloExecutivo = 'A regional avançou na média geral';
  else if (deltaMedia <= -1) tituloExecutivo = 'A regional recuou na média geral';
  else tituloExecutivo = 'Média geral estável entre as edições';

  const posReg = rankRegionais ? `${rankRegionais.pos}ª de ${rankRegionais.total} regionais` : 'sem registro';
  const leituraExecutiva = [
    `A média geral ponderada da regional foi ${n1(mediaAtual)} em ${anoAtual ?? '—'} (variação de ${delta1(deltaMedia)} frente a ${anoAnterior ?? '—'}), entrando ${mMediaAtual.n} escola(s) no cálculo.`,
    `Entre as regionais, a posição foi ${posReg}; a média ponderada do grupo APG foi ${n1(compApg.media)} e a das escolas do Paraná ${n1(compPr.media)}.`,
    oportunidadeArea
      ? `A maior distância abaixo da média do grupo APG está em ${oportunidadeArea} (regional ${n1(oportunidadeRegional)} × APG ${n1(oportunidadeApg)}).`
      : `Na edição atual, a regional está igual ou acima da média do grupo APG nas áreas com registro.`,
  ];

  return {
    regional,
    municipios,
    totalEscolas,
    geradoEm,
    anoAtual,
    anoAnterior,
    tituloExecutivo,
    leituraExecutiva,
    mediaAtual,
    mediaAnterior,
    deltaMedia,
    nEscolas: mMediaAtual.n,
    alunosAtual: mMediaAtual.alunos,
    redacaoAtual: mediaPond(rowsAtual, 'rd').media,
    serie,
    areas,
    compRegional: mediaAtual,
    compApg: { media: compApg.media, n: compApg.n },
    compPr: { media: compPr.media, n: compPr.n },
    brasilMedia: MEDIA_NACIONAL.media,
    regionais,
    rankRegionais,
    acimaApg,
    acimaPr,
    scatter,
    escolas,
    mediaAreas,
    oportunidadeArea,
    oportunidadeRegional,
    oportunidadeApg,
    cenarioMediaAreas,
  };
}
