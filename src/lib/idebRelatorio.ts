// =============================================================================
// Monta os dados do "Relatório Individual de Desempenho" do IDEB (exportável em
// PDF). 100% determinístico e por cálculo — reutiliza a mesma lógica dos
// insights (médias simples ignorando nulos; rankings por IDEB decrescente com
// empate na mesma posição; variações a partir de valores arredondados).
//
// Regras herdadas: dado ausente vira null (exibido como "sem registro"); nunca
// tratar ausência como zero; escolas sem dado não entram em médias/contagens.
// =============================================================================

import { IdebResultado, IdebEtapa, IdebAgregadoPR } from '../types';

// Cenário interno de projeção: soma este incremento ao componente N e mantém P.
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

// Ranking por IDEB decrescente; empates na mesma posição.
const ranking = (rows: IdebResultado[], inep: string): { pos: number; total: number } | null => {
  const comValor = rows.filter((r) => ehNumero(r.ideb));
  const esc = comValor.find((r) => r.inep_codigo === inep);
  if (!esc || !ehNumero(esc.ideb)) return null;
  const v = esc.ideb;
  const melhores = comValor.filter((r) => (r.ideb as number) > v).length;
  return { pos: melhores + 1, total: comValor.length };
};

// ---------------------------------------------------------------------------
// Tipos de saída
// ---------------------------------------------------------------------------
export interface PontoSerie { ano: string; escola: number | null; apg: number | null; pr: number | null; }
export interface MediaN { media: number | null; n: number; }
export interface Ranking { pos: number; total: number; }
export interface PontoScatter { p: number; ideb: number; destaque: boolean; }

export interface RelatorioEtapa {
  etapa: IdebEtapa;
  label: string;
  anoAtual: string | null;
  anoAnterior: string | null;
  serie: PontoSerie[];
  idebAtual: number | null;
  idebAnterior: number | null;
  deltaIdeb: number | null;
  aprovacao: number | null;        // % (total da etapa)
  nAtual: number | null;           // aprendizagem N na edição atual
  // "O que explica" (N × P) — valores do ano anterior e atual
  pAnterior: number | null;        // fluxo P (0..1)
  pAtual: number | null;
  nAnterior: number | null;
  // SAEB por componente
  mtAnterior: number | null; lpAnterior: number | null;
  mtAtual: number | null; lpAtual: number | null;
  // Comparações (edição atual)
  compEscola: number | null;
  compApg: MediaN; compMunicipio: MediaN; compPr: MediaN;
  // Rankings (edição atual)
  rankApg: Ranking | null; rankMunicipio: Ranking | null; rankPr: Ranking | null;
  // Quadrante APG (edição atual)
  scatter: PontoScatter[];
  // Cenário interno (projeção)
  cenarioIdeb: number | null;
  // Comparação selecionada pelo usuário (base × comparada) — pode diferir do
  // par anoAnterior→anoAtual acima.
  selBase: string | null;
  selComp: string | null;
  idebSelBase: number | null;
  idebSelComp: number | null;
  deltaSel: number | null;
}

export interface RelatorioIdeb {
  inep: string;
  escola: string;
  cidade: string;
  rede: string | null;
  grupoApg: boolean;
  geradoEm: string;
  tituloExecutivo: string;
  leituraExecutiva: string[];
  etapas: RelatorioEtapa[];
}

export interface DadosRelatorio {
  inep: string;
  hist: IdebResultado[];
  parceiros: IdebResultado[];
  agregado: IdebAgregadoPR[];
  baseAtual: Record<IdebEtapa, IdebResultado[]>;
  edicoes: Record<IdebEtapa, { anoAtual: string | null; anoAnterior: string | null; anos: string[] }>;
  geradoEm: string;
  // Par base × comparada escolhido no Desempenho (opcional). Sem ele, o relatório
  // usa o par padrão anoAnterior→anoAtual.
  base?: string;
  comparada?: string;
}

// ---------------------------------------------------------------------------
function montarEtapa(dados: DadosRelatorio, etapa: IdebEtapa): RelatorioEtapa {
  const { inep, hist, parceiros, agregado, baseAtual, edicoes } = dados;
  const { anoAtual, anoAnterior, anos } = edicoes[etapa];

  const linhas = hist.filter((r) => r.etapa === etapa);
  const escAtual = anoAtual ? linhas.find((r) => r.ano === anoAtual) ?? null : null;
  const escAnt = anoAnterior ? linhas.find((r) => r.ano === anoAnterior) ?? null : null;

  // Série histórica: escola, média APG (is_apogeu) e PR estadual (agregado).
  const serie: PontoSerie[] = anos.map((ano) => {
    const esc = linhas.find((r) => r.ano === ano);
    const apg = media(parceiros.filter((r) => r.etapa === etapa && r.ano === ano && r.is_apogeu), 'ideb').media;
    const pr = agregado.find((a) => a.etapa === etapa && a.ano === ano)?.ideb_estadual ?? null;
    return { ano, escola: esc?.ideb ?? null, apg, pr };
  });

  const idebAtual = escAtual?.ideb ?? null;
  const idebAnterior = escAnt?.ideb ?? null;
  const deltaIdeb =
    ehNumero(idebAtual) && ehNumero(idebAnterior) ? arred(arred(idebAtual, 1) - arred(idebAnterior, 1), 1) : null;

  const base = baseAtual[etapa] ?? [];
  const gApg = base.filter((r) => r.is_apogeu);
  const cidade = escAtual?.cidade ?? linhas[0]?.cidade ?? '';
  const gMun = cidade ? base.filter((r) => r.cidade === cidade && r.rede === 'Estadual') : [];
  const gPr = base.filter((r) => r.rede === 'Estadual');

  const scatter: PontoScatter[] = gApg
    .filter((r) => ehNumero(r.ideb) && ehNumero(r.fluxo))
    .map((r) => ({ p: (r.fluxo as number) * 100, ideb: r.ideb as number, destaque: r.inep_codigo === inep }));

  const nAtual = escAtual?.aprendizado ?? null;
  const pAtual = escAtual?.fluxo ?? null;
  const cenarioIdeb =
    ehNumero(nAtual) && ehNumero(pAtual) ? arred((nAtual + INCREMENTO_N_CENARIO) * pAtual, 1) : null;

  // Comparação selecionada (base × comparada). Fallback = par padrão da etapa.
  const selBase = dados.base ?? anoAnterior;
  const selComp = dados.comparada ?? anoAtual;
  const idebSelBase = selBase ? (linhas.find((r) => r.ano === selBase)?.ideb ?? null) : null;
  const idebSelComp = selComp ? (linhas.find((r) => r.ano === selComp)?.ideb ?? null) : null;
  const deltaSel =
    ehNumero(idebSelBase) && ehNumero(idebSelComp) ? arred(arred(idebSelComp, 1) - arred(idebSelBase, 1), 1) : null;

  return {
    etapa,
    label: rotuloEtapa(etapa),
    anoAtual,
    anoAnterior,
    serie,
    idebAtual,
    idebAnterior,
    deltaIdeb,
    aprovacao: escAtual?.aprovacao ?? null,
    nAtual,
    pAnterior: escAnt?.fluxo ?? null,
    pAtual,
    nAnterior: escAnt?.aprendizado ?? null,
    mtAnterior: escAnt?.saeb_mt ?? null,
    lpAnterior: escAnt?.saeb_lp ?? null,
    mtAtual: escAtual?.saeb_mt ?? null,
    lpAtual: escAtual?.saeb_lp ?? null,
    compEscola: idebAtual,
    compApg: media(gApg, 'ideb'),
    compMunicipio: media(gMun, 'ideb'),
    compPr: media(gPr, 'ideb'),
    rankApg: ranking(gApg, inep),
    rankMunicipio: ranking(gMun, inep),
    rankPr: ranking(gPr, inep),
    scatter,
    cenarioIdeb,
    selBase,
    selComp,
    idebSelBase,
    idebSelComp,
    deltaSel,
  };
}

// Frase da variação para a leitura executiva (factual, sem adjetivo).
const descreveDelta = (d: number | null): string => {
  if (d === null) return 'não calculada (sem registro em um dos anos)';
  const abs = arred(Math.abs(d), 1).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (d > 0) return `+${abs} ponto`;
  if (d < 0) return `−${abs} ponto`;
  return 'estável (0,0 ponto)';
};

export function montarRelatorio(dados: DadosRelatorio): RelatorioIdeb {
  const etapas = ORDEM_ETAPAS.map((e) => montarEtapa(dados, e));
  const af = etapas.find((e) => e.etapa === 'anos_finais')!;
  const em = etapas.find((e) => e.etapa === 'ensino_medio')!;

  const meta = dados.hist[0];
  const grupoApg = dados.hist.some((r) => r.is_apogeu);

  // Título executivo por regra (sem adjetivos de valor).
  let tituloExecutivo: string;
  const subiuAF = af.deltaIdeb !== null && af.deltaIdeb > 0;
  const subiuEM = em.deltaIdeb !== null && em.deltaIdeb > 0;
  if (af.deltaIdeb !== null && em.deltaIdeb !== null) {
    if (subiuAF && subiuEM) tituloExecutivo = 'A escola avançou nas duas etapas';
    else if (!subiuAF && !subiuEM && af.deltaIdeb < 0 && em.deltaIdeb < 0) tituloExecutivo = 'A escola recuou nas duas etapas';
    else tituloExecutivo = 'Resultados distintos entre as etapas';
  } else {
    tituloExecutivo = 'Panorama de desempenho da escola';
  }

  const pctFluxo = (v: number | null): string =>
    ehNumero(v) ? `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : 'sem registro';
  const nFmt = (v: number | null): string =>
    ehNumero(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'sem registro';

  const leituraExecutiva = [
    `O IDEB variou ${descreveDelta(af.deltaIdeb)} nos anos finais e ${descreveDelta(em.deltaIdeb)} no ensino médio ` +
      `(comparação ${af.anoAnterior ?? '—'}→${af.anoAtual ?? '—'} / ${em.anoAnterior ?? '—'}→${em.anoAtual ?? '—'}).`,
    `O rendimento (P) na edição atual foi ${pctFluxo(af.pAtual)} nos anos finais e ${pctFluxo(em.pAtual)} no ensino médio.`,
    `A aprendizagem (N) na edição atual foi ${nFmt(af.nAtual)} nos anos finais e ${nFmt(em.nAtual)} no ensino médio (escala 0–10).`,
  ];
  // Insight adicional: comparação base × comparada escolhida no painel (quando
  // difere do par padrão anoAnterior→anoAtual).
  const parSelDiferente =
    (dados.base && dados.base !== af.anoAnterior) || (dados.comparada && dados.comparada !== af.anoAtual);
  if (parSelDiferente && af.selBase && af.selComp) {
    leituraExecutiva.push(
      `Na comparação selecionada ${af.selBase}→${af.selComp}, o IDEB variou ${descreveDelta(af.deltaSel)} nos anos finais ` +
        `e ${descreveDelta(em.deltaSel)} no ensino médio.`
    );
  }

  return {
    inep: dados.inep,
    escola: meta?.escola ?? '',
    cidade: meta?.cidade ?? '',
    rede: meta?.rede ?? null,
    grupoApg,
    geradoEm: dados.geradoEm,
    tituloExecutivo,
    leituraExecutiva,
    etapas,
  };
}
