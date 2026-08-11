// =============================================================================
// Geração de insights REGIONAIS do IDEB — 100% por regras e cálculos.
//
// Espelha idebInsights.ts, mas o "sujeito" é uma REGIONAL (SJP/GUA/CWT): cada
// indicador é a MÉDIA SIMPLES das escolas da regional com valor naquela
// edição. NÃO usa IA nem aleatoriedade — mesma entrada, mesma saída.
//
// Regras aplicadas:
//  - Nunca inventar informação; dado ausente vira "sem registro".
//  - Ausência de dado NÃO é tratada como zero (escola sem valor não entra na média).
//  - Não calcular variação quando um dos períodos está sem registro.
//  - Cálculos sempre separados por etapa de ensino.
//  - Sem adjetivos de valor ("excelente", "péssimo", etc.).
//  - Todo insight expõe os valores que o originaram e os registros usados.
// =============================================================================

import { IdebResultado, IdebEtapa } from '../types';

// ---------------------------------------------------------------------------
// Limiares (centralizados). Reaproveitam os do relatório individual.
// ---------------------------------------------------------------------------
export const LIMIAR_EVOLUCAO = 0.1;          // Δ IDEB médio ≥ +0,1 → evolução
export const LIMIAR_REGRESSAO = -0.1;        // Δ IDEB médio ≤ -0,1 → regressão
export const LIMIAR_RENDIMENTO_ALTO = 0.98;  // Fluxo P médio (0..1) ≥ 0,98 → alto

export const SEM_REGISTRO = 'sem registro';

export type InsightTipo =
  | 'evolucao'
  | 'aprendizagem'
  | 'rendimento'
  | 'aprovacao'
  | 'posicionamento';

export interface Insight {
  tipo: InsightTipo;
  titulo: string;
  descricao: string;
  regionalId: string;   // código da regional (SJP/GUA/CWT)
  etapa: string;        // 'anos_finais' | 'ensino_medio'
  registrosUtilizados: string[];
}

// Dados de UMA etapa, já buscados pela camada de UI (esta função é pura).
export interface DadosRegionalEtapa {
  etapa: IdebEtapa;
  anoAtual: string | null;
  anoAnterior: string | null;
  linhasRegional: IdebResultado[];  // linhas das escolas da regional nesta etapa (todas as edições)
  base: IdebResultado[];            // todas as escolas do PR nesta etapa, na edição atual
}

export interface DadosRegionalInsights {
  regional: string;
  etapas: DadosRegionalEtapa[];
}

// ---------------------------------------------------------------------------
// Formatação (pt-BR, determinística)
// ---------------------------------------------------------------------------
const ehNumero = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);
const arred = (v: number, dec: number): number => Number(v.toFixed(dec));

const n1 = (v: number | null | undefined): string =>
  ehNumero(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : SEM_REGISTRO;
const n2 = (v: number | null | undefined): string =>
  ehNumero(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : SEM_REGISTRO;
const pctFluxo = (v: number | null | undefined): string =>
  ehNumero(v) ? `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : SEM_REGISTRO;
const pctAprov = (v: number | null | undefined): string =>
  ehNumero(v) ? `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : SEM_REGISTRO;
const pctNum = (v: number): string =>
  `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const sinal1 = (v: number): string => `${v >= 0 ? '+' : '−'}${n1(Math.abs(v))}`;
const sinal2 = (v: number): string => `${v >= 0 ? '+' : '−'}${n2(Math.abs(v))}`;
const sinalPP = (v: number): string =>
  `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

// Concordância de artigo por etapa.
const deEtapa = (e: string): string => (e === 'ensino_medio' ? 'do ensino médio' : 'dos anos finais');
const emEtapa = (e: string): string => (e === 'ensino_medio' ? 'no ensino médio' : 'nos anos finais');
const EmEtapa = (e: string): string => (e === 'ensino_medio' ? 'No ensino médio' : 'Nos anos finais');

// ---------------------------------------------------------------------------
// Rastreabilidade — o "registro" de uma regional é a MÉDIA de um grupo.
// ---------------------------------------------------------------------------
const refReg = (regional: string, etapa: string, ano: string, campo: string, n: number): string =>
  `média de ideb_resultados[regional=${regional}, etapa=${etapa}, ano=${ano}].${campo} (n=${n})`;

const refGrupo = (etapa: string, ano: string, criterio: string, n: number): string =>
  `ideb_resultados[etapa=${etapa}, ano=${ano}, ${criterio}, ideb≠nulo] (n=${n})`;

// ---------------------------------------------------------------------------
// Cálculos de conjunto — escolas sem valor não entram.
// ---------------------------------------------------------------------------
const valoresCampo = (rows: IdebResultado[], campo: keyof IdebResultado): number[] =>
  rows.map((r) => r[campo]).filter(ehNumero) as number[];

const mediaCampo = (rows: IdebResultado[], campo: keyof IdebResultado): { media: number | null; n: number } => {
  const vs = valoresCampo(rows, campo);
  return vs.length ? { media: vs.reduce((a, b) => a + b, 0) / vs.length, n: vs.length } : { media: null, n: 0 };
};

// Posição da regional entre as regionais, por IDEB médio decrescente (empates
// na mesma posição). Devolve também a média usada e o total de regionais.
const posicaoEntreRegionais = (
  base: IdebResultado[],
  regional: string
): { pos: number; total: number; valor: number } | null => {
  const codigos = Array.from(new Set(base.map((r) => r.regional).filter(Boolean) as string[]));
  const medias = codigos
    .map((cod) => ({ cod, m: mediaCampo(base.filter((r) => r.regional === cod), 'ideb').media }))
    .filter((x): x is { cod: string; m: number } => ehNumero(x.m));
  const eu = medias.find((x) => x.cod === regional);
  if (!eu) return null;
  const melhores = medias.filter((x) => x.m > eu.m).length;
  return { pos: melhores + 1, total: medias.length, valor: eu.m };
};

// ---------------------------------------------------------------------------
// Insights por etapa
// ---------------------------------------------------------------------------
function insightsDaEtapa(regional: string, dados: DadosRegionalEtapa): Insight[] {
  const { etapa, anoAtual, anoAnterior, linhasRegional, base } = dados;
  const out: Insight[] = [];

  const rowsAtual = anoAtual ? linhasRegional.filter((r) => r.ano === anoAtual) : [];
  const rowsAnt = anoAnterior ? linhasRegional.filter((r) => r.ano === anoAnterior) : [];

  const base0 = (tipo: InsightTipo, titulo: string): Omit<Insight, 'descricao' | 'registrosUtilizados'> => ({
    tipo, titulo, regionalId: regional, etapa,
  });

  // ---- 1) Evolução do IDEB médio (atual x edição anterior) ----
  {
    const mAtual = mediaCampo(rowsAtual, 'ideb');
    const mAnt = mediaCampo(rowsAnt, 'ideb');
    const atual = mAtual.media;
    const anterior = mAnt.media;
    const regs: string[] = [];
    if (ehNumero(atual) && anoAtual) regs.push(refReg(regional, etapa, anoAtual, 'ideb', mAtual.n));
    if (ehNumero(anterior) && anoAnterior) regs.push(refReg(regional, etapa, anoAnterior, 'ideb', mAnt.n));

    let descricao: string;
    if (!ehNumero(atual)) {
      const compl = ehNumero(anterior) ? ` Média anterior (${anoAnterior}): ${n1(anterior)}.` : '';
      descricao = `O IDEB médio ${deEtapa(etapa)} em ${anoAtual ?? SEM_REGISTRO}: ${SEM_REGISTRO}.${compl}`;
    } else if (!ehNumero(anterior)) {
      descricao =
        `O IDEB médio ${deEtapa(etapa)} em ${anoAtual} foi ${n1(atual)} (${mAtual.n} escola(s) com registro). ` +
        `Edição anterior (${anoAnterior ?? SEM_REGISTRO}): ${SEM_REGISTRO}; variação não calculada.`;
    } else {
      const a = arred(atual, 1);
      const b = arred(anterior, 1);
      const d = arred(a - b, 1);
      const escopo = `(média de ${mAnt.n}→${mAtual.n} escola(s) com registro)`;
      if (d >= LIMIAR_EVOLUCAO) {
        descricao =
          `O IDEB médio ${deEtapa(etapa)} aumentou ${n1(Math.abs(d))} ponto, passando de ${n1(b)} em ${anoAnterior} ` +
          `para ${n1(a)} em ${anoAtual} (variação de ${sinal1(d)}) ${escopo}.`;
      } else if (d <= LIMIAR_REGRESSAO) {
        descricao =
          `O IDEB médio ${deEtapa(etapa)} diminuiu ${n1(Math.abs(d))} ponto, passando de ${n1(b)} em ${anoAnterior} ` +
          `para ${n1(a)} em ${anoAtual} (variação de ${sinal1(d)}) ${escopo}.`;
      } else {
        descricao =
          `O IDEB médio ${deEtapa(etapa)} manteve-se estável entre ${anoAnterior} (${n1(b)}) ` +
          `e ${anoAtual} (${n1(a)}) (variação de ${sinal1(d)}) ${escopo}.`;
      }
    }
    out.push({ ...base0('evolucao', 'IDEB médio — evolução'), descricao, registrosUtilizados: regs });
  }

  // ---- 2) Histórico do IDEB médio (todas as edições com registro) ----
  {
    const anos = Array.from(new Set(linhasRegional.map((r) => r.ano))).sort();
    const partes: string[] = [];
    const regs: string[] = [];
    anos.forEach((ano) => {
      const m = mediaCampo(linhasRegional.filter((r) => r.ano === ano), 'ideb');
      if (ehNumero(m.media)) {
        partes.push(`${ano}: ${n1(m.media)} (n=${m.n})`);
        regs.push(refReg(regional, etapa, ano, 'ideb', m.n));
      }
    });
    if (partes.length > 0) {
      out.push({
        ...base0('evolucao', 'IDEB médio — histórico'),
        descricao: `Histórico do IDEB médio ${deEtapa(etapa)} por edição — ${partes.join('; ')}.`,
        registrosUtilizados: regs,
      });
    }
  }

  // ---- 3) Rendimento médio (P = fluxo) ----
  {
    const mAtual = mediaCampo(rowsAtual, 'fluxo');
    const mAnt = mediaCampo(rowsAnt, 'fluxo');
    const atual = mAtual.media;
    const anterior = mAnt.media;
    const regs: string[] = [];
    if (ehNumero(atual) && anoAtual) regs.push(refReg(regional, etapa, anoAtual, 'fluxo', mAtual.n));
    if (ehNumero(anterior) && anoAnterior) regs.push(refReg(regional, etapa, anoAnterior, 'fluxo', mAnt.n));

    let descricao: string;
    if (!ehNumero(atual) && !ehNumero(anterior)) {
      descricao = `Rendimento médio (P) ${deEtapa(etapa)}: ${SEM_REGISTRO}.`;
    } else if (!ehNumero(anterior)) {
      descricao =
        `O rendimento médio (P) ${deEtapa(etapa)} em ${anoAtual} foi ${pctFluxo(atual)}. ` +
        `Edição anterior (${anoAnterior ?? SEM_REGISTRO}): ${SEM_REGISTRO}; variação não calculada.`;
    } else if (!ehNumero(atual)) {
      descricao =
        `O rendimento médio (P) ${deEtapa(etapa)} em ${anoAtual ?? SEM_REGISTRO}: ${SEM_REGISTRO}. ` +
        `Registro anterior (${anoAnterior}): ${pctFluxo(anterior)}.`;
    } else {
      const pAtual = arred(atual * 100, 1);
      const pAnt = arred(anterior * 100, 1);
      const dpp = arred(pAtual - pAnt, 1);
      descricao =
        `O rendimento médio (P) ${deEtapa(etapa)} passou de ${pctNum(pAnt)} em ${anoAnterior} ` +
        `para ${pctNum(pAtual)} em ${anoAtual} (variação de ${sinalPP(dpp)} p.p.).`;
    }
    out.push({ ...base0('rendimento', 'Rendimento médio (P)'), descricao, registrosUtilizados: regs });

    if (ehNumero(atual) && atual >= LIMIAR_RENDIMENTO_ALTO && anoAtual) {
      out.push({
        ...base0('rendimento', 'Rendimento médio (P) — nível alto'),
        descricao:
          `O rendimento médio (P) ${deEtapa(etapa)} em ${anoAtual} foi ${pctFluxo(atual)}, ` +
          `igual ou acima de ${pctFluxo(LIMIAR_RENDIMENTO_ALTO)}.`,
        registrosUtilizados: [refReg(regional, etapa, anoAtual, 'fluxo', mediaCampo(rowsAtual, 'fluxo').n)],
      });
    }
  }

  // ---- 4) Aprendizagem média (N) ----
  {
    const mAtual = mediaCampo(rowsAtual, 'aprendizado');
    const mAnt = mediaCampo(rowsAnt, 'aprendizado');
    const atual = mAtual.media;
    const anterior = mAnt.media;
    const regs: string[] = [];
    if (ehNumero(atual) && anoAtual) regs.push(refReg(regional, etapa, anoAtual, 'aprendizado', mAtual.n));
    if (ehNumero(anterior) && anoAnterior) regs.push(refReg(regional, etapa, anoAnterior, 'aprendizado', mAnt.n));

    let descricao: string;
    if (!ehNumero(atual) && !ehNumero(anterior)) {
      descricao = `Aprendizagem média (N) ${deEtapa(etapa)}: ${SEM_REGISTRO}.`;
    } else if (!ehNumero(anterior)) {
      descricao =
        `A aprendizagem média (N) ${deEtapa(etapa)} em ${anoAtual} foi ${n2(atual)} (escala 0–10). ` +
        `Edição anterior (${anoAnterior ?? SEM_REGISTRO}): ${SEM_REGISTRO}; variação não calculada.`;
    } else if (!ehNumero(atual)) {
      descricao =
        `A aprendizagem média (N) ${deEtapa(etapa)} em ${anoAtual ?? SEM_REGISTRO}: ${SEM_REGISTRO}. ` +
        `Registro anterior (${anoAnterior}): ${n2(anterior)}.`;
    } else {
      const a = arred(atual, 2);
      const b = arred(anterior, 2);
      const d = arred(a - b, 2);
      descricao =
        `A aprendizagem média (N) ${deEtapa(etapa)} passou de ${n2(b)} em ${anoAnterior} ` +
        `para ${n2(a)} em ${anoAtual} (variação de ${sinal2(d)}, escala 0–10).`;
    }
    out.push({ ...base0('aprendizagem', 'Aprendizagem média (N)'), descricao, registrosUtilizados: regs });
  }

  // ---- 5) SAEB médio: Matemática e Língua Portuguesa (edição atual) ----
  {
    const mMt = mediaCampo(rowsAtual, 'saeb_mt');
    const mLp = mediaCampo(rowsAtual, 'saeb_lp');
    const mt = mMt.media;
    const lp = mLp.media;
    const regs: string[] = [];
    if (ehNumero(mt) && anoAtual) regs.push(refReg(regional, etapa, anoAtual, 'saeb_mt', mMt.n));
    if (ehNumero(lp) && anoAtual) regs.push(refReg(regional, etapa, anoAtual, 'saeb_lp', mLp.n));

    let descricao: string;
    if (!ehNumero(mt) && !ehNumero(lp)) {
      descricao = `Notas SAEB médias ${deEtapa(etapa)} em ${anoAtual ?? SEM_REGISTRO}: ${SEM_REGISTRO}.`;
    } else if (!ehNumero(mt) || !ehNumero(lp)) {
      descricao =
        `Em ${anoAtual}, ${emEtapa(etapa)}: Matemática ${n1(mt)} e Língua Portuguesa ${n1(lp)} (médias da regional; ` +
        `comparação entre componentes não calculada por falta de registro).`;
    } else {
      const rmt = arred(mt, 1);
      const rlp = arred(lp, 1);
      const d = arred(rmt - rlp, 1);
      if (d === 0) {
        descricao =
          `Em ${anoAtual}, ${emEtapa(etapa)}, as médias de Matemática e Língua Portuguesa foram iguais (${n1(rmt)}).`;
      } else {
        const rel = d > 0 ? 'acima da' : 'abaixo da';
        descricao =
          `Em ${anoAtual}, ${emEtapa(etapa)}, a média de Matemática (${n1(rmt)}) ficou ${n1(Math.abs(d))} ponto ${rel} ` +
          `média de Língua Portuguesa (${n1(rlp)}).`;
      }
    }
    out.push({ ...base0('aprendizagem', 'SAEB médio — Matemática e Língua Portuguesa'), descricao, registrosUtilizados: regs });
  }

  // ---- 6) Aprovação média (total da etapa) ----
  {
    const mAtual = mediaCampo(rowsAtual, 'aprovacao');
    const mAnt = mediaCampo(rowsAnt, 'aprovacao');
    const atual = mAtual.media;
    const anterior = mAnt.media;
    const regs: string[] = [];
    if (ehNumero(atual) && anoAtual) regs.push(refReg(regional, etapa, anoAtual, 'aprovacao', mAtual.n));
    if (ehNumero(anterior) && anoAnterior) regs.push(refReg(regional, etapa, anoAnterior, 'aprovacao', mAnt.n));

    let baseTxt: string;
    if (!ehNumero(atual) && !ehNumero(anterior)) {
      baseTxt = `Taxa de aprovação média total ${deEtapa(etapa)}: ${SEM_REGISTRO}.`;
    } else if (!ehNumero(anterior)) {
      baseTxt = `A taxa de aprovação média total ${deEtapa(etapa)} em ${anoAtual} foi ${pctAprov(atual)}. ` +
        `Edição anterior (${anoAnterior ?? SEM_REGISTRO}): ${SEM_REGISTRO}; variação não calculada.`;
    } else if (!ehNumero(atual)) {
      baseTxt = `A taxa de aprovação média total ${deEtapa(etapa)} em ${anoAtual ?? SEM_REGISTRO}: ${SEM_REGISTRO}. ` +
        `Registro anterior (${anoAnterior}): ${pctAprov(anterior)}.`;
    } else {
      const a = arred(atual, 1);
      const b = arred(anterior, 1);
      const dpp = arred(a - b, 1);
      baseTxt = `A taxa de aprovação média total ${deEtapa(etapa)} passou de ${pctAprov(b)} em ${anoAnterior} ` +
        `para ${pctAprov(a)} em ${anoAtual} (variação de ${sinalPP(dpp)} p.p.).`;
    }
    const descricao = `${baseTxt} Aprovação por série: ${SEM_REGISTRO} (a fonte traz apenas a taxa total da etapa).`;
    out.push({ ...base0('aprovacao', 'Aprovação média'), descricao, registrosUtilizados: regs });
  }

  // ---- 7) Posicionamento: comparações e ranking entre regionais (edição atual) ----
  {
    const mReg = mediaCampo(rowsAtual, 'ideb');
    if (!ehNumero(mReg.media) || !anoAtual) {
      out.push({
        ...base0('posicionamento', 'Comparação e ranking'),
        descricao: `Sem IDEB médio ${emEtapa(etapa)} em ${anoAtual ?? SEM_REGISTRO}; comparações e ranking não calculados.`,
        registrosUtilizados: [],
      });
    } else {
      const gApg = base.filter((r) => r.is_apogeu);
      const gPr = base.filter((r) => r.rede === 'Estadual');
      const mApg = mediaCampo(gApg, 'ideb');
      const mPr = mediaCampo(gPr, 'ideb');

      // 7a) Comparação de médias.
      {
        const partes: string[] = [
          `regional ${regional} ${n1(mReg.media)} (n=${mReg.n})`,
          `grupo APG ${mApg.media === null ? SEM_REGISTRO : n1(mApg.media)} (n=${mApg.n})`,
          `rede estadual do Paraná ${mPr.media === null ? SEM_REGISTRO : n1(mPr.media)} (n=${mPr.n})`,
        ];
        const regs: string[] = [refReg(regional, etapa, anoAtual, 'ideb', mReg.n)];
        if (mApg.n > 0) regs.push(refGrupo(etapa, anoAtual, 'is_apogeu=verdadeiro', mApg.n));
        if (mPr.n > 0) regs.push(refGrupo(etapa, anoAtual, 'rede=Estadual', mPr.n));
        out.push({
          ...base0('posicionamento', 'Comparação com referências'),
          descricao:
            `${EmEtapa(etapa)}, em ${anoAtual}, o IDEB médio da regional foi ${n1(mReg.media)}. ` +
            `Médias simples de referência — ${partes.join('; ')}.`,
          registrosUtilizados: regs,
        });
      }

      // 7b) Ranking entre as regionais.
      {
        const rk = posicaoEntreRegionais(base, regional);
        if (rk) {
          out.push({
            ...base0('posicionamento', 'Ranking entre regionais'),
            descricao:
              `${EmEtapa(etapa)}, em ${anoAtual}, a regional ocupa a ${rk.pos}ª posição entre ${rk.total} ` +
              `regionais com IDEB médio disponível (IDEB médio ${n1(rk.valor)}).`,
            registrosUtilizados: [refGrupo(etapa, anoAtual, 'agrupado por regional', rk.total)],
          });
        }
      }

      // 7c) Escolas da regional acima/abaixo da média do grupo APG.
      if (ehNumero(mApg.media)) {
        const comIdeb = rowsAtual.filter((r) => ehNumero(r.ideb));
        const acima = comIdeb.filter((r) => (r.ideb as number) >= (mApg.media as number)).length;
        out.push({
          ...base0('posicionamento', 'Escolas frente à média APG'),
          descricao:
            `${EmEtapa(etapa)}, em ${anoAtual}, ${acima} de ${comIdeb.length} escola(s) da regional com IDEB ` +
            `ficaram igual ou acima da média do grupo APG (${n1(mApg.media)}).`,
          registrosUtilizados: [
            refReg(regional, etapa, anoAtual, 'ideb', comIdeb.length),
            refGrupo(etapa, anoAtual, 'is_apogeu=verdadeiro', mApg.n),
          ],
        });
      }

      // 7d) Amplitude interna: maior e menor IDEB de escola na regional.
      {
        const comIdeb = rowsAtual.filter((r) => ehNumero(r.ideb)).sort((a, b) => (b.ideb as number) - (a.ideb as number));
        if (comIdeb.length >= 1) {
          const top = comIdeb[0];
          const bot = comIdeb[comIdeb.length - 1];
          const descricao = comIdeb.length === 1
            ? `${EmEtapa(etapa)}, em ${anoAtual}, apenas ${top.escola} tem IDEB registrado na regional (${n1(top.ideb)}).`
            : `${EmEtapa(etapa)}, em ${anoAtual}, o maior IDEB da regional é ${n1(top.ideb)} (${top.escola}) e o menor é ` +
              `${n1(bot.ideb)} (${bot.escola}); amplitude de ${n1(arred((top.ideb as number) - (bot.ideb as number), 1))} ponto.`;
          out.push({
            ...base0('posicionamento', 'Amplitude interna'),
            descricao,
            registrosUtilizados: comIdeb.map((r) => `ideb_resultados[inep=${r.inep_codigo}, etapa=${etapa}, ano=${anoAtual}].ideb`),
          });
        }
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Função principal: recebe os dados da regional e devolve a lista de insights.
// Determinística: mesma entrada → mesma saída (mesma ordem).
// ---------------------------------------------------------------------------
export function gerarInsightsRegional(dados: DadosRegionalInsights): Insight[] {
  const out: Insight[] = [];
  const ordem: IdebEtapa[] = ['anos_finais', 'ensino_medio'];
  const etapasOrdenadas = [...dados.etapas].sort(
    (a, b) => ordem.indexOf(a.etapa) - ordem.indexOf(b.etapa)
  );
  etapasOrdenadas.forEach((et) => {
    out.push(...insightsDaEtapa(dados.regional, et));
  });
  return out;
}
