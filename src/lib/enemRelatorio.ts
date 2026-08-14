// =============================================================================
// Monta os dados do "Relatório Individual de Desempenho" do ENEM (exportável em
// PDF). Análogo ao idebRelatorio.ts, adaptado aos dados do ENEM: sem etapas,
// 5 áreas (MT/LC/CN/CH/RD) + média geral, médias de grupo PONDERADAS por alunos.
//
// 100% determinístico e por cálculo. Regras herdadas: dado ausente vira null
// ("sem registro" na UI); nunca tratar ausência como zero; escolas sem dado não
// entram nas médias de grupo.
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

const ranking = (rows: EnemResultado[], inep: string): { pos: number; total: number } | null => {
  const comValor = rows.filter((r) => ehNumero(r.media));
  const esc = comValor.find((r) => r.inep_codigo === inep);
  if (!esc || !ehNumero(esc.media)) return null;
  const v = esc.media as number;
  const melhores = comValor.filter((r) => (r.media as number) > v).length;
  return { pos: melhores + 1, total: comValor.length };
};

// ---------------------------------------------------------------------------
// Tipos de saída
// ---------------------------------------------------------------------------
export interface PontoSerieEnem { ano: string; escola: number | null; apg: number | null; pr: number | null; }
export interface MediaN { media: number | null; n: number; }
export interface Ranking { pos: number; total: number; }
export interface AreaLinha { key: Exclude<EnemArea, 'media'>; label: string; escola: number | null; escolaAnt: number | null; apg: number | null; brasil: number; }
export interface PontoScatterEnem { alunos: number; media: number; destaque: boolean; }
export interface EscolaApg { inep: string; escola: string; cidade: string; media: number | null; alunos: number | null; destaque: boolean; }

export interface RelatorioEnem {
  inep: string;
  escola: string;
  cidade: string;
  regional: string | null;
  dependencia: string | null;
  grupoApg: boolean;
  geradoEm: string;
  anoAtual: string | null;
  anoAnterior: string | null;
  tituloExecutivo: string;
  leituraExecutiva: string[];

  mediaAtual: number | null;
  mediaAnterior: number | null;
  deltaMedia: number | null;
  alunosAtual: number | null;
  participantesAtual: number | null;
  redacaoAtual: number | null;

  serie: PontoSerieEnem[];
  areas: AreaLinha[];

  compEscola: number | null;
  compApg: MediaN; compMunicipio: MediaN; compPr: MediaN;
  brasilMedia: number;

  rankApg: Ranking | null; rankMunicipio: Ranking | null; rankPr: Ranking | null;

  scatter: PontoScatterEnem[];
  escolasApg: EscolaApg[];

  // Cenário por área: se a área de maior oportunidade alcançar a média APG,
  // o efeito na MÉDIA ARITMÉTICA das 5 provas (rotulada como tal, não é a média
  // oficial do ENEM).
  mediaAreas: number | null;         // média aritmética das 5 provas (edição atual)
  oportunidadeArea: string | null;   // label da área de maior oportunidade
  oportunidadeEscola: number | null; // valor da escola nessa área
  oportunidadeApg: number | null;    // média APG nessa área
  cenarioMediaAreas: number | null;  // média das 5 provas com a área elevada à média APG
}

export interface DadosRelatorioEnem {
  inep: string;
  data: EnemResultado[];   // todas as escolas, todas as edições
  anos: string[];          // ascendente
  geradoEm: string;
}

const delta1 = (d: number | null): string => (d === null ? 'sem registro' : `${d >= 0 ? '+' : '−'}${Math.abs(d).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`);
const n1 = (v: number | null): string => (ehNumero(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : 'sem registro');

export function montarRelatorioEnem(dados: DadosRelatorioEnem): RelatorioEnem {
  const { inep, data, anos, geradoEm } = dados;
  const anoAtual = anos[anos.length - 1] ?? null;
  const anoAnterior = anos[anos.length - 2] ?? null;

  const linhas = data.filter((r) => r.inep_codigo === inep);
  const escAtual = anoAtual ? linhas.find((r) => r.ano === anoAtual) ?? null : null;
  const escAnt = anoAnterior ? linhas.find((r) => r.ano === anoAnterior) ?? null : null;
  const baseAtual = anoAtual ? data.filter((r) => r.ano === anoAtual) : [];

  const meta = escAtual ?? linhas[0] ?? null;
  const cidade = meta?.cidade ?? '';
  const grupoApg = linhas.some((r) => r.is_apogeu);

  // Série por edição: escola, média APG e média do PR (ponderadas por alunos).
  const serie: PontoSerieEnem[] = anos.map((ano) => {
    const baseAno = data.filter((r) => r.ano === ano);
    const esc = linhas.find((r) => r.ano === ano);
    return {
      ano,
      escola: esc?.media ?? null,
      apg: mediaPond(baseAno.filter((r) => r.is_apogeu), 'media').media,
      pr: mediaPond(baseAno.filter((r) => r.uf === 'PR'), 'media').media,
    };
  });

  const gApg = baseAtual.filter((r) => r.is_apogeu);
  const gMun = cidade ? baseAtual.filter((r) => r.cidade === cidade && r.uf === 'PR') : [];
  const gPr = baseAtual.filter((r) => r.uf === 'PR');

  const areas: AreaLinha[] = AREAS_5.map((a) => ({
    key: a.key,
    label: a.label,
    escola: escAtual ? areaValue(escAtual, a.key) : null,
    escolaAnt: escAnt ? areaValue(escAnt, a.key) : null,
    apg: mediaPond(gApg, a.key).media,
    brasil: MEDIA_NACIONAL[a.key],
  }));

  // Média aritmética das 5 provas (base do cenário; distinta da média oficial).
  const areaVals = areas.map((a) => a.escola).filter(ehNumero) as number[];
  const mediaAreas = areaVals.length === AREAS_5.length ? arred(areaVals.reduce((s, v) => s + v, 0) / AREAS_5.length, 1) : null;

  // Área de maior oportunidade: maior distância abaixo da média APG.
  let oportunidadeArea: string | null = null, oportunidadeEscola: number | null = null,
    oportunidadeApg: number | null = null, cenarioMediaAreas: number | null = null;
  {
    const gaps = areas
      .map((a) => ({ a, gap: ehNumero(a.escola) && ehNumero(a.apg) ? (a.apg as number) - (a.escola as number) : null }))
      .filter((x) => ehNumero(x.gap) && (x.gap as number) > 0)
      .sort((x, y) => (y.gap as number) - (x.gap as number));
    if (gaps.length > 0 && mediaAreas !== null) {
      const top = gaps[0].a;
      oportunidadeArea = top.label;
      oportunidadeEscola = top.escola;
      oportunidadeApg = top.apg;
      const novas = areas.map((a) => (a.key === top.key ? (top.apg as number) : (a.escola as number)));
      cenarioMediaAreas = arred(novas.reduce((s, v) => s + v, 0) / AREAS_5.length, 1);
    }
  }

  const mediaAtual = escAtual?.media ?? null;
  const mediaAnterior = escAnt?.media ?? null;
  const deltaMedia = ehNumero(mediaAtual) && ehNumero(mediaAnterior) ? arred(arred(mediaAtual, 1) - arred(mediaAnterior, 1), 1) : null;

  const scatter: PontoScatterEnem[] = gApg
    .filter((r) => ehNumero(r.media) && ehNumero(r.alunos))
    .map((r) => ({ alunos: r.alunos as number, media: r.media as number, destaque: r.inep_codigo === inep }));

  const escolasApg: EscolaApg[] = [...gApg]
    .map((r) => ({ inep: r.inep_codigo ?? '', escola: r.escola, cidade: r.cidade, media: r.media, alunos: r.alunos, destaque: r.inep_codigo === inep }))
    .sort((a, b) => (b.media ?? -1) - (a.media ?? -1) || a.escola.localeCompare(b.escola));

  // Título executivo por regra.
  let tituloExecutivo: string;
  if (deltaMedia === null) tituloExecutivo = 'Panorama de desempenho da escola';
  else if (deltaMedia >= 1) tituloExecutivo = 'A escola avançou na média geral';
  else if (deltaMedia <= -1) tituloExecutivo = 'A escola recuou na média geral';
  else tituloExecutivo = 'Média geral estável entre as edições';

  const leituraExecutiva = [
    `A média geral do ENEM foi ${n1(mediaAtual)} em ${anoAtual ?? '—'} (variação de ${delta1(deltaMedia)} frente a ${anoAnterior ?? '—'}).`,
    `A escola aparece com ${ehNumero(escAtual?.alunos ?? null) ? (escAtual!.alunos as number).toLocaleString('pt-BR') : 'sem registro'} aluno(s) válidos na edição atual` +
      `${ehNumero(compApgMedia(gApg)) ? `; a média ponderada do grupo APG foi ${n1(compApgMedia(gApg))}.` : '.'}`,
    oportunidadeArea
      ? `A maior distância abaixo da média do grupo APG está em ${oportunidadeArea} (escola ${n1(oportunidadeEscola)} × APG ${n1(oportunidadeApg)}).`
      : `Na edição atual, a escola está igual ou acima da média do grupo APG nas áreas com registro.`,
  ];

  return {
    inep,
    escola: meta?.escola ?? '',
    cidade,
    regional: meta?.regional ?? null,
    dependencia: meta?.dependencia ?? null,
    grupoApg,
    geradoEm,
    anoAtual,
    anoAnterior,
    tituloExecutivo,
    leituraExecutiva,
    mediaAtual,
    mediaAnterior,
    deltaMedia,
    alunosAtual: escAtual?.alunos ?? null,
    participantesAtual: escAtual?.participantes ?? null,
    redacaoAtual: escAtual?.rd ?? null,
    serie,
    areas,
    compEscola: mediaAtual,
    compApg: { media: mediaPond(gApg, 'media').media, n: mediaPond(gApg, 'media').n },
    compMunicipio: { media: mediaPond(gMun, 'media').media, n: mediaPond(gMun, 'media').n },
    compPr: { media: mediaPond(gPr, 'media').media, n: mediaPond(gPr, 'media').n },
    brasilMedia: MEDIA_NACIONAL.media,
    rankApg: ranking(gApg, inep),
    rankMunicipio: cidade ? ranking(gMun, inep) : null,
    rankPr: ranking(gPr, inep),
    scatter,
    escolasApg,
    mediaAreas,
    oportunidadeArea,
    oportunidadeEscola,
    oportunidadeApg,
    cenarioMediaAreas,
  };
}

// Média ponderada da média geral do grupo APG (helper local p/ a leitura executiva).
function compApgMedia(gApg: EnemResultado[]): number | null {
  return mediaPond(gApg, 'media').media;
}
