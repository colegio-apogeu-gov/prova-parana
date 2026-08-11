// =============================================================================
// Monta os dados do "Relatório Regional de Desempenho" do IDEB (exportável em
// PDF). Versão agregada por REGIONAL (SJP / GUA / CWT) do relatório individual
// de escola (ver idebRelatorio.ts). 100% determinístico e por cálculo.
//
// Regras herdadas: dado ausente vira null (exibido como "sem registro"); nunca
// tratar ausência como zero; escolas sem dado não entram em médias/contagens.
// A "nota da regional" em cada indicador é a MÉDIA SIMPLES das escolas da
// regional com valor naquele indicador/edição (o IDEB não publica matrículas,
// então não há ponderação — igual ao resto do app).
// =============================================================================

import { IdebResultado, IdebEtapa, IdebAgregadoPR } from '../types';

// Cenário interno de projeção: soma este incremento ao componente N e mantém P
// de CADA escola, depois tira a média (mesmo incremento do relatório de escola).
export const INCREMENTO_N_CENARIO = 0.2;

const ORDEM_ETAPAS: IdebEtapa[] = ['anos_finais', 'ensino_medio'];
const rotuloEtapa = (e: IdebEtapa): string => (e === 'ensino_medio' ? 'Ensino médio' : 'Anos finais');

const ehNumero = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);
const arred = (v: number, dec: number): number => Number(v.toFixed(dec));

// Média simples de um campo, ignorando nulos (escolas sem dado não entram).
const media = (rows: IdebResultado[], campo: keyof IdebResultado): { media: number | null; n: number } => {
  const vs = rows.map((r) => r[campo]).filter(ehNumero) as number[];
  return vs.length ? { media: vs.reduce((a, b) => a + b, 0) / vs.length, n: vs.length } : { media: null, n: 0 };
};

// ---------------------------------------------------------------------------
// Tipos de saída
// ---------------------------------------------------------------------------
export interface PontoSerieReg { ano: string; regional: number | null; apg: number | null; pr: number | null; }
export interface MediaN { media: number | null; n: number; }
export interface Ranking { pos: number; total: number; }
export interface PontoScatter { p: number; ideb: number; destaque: boolean; }
export interface RegionalBarra { codigo: string; media: number | null; n: number; destaque: boolean; }
export interface EscolaRegional {
  inep: string; escola: string; cidade: string;
  ideb: number | null; n: number | null; p: number | null;
}

export interface RelatorioRegionalEtapa {
  etapa: IdebEtapa;
  label: string;
  anoAtual: string | null;
  anoAnterior: string | null;
  serie: PontoSerieReg[];
  idebAtual: number | null;
  idebAnterior: number | null;
  deltaIdeb: number | null;
  nEscolas: number;                // escolas da regional com IDEB na edição atual
  aprovacao: number | null;        // média (% total da etapa)
  nAtual: number | null;           // média da aprendizagem N na edição atual
  pAnterior: number | null;        // média do fluxo P (0..1)
  pAtual: number | null;
  nAnterior: number | null;
  mtAnterior: number | null; lpAnterior: number | null;
  mtAtual: number | null; lpAtual: number | null;
  // Comparações (edição atual) — média da regional × grupo APG × rede estadual PR
  compRegional: number | null;
  compApg: MediaN; compPr: MediaN;
  // Todas as regionais (edição atual) para a barra comparativa + ranking
  regionais: RegionalBarra[];
  rankRegionais: Ranking | null;
  acimaApg: { x: number; n: number } | null;   // escolas da regional ≥ média APG
  acimaPr: { x: number; n: number } | null;     // escolas da regional ≥ média PR estadual
  // Quadrante APG (edição atual): todas as escolas APG, regional destacada
  scatter: PontoScatter[];
  // Escolas da regional ranqueadas por IDEB (edição atual)
  escolas: EscolaRegional[];
  // Cenário interno (projeção): média de (N+0,2)×P por escola
  cenarioIdeb: number | null;
}

export interface RelatorioRegional {
  regional: string;
  municipios: string[];
  totalEscolas: number;            // escolas distintas na regional (todas as etapas)
  geradoEm: string;
  tituloExecutivo: string;
  leituraExecutiva: string[];
  etapas: RelatorioRegionalEtapa[];
}

export interface DadosRelatorioRegional {
  regional: string;
  parceiros: IdebResultado[];      // histórico das escolas parceiras/regionais (todas as edições)
  agregado: IdebAgregadoPR[];
  baseAtual: Record<IdebEtapa, IdebResultado[]>;
  edicoes: Record<IdebEtapa, { anoAtual: string | null; anoAnterior: string | null; anos: string[] }>;
  geradoEm: string;
}

// Rótulo legível da regional (código → nome). Mantido conservador: se o código
// não for conhecido, exibe o próprio código (não inventa nome).
export const REGIONAL_LABEL: Record<string, string> = {
  SJP: 'São José dos Pinhais',
  CWT: 'Curitiba',
  GUA: 'Área Metropolitana',
};
export const rotuloRegional = (cod: string): string => REGIONAL_LABEL[cod] ?? cod;

// ---------------------------------------------------------------------------
function montarEtapaRegional(dados: DadosRelatorioRegional, etapa: IdebEtapa): RelatorioRegionalEtapa {
  const { regional, parceiros, agregado, baseAtual, edicoes } = dados;
  const { anoAtual, anoAnterior, anos } = edicoes[etapa];

  const baseEt = baseAtual[etapa] ?? [];
  // Linhas históricas (todas as edições) das escolas desta regional nesta etapa.
  const parcEt = parceiros.filter((r) => r.etapa === etapa && r.regional === regional);
  const regNoAno = (ano: string | null): IdebResultado[] => (ano ? parcEt.filter((r) => r.ano === ano) : []);

  // Série: média da regional, média do grupo APG e PR estadual (agregado) por edição.
  const serie: PontoSerieReg[] = anos.map((ano) => ({
    ano,
    regional: media(parcEt.filter((r) => r.ano === ano), 'ideb').media,
    apg: media(parceiros.filter((r) => r.etapa === etapa && r.ano === ano && r.is_apogeu), 'ideb').media,
    pr: agregado.find((a) => a.etapa === etapa && a.ano === ano)?.ideb_estadual ?? null,
  }));

  const rowsAtual = regNoAno(anoAtual);
  const rowsAnt = regNoAno(anoAnterior);

  const idebAtualM = media(rowsAtual, 'ideb');
  const idebAntM = media(rowsAnt, 'ideb');
  const idebAtual = idebAtualM.media;
  const idebAnterior = idebAntM.media;
  const deltaIdeb =
    ehNumero(idebAtual) && ehNumero(idebAnterior) ? arred(arred(idebAtual, 1) - arred(idebAnterior, 1), 1) : null;

  // Cenário: por escola (N+0,2)×P, depois média simples (só escolas com N e P).
  const cen = rowsAtual
    .map((r) => (ehNumero(r.aprendizado) && ehNumero(r.fluxo) ? (r.aprendizado + INCREMENTO_N_CENARIO) * r.fluxo : null))
    .filter(ehNumero) as number[];
  const cenarioIdeb = cen.length ? arred(cen.reduce((a, b) => a + b, 0) / cen.length, 1) : null;

  // Comparações da edição atual (base completa do PR).
  const gApg = baseEt.filter((r) => r.is_apogeu);
  const gPr = baseEt.filter((r) => r.rede === 'Estadual');
  const compApg = media(gApg, 'ideb');
  const compPr = media(gPr, 'ideb');

  // Todas as regionais na edição atual (para a barra e o ranking entre regionais).
  const codigos = Array.from(new Set(baseEt.map((r) => r.regional).filter(Boolean) as string[])).sort();
  const regionais: RegionalBarra[] = codigos.map((cod) => {
    const m = media(baseEt.filter((r) => r.regional === cod), 'ideb');
    return { codigo: cod, media: m.media, n: m.n, destaque: cod === regional };
  });
  const comValor = regionais.filter((r) => ehNumero(r.media));
  const eu = comValor.find((r) => r.codigo === regional);
  const rankRegionais = eu
    ? { pos: 1 + comValor.filter((r) => (r.media as number) > (eu.media as number)).length, total: comValor.length }
    : null;

  // Escolas da regional acima/abaixo das referências (edição atual).
  const escComIdeb = rowsAtual.filter((r) => ehNumero(r.ideb));
  const acimaApg = ehNumero(compApg.media)
    ? { x: escComIdeb.filter((r) => (r.ideb as number) >= (compApg.media as number)).length, n: escComIdeb.length }
    : null;
  const acimaPr = ehNumero(compPr.media)
    ? { x: escComIdeb.filter((r) => (r.ideb as number) >= (compPr.media as number)).length, n: escComIdeb.length }
    : null;

  // Dispersão P×IDEB do grupo APG, com as escolas da regional destacadas.
  const scatter: PontoScatter[] = gApg
    .filter((r) => ehNumero(r.ideb) && ehNumero(r.fluxo))
    .map((r) => ({ p: (r.fluxo as number) * 100, ideb: r.ideb as number, destaque: r.regional === regional }));

  // Escolas da regional ranqueadas por IDEB (edição atual). Sem IDEB vão ao fim.
  const escolas: EscolaRegional[] = [...rowsAtual]
    .map((r) => ({ inep: r.inep_codigo, escola: r.escola, cidade: r.cidade, ideb: r.ideb, n: r.aprendizado, p: r.fluxo }))
    .sort((a, b) => (b.ideb ?? -1) - (a.ideb ?? -1) || a.escola.localeCompare(b.escola));

  return {
    etapa,
    label: rotuloEtapa(etapa),
    anoAtual,
    anoAnterior,
    serie,
    idebAtual,
    idebAnterior,
    deltaIdeb,
    nEscolas: idebAtualM.n,
    aprovacao: media(rowsAtual, 'aprovacao').media,
    nAtual: media(rowsAtual, 'aprendizado').media,
    pAnterior: media(rowsAnt, 'fluxo').media,
    pAtual: media(rowsAtual, 'fluxo').media,
    nAnterior: media(rowsAnt, 'aprendizado').media,
    mtAnterior: media(rowsAnt, 'saeb_mt').media,
    lpAnterior: media(rowsAnt, 'saeb_lp').media,
    mtAtual: media(rowsAtual, 'saeb_mt').media,
    lpAtual: media(rowsAtual, 'saeb_lp').media,
    compRegional: idebAtual,
    compApg,
    compPr,
    regionais,
    rankRegionais,
    acimaApg,
    acimaPr,
    scatter,
    escolas,
    cenarioIdeb,
  };
}

const descreveDelta = (d: number | null): string => {
  if (d === null) return 'não calculada (sem registro em um dos anos)';
  const abs = arred(Math.abs(d), 1).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (d > 0) return `+${abs} ponto`;
  if (d < 0) return `−${abs} ponto`;
  return 'estável (0,0 ponto)';
};

export function montarRelatorioRegional(dados: DadosRelatorioRegional): RelatorioRegional {
  const etapas = ORDEM_ETAPAS.map((e) => montarEtapaRegional(dados, e));
  const af = etapas.find((e) => e.etapa === 'anos_finais')!;
  const em = etapas.find((e) => e.etapa === 'ensino_medio')!;

  // Metadados da regional a partir do histórico (não inventa nome de município).
  const linhasReg = dados.parceiros.filter((r) => r.regional === dados.regional);
  const municipios = Array.from(new Set(linhasReg.map((r) => r.cidade).filter(Boolean))).sort();
  const totalEscolas = new Set(linhasReg.map((r) => r.inep_codigo)).size;

  // Título executivo por regra (sem adjetivos de valor).
  let tituloExecutivo: string;
  const subiuAF = af.deltaIdeb !== null && af.deltaIdeb > 0;
  const subiuEM = em.deltaIdeb !== null && em.deltaIdeb > 0;
  if (af.deltaIdeb !== null && em.deltaIdeb !== null) {
    if (subiuAF && subiuEM) tituloExecutivo = 'A regional avançou nas duas etapas';
    else if (!subiuAF && !subiuEM && af.deltaIdeb < 0 && em.deltaIdeb < 0) tituloExecutivo = 'A regional recuou nas duas etapas';
    else tituloExecutivo = 'Resultados distintos entre as etapas';
  } else {
    tituloExecutivo = 'Panorama de desempenho da regional';
  }

  const pctFluxo = (v: number | null): string =>
    ehNumero(v) ? `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : 'sem registro';
  const nFmt = (v: number | null): string =>
    ehNumero(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'sem registro';
  const posReg = (e: RelatorioRegionalEtapa): string =>
    e.rankRegionais ? `${e.rankRegionais.pos}ª de ${e.rankRegionais.total} regionais` : 'sem registro';

  const leituraExecutiva = [
    `O IDEB médio da regional variou ${descreveDelta(af.deltaIdeb)} nos anos finais e ${descreveDelta(em.deltaIdeb)} no ensino médio ` +
      `(comparação ${af.anoAnterior ?? '—'}→${af.anoAtual ?? '—'} / ${em.anoAnterior ?? '—'}→${em.anoAtual ?? '—'}).`,
    `Na edição atual, a média entra com ${af.nEscolas} escola(s) com IDEB nos anos finais e ${em.nEscolas} no ensino médio; ` +
      `entre as regionais, a posição foi ${posReg(af)} (anos finais) e ${posReg(em)} (ensino médio).`,
    `O rendimento médio (P) foi ${pctFluxo(af.pAtual)} nos anos finais e ${pctFluxo(em.pAtual)} no ensino médio; ` +
      `a aprendizagem média (N) foi ${nFmt(af.nAtual)} e ${nFmt(em.nAtual)} (escala 0–10).`,
  ];

  return {
    regional: dados.regional,
    municipios,
    totalEscolas,
    geradoEm: dados.geradoEm,
    tituloExecutivo,
    leituraExecutiva,
    etapas,
  };
}
