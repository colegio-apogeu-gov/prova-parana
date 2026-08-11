// =============================================================================
// Geração de insights do IDEB — 100% por regras e cálculos determinísticos.
//
// NÃO usa IA, API externa nem aleatoriedade. Dado o mesmo conjunto de registros,
// a saída é sempre idêntica. Todo insight é rastreável aos registros usados no
// cálculo (campo `registrosUtilizados`) e sempre expõe os valores que o
// originaram (na `descricao`).
//
// Regras aplicadas:
//  - Nunca inventar informação; dado ausente vira "sem registro".
//  - Ausência de dado NÃO é tratada como zero.
//  - Não calcular comparação/variação quando um dos períodos está sem registro.
//  - Escolas sem dado não entram nas médias (média simples dos que têm valor).
//  - Cálculos sempre separados por etapa de ensino.
//  - Sem adjetivos de valor ("excelente", "péssimo", etc.).
// =============================================================================

import { IdebResultado, IdebEtapa } from '../types';

// ---------------------------------------------------------------------------
// Limiares de classificação (centralizados). Ajuste aqui para recalibrar.
// ---------------------------------------------------------------------------
export const LIMIAR_EVOLUCAO = 0.1;          // Δ IDEB ≥ +0,1 ponto → evolução
export const LIMIAR_REGRESSAO = -0.1;        // Δ IDEB ≤ -0,1 ponto → regressão
export const LIMIAR_RENDIMENTO_ALTO = 0.98;  // Fluxo P (0..1) ≥ 0,98 → rendimento alto

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
  escolaId: string;   // código INEP da escola
  etapa: string;      // 'anos_finais' | 'ensino_medio'
  registrosUtilizados: string[];
}

// Dados de UMA etapa, já buscados do banco pela camada de UI (esta função é pura).
export interface DadosComparacaoEtapa {
  etapa: IdebEtapa;
  anoAtual: string | null;        // edição mais recente disponível na base desta etapa
  anoAnterior: string | null;     // edição imediatamente anterior na sequência de edições
  linhasEscola: IdebResultado[];  // linhas da escola nesta etapa (todas as edições)
  base: IdebResultado[];          // todas as escolas do PR nesta etapa, na edição atual
}

export interface DadosEscolaInsights {
  inep: string;
  etapas: DadosComparacaoEtapa[];
}

// ---------------------------------------------------------------------------
// Formatação (pt-BR, determinística)
// ---------------------------------------------------------------------------
const ehNumero = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);

// Arredonda para a casa de exibição. As variações/diferenças são calculadas a
// partir dos valores JÁ arredondados, para que a aritmética mostrada feche
// (ex.: 279,0 − 277,6 = 1,4, e não 1,33 exibido como "1,3" ao lado de 279,0).
const arred = (v: number, dec: number): number => Number(v.toFixed(dec));

const n1 = (v: number | null | undefined): string =>
  ehNumero(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : SEM_REGISTRO;

const n2 = (v: number | null | undefined): string =>
  ehNumero(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : SEM_REGISTRO;

// Fluxo P vem em 0..1; exibe em %.
const pctFluxo = (v: number | null | undefined): string =>
  ehNumero(v) ? `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : SEM_REGISTRO;

// Aprovação já vem em % (0..100).
const pctAprov = (v: number | null | undefined): string =>
  ehNumero(v) ? `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : SEM_REGISTRO;

// Formata um número que JÁ está em pontos percentuais (ex.: 99.2 → "99,2%").
const pctNum = (v: number): string =>
  `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const sinal1 = (v: number): string => `${v >= 0 ? '+' : '−'}${n1(Math.abs(v))}`;
const sinal2 = (v: number): string => `${v >= 0 ? '+' : '−'}${n2(Math.abs(v))}`;
const sinalPP = (v: number): string =>
  `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

// Concordância de artigo por etapa ("anos finais" é plural; "ensino médio" singular).
const deEtapa = (e: string): string => (e === 'ensino_medio' ? 'do ensino médio' : 'dos anos finais');
const emEtapa = (e: string): string => (e === 'ensino_medio' ? 'no ensino médio' : 'nos anos finais');
const EmEtapa = (e: string): string => (e === 'ensino_medio' ? 'No ensino médio' : 'Nos anos finais');

// ---------------------------------------------------------------------------
// Referências de registros (rastreabilidade)
// ---------------------------------------------------------------------------
const refLinha = (inep: string, etapa: string, ano: string, campos: string): string =>
  `ideb_resultados[inep=${inep}, etapa=${etapa}, ano=${ano}].${campos}`;

const refGrupo = (etapa: string, ano: string, criterio: string, n: number): string =>
  `ideb_resultados[etapa=${etapa}, ano=${ano}, ${criterio}, ideb≠nulo] (n=${n})`;

// ---------------------------------------------------------------------------
// Cálculos de conjunto (médias e rankings) — escolas sem valor não entram.
// ---------------------------------------------------------------------------
const valoresCampo = (rows: IdebResultado[], campo: keyof IdebResultado): number[] =>
  rows.map((r) => r[campo]).filter(ehNumero) as number[];

const mediaCampo = (rows: IdebResultado[], campo: keyof IdebResultado): { media: number | null; n: number } => {
  const vs = valoresCampo(rows, campo);
  return vs.length ? { media: vs.reduce((a, b) => a + b, 0) / vs.length, n: vs.length } : { media: null, n: 0 };
};

// Posição por IDEB decrescente. Empates recebem a mesma posição
// (pos = 1 + nº de escolas com IDEB estritamente maior).
const posicaoNoGrupo = (
  rows: IdebResultado[],
  inep: string
): { pos: number; total: number; valor: number } | null => {
  const comValor = rows.filter((r) => ehNumero(r.ideb));
  const esc = comValor.find((r) => r.inep_codigo === inep);
  if (!esc || !ehNumero(esc.ideb)) return null;
  const v = esc.ideb;
  const melhores = comValor.filter((r) => (r.ideb as number) > v).length;
  return { pos: melhores + 1, total: comValor.length, valor: v };
};

// ---------------------------------------------------------------------------
// Insights por etapa
// ---------------------------------------------------------------------------
function insightsDaEtapa(inep: string, dados: DadosComparacaoEtapa): Insight[] {
  const { etapa, anoAtual, anoAnterior, linhasEscola, base } = dados;
  const out: Insight[] = [];

  const escAtual = anoAtual ? linhasEscola.find((r) => r.ano === anoAtual) ?? null : null;
  const escAnt = anoAnterior ? linhasEscola.find((r) => r.ano === anoAnterior) ?? null : null;

  const base0 = (tipo: InsightTipo, titulo: string): Omit<Insight, 'descricao' | 'registrosUtilizados'> => ({
    tipo, titulo, escolaId: inep, etapa,
  });

  // ---- 1) Evolução do IDEB (atual x edição anterior) ----
  {
    const atual = escAtual?.ideb ?? null;
    const anterior = escAnt?.ideb ?? null;
    const regs: string[] = [];
    if (ehNumero(atual) && anoAtual) regs.push(refLinha(inep, etapa, anoAtual, 'ideb'));
    if (ehNumero(anterior) && anoAnterior) regs.push(refLinha(inep, etapa, anoAnterior, 'ideb'));

    let descricao: string;
    if (!ehNumero(atual)) {
      // Se houver registro anterior, expõe o valor (o registro consta em `regs`).
      const compl = ehNumero(anterior) ? ` Registro anterior (${anoAnterior}): ${n1(anterior)}.` : '';
      descricao = `O IDEB ${deEtapa(etapa)} em ${anoAtual ?? SEM_REGISTRO}: ${SEM_REGISTRO}.${compl}`;
    } else if (!ehNumero(anterior)) {
      descricao =
        `O IDEB ${deEtapa(etapa)} em ${anoAtual} foi ${n1(atual)}. ` +
        `Edição anterior (${anoAnterior ?? SEM_REGISTRO}): ${SEM_REGISTRO}; variação não calculada.`;
    } else {
      const a = arred(atual, 1);
      const b = arred(anterior, 1);
      const d = arred(a - b, 1);
      if (d >= LIMIAR_EVOLUCAO) {
        descricao =
          `O IDEB ${deEtapa(etapa)} aumentou ${n1(Math.abs(d))} ponto, passando de ${n1(b)} em ${anoAnterior} ` +
          `para ${n1(a)} em ${anoAtual} (variação de ${sinal1(d)}).`;
      } else if (d <= LIMIAR_REGRESSAO) {
        descricao =
          `O IDEB ${deEtapa(etapa)} diminuiu ${n1(Math.abs(d))} ponto, passando de ${n1(b)} em ${anoAnterior} ` +
          `para ${n1(a)} em ${anoAtual} (variação de ${sinal1(d)}).`;
      } else {
        descricao =
          `O IDEB ${deEtapa(etapa)} manteve-se estável entre ${anoAnterior} (${n1(b)}) ` +
          `e ${anoAtual} (${n1(a)}) (variação de ${sinal1(d)}).`;
      }
    }
    out.push({ ...base0('evolucao', 'IDEB — evolução'), descricao, registrosUtilizados: regs });
  }

  // ---- 2) Histórico do IDEB (todas as edições com registro) ----
  {
    const linhasOrdenadas = [...linhasEscola].sort((a, b) => a.ano.localeCompare(b.ano));
    const comValor = linhasOrdenadas.filter((r) => ehNumero(r.ideb));
    if (comValor.length > 0) {
      const partes = comValor.map((r) => `${r.ano}: ${n1(r.ideb)}`);
      const descricao = `Histórico do IDEB ${deEtapa(etapa)} por edição — ${partes.join('; ')}.`;
      const regs = comValor.map((r) => refLinha(inep, etapa, r.ano, 'ideb'));
      out.push({ ...base0('evolucao', 'IDEB — histórico'), descricao, registrosUtilizados: regs });
    }
  }

  // ---- 3) Rendimento (P = fluxo) ----
  {
    const atual = escAtual?.fluxo ?? null;
    const anterior = escAnt?.fluxo ?? null;
    const regs: string[] = [];
    if (ehNumero(atual) && anoAtual) regs.push(refLinha(inep, etapa, anoAtual, 'fluxo'));
    if (ehNumero(anterior) && anoAnterior) regs.push(refLinha(inep, etapa, anoAnterior, 'fluxo'));

    let descricao: string;
    if (!ehNumero(atual) && !ehNumero(anterior)) {
      descricao = `Indicador de rendimento (P) ${deEtapa(etapa)}: ${SEM_REGISTRO}.`;
    } else if (!ehNumero(anterior)) {
      descricao =
        `O indicador de rendimento (P) ${deEtapa(etapa)} em ${anoAtual} foi ${pctFluxo(atual)}. ` +
        `Edição anterior (${anoAnterior ?? SEM_REGISTRO}): ${SEM_REGISTRO}; variação não calculada.`;
    } else if (!ehNumero(atual)) {
      descricao =
        `O indicador de rendimento (P) ${deEtapa(etapa)} em ${anoAtual ?? SEM_REGISTRO}: ${SEM_REGISTRO}. ` +
        `Registro anterior (${anoAnterior}): ${pctFluxo(anterior)}.`;
    } else {
      const pAtual = arred(atual * 100, 1);
      const pAnt = arred(anterior * 100, 1);
      const dpp = arred(pAtual - pAnt, 1);
      descricao =
        `O indicador de rendimento (P) ${deEtapa(etapa)} passou de ${pctNum(pAnt)} em ${anoAnterior} ` +
        `para ${pctNum(pAtual)} em ${anoAtual} (variação de ${sinalPP(dpp)} p.p.).`;
    }
    out.push({ ...base0('rendimento', 'Rendimento (P)'), descricao, registrosUtilizados: regs });

    // Sinalização objetiva de rendimento alto (sem adjetivos).
    if (ehNumero(atual) && atual >= LIMIAR_RENDIMENTO_ALTO && anoAtual) {
      out.push({
        ...base0('rendimento', 'Rendimento (P) — nível alto'),
        descricao:
          `O rendimento (P) ${deEtapa(etapa)} em ${anoAtual} foi ${pctFluxo(atual)}, ` +
          `igual ou acima de ${pctFluxo(LIMIAR_RENDIMENTO_ALTO)}.`,
        registrosUtilizados: [refLinha(inep, etapa, anoAtual, 'fluxo')],
      });
    }
  }

  // ---- 4) Aprendizagem (N) ----
  {
    const atual = escAtual?.aprendizado ?? null;
    const anterior = escAnt?.aprendizado ?? null;
    const regs: string[] = [];
    if (ehNumero(atual) && anoAtual) regs.push(refLinha(inep, etapa, anoAtual, 'aprendizado'));
    if (ehNumero(anterior) && anoAnterior) regs.push(refLinha(inep, etapa, anoAnterior, 'aprendizado'));

    let descricao: string;
    if (!ehNumero(atual) && !ehNumero(anterior)) {
      descricao = `Aprendizagem (N) ${deEtapa(etapa)}: ${SEM_REGISTRO}.`;
    } else if (!ehNumero(anterior)) {
      descricao =
        `A aprendizagem (N) ${deEtapa(etapa)} em ${anoAtual} foi ${n2(atual)} (escala 0–10). ` +
        `Edição anterior (${anoAnterior ?? SEM_REGISTRO}): ${SEM_REGISTRO}; variação não calculada.`;
    } else if (!ehNumero(atual)) {
      descricao =
        `A aprendizagem (N) ${deEtapa(etapa)} em ${anoAtual ?? SEM_REGISTRO}: ${SEM_REGISTRO}. ` +
        `Registro anterior (${anoAnterior}): ${n2(anterior)}.`;
    } else {
      const a = arred(atual, 2);
      const b = arred(anterior, 2);
      const d = arred(a - b, 2);
      descricao =
        `A aprendizagem (N) ${deEtapa(etapa)} passou de ${n2(b)} em ${anoAnterior} ` +
        `para ${n2(a)} em ${anoAtual} (variação de ${sinal2(d)}, escala 0–10).`;
    }
    out.push({ ...base0('aprendizagem', 'Aprendizagem (N)'), descricao, registrosUtilizados: regs });
  }

  // ---- 5) SAEB: Matemática e Língua Portuguesa (edição atual) ----
  {
    const mt = escAtual?.saeb_mt ?? null;
    const lp = escAtual?.saeb_lp ?? null;
    const regs: string[] = [];
    if (ehNumero(mt) && anoAtual) regs.push(refLinha(inep, etapa, anoAtual, 'saeb_mt'));
    if (ehNumero(lp) && anoAtual) regs.push(refLinha(inep, etapa, anoAtual, 'saeb_lp'));

    let descricao: string;
    if (!ehNumero(mt) && !ehNumero(lp)) {
      descricao = `Notas SAEB ${deEtapa(etapa)} em ${anoAtual ?? SEM_REGISTRO}: ${SEM_REGISTRO}.`;
    } else if (!ehNumero(mt) || !ehNumero(lp)) {
      descricao =
        `Em ${anoAtual}, ${emEtapa(etapa)}: Matemática ${n1(mt)} e Língua Portuguesa ${n1(lp)} ` +
        `(comparação entre componentes não calculada por falta de registro).`;
    } else {
      const rmt = arred(mt, 1);
      const rlp = arred(lp, 1);
      const d = arred(rmt - rlp, 1);
      if (d === 0) {
        descricao =
          `Em ${anoAtual}, ${emEtapa(etapa)}, Matemática e Língua Portuguesa tiveram o mesmo resultado (${n1(rmt)}).`;
      } else {
        const rel = d > 0 ? 'acima de' : 'abaixo de';
        descricao =
          `Em ${anoAtual}, ${emEtapa(etapa)}, Matemática (${n1(rmt)}) apresentou resultado ${n1(Math.abs(d))} ponto ${rel} ` +
          `Língua Portuguesa (${n1(rlp)}).`;
      }
    }
    out.push({ ...base0('aprendizagem', 'SAEB — Matemática e Língua Portuguesa'), descricao, registrosUtilizados: regs });
  }

  // ---- 6) Aprovação (total da etapa) ----
  {
    const atual = escAtual?.aprovacao ?? null;
    const anterior = escAnt?.aprovacao ?? null;
    const regs: string[] = [];
    if (ehNumero(atual) && anoAtual) regs.push(refLinha(inep, etapa, anoAtual, 'aprovacao'));
    if (ehNumero(anterior) && anoAnterior) regs.push(refLinha(inep, etapa, anoAnterior, 'aprovacao'));

    let base: string;
    if (!ehNumero(atual) && !ehNumero(anterior)) {
      base = `Taxa de aprovação total ${deEtapa(etapa)}: ${SEM_REGISTRO}.`;
    } else if (!ehNumero(anterior)) {
      base = `A taxa de aprovação total ${deEtapa(etapa)} em ${anoAtual} foi ${pctAprov(atual)}. ` +
        `Edição anterior (${anoAnterior ?? SEM_REGISTRO}): ${SEM_REGISTRO}; variação não calculada.`;
    } else if (!ehNumero(atual)) {
      base = `A taxa de aprovação total ${deEtapa(etapa)} em ${anoAtual ?? SEM_REGISTRO}: ${SEM_REGISTRO}. ` +
        `Registro anterior (${anoAnterior}): ${pctAprov(anterior)}.`;
    } else {
      const a = arred(atual, 1);
      const b = arred(anterior, 1);
      const dpp = arred(a - b, 1);
      base = `A taxa de aprovação total ${deEtapa(etapa)} passou de ${pctAprov(b)} em ${anoAnterior} ` +
        `para ${pctAprov(a)} em ${anoAtual} (variação de ${sinalPP(dpp)} p.p.).`;
    }
    // A base do IDEB traz apenas a aprovação TOTAL da etapa (não por série).
    const descricao = `${base} Aprovação por série: ${SEM_REGISTRO} (a fonte traz apenas a taxa total da etapa).`;
    out.push({ ...base0('aprovacao', 'Aprovação'), descricao, registrosUtilizados: regs });
  }

  // ---- 7) Posicionamento: comparações e rankings (edição atual) ----
  {
    const idebEsc = escAtual?.ideb ?? null;
    if (!ehNumero(idebEsc) || !anoAtual) {
      out.push({
        ...base0('posicionamento', 'Comparação e rankings'),
        descricao: `Sem IDEB registrado ${emEtapa(etapa)} em ${anoAtual ?? SEM_REGISTRO}; comparações e rankings não calculados.`,
        registrosUtilizados: [],
      });
    } else {
      const cidade = escAtual?.cidade ?? null;
      const regional = escAtual?.regional ?? null;

      const gApg = base.filter((r) => r.is_apogeu);
      const gRegional = regional ? base.filter((r) => r.regional === regional) : [];
      const gMunEstadual = cidade ? base.filter((r) => r.cidade === cidade && r.rede === 'Estadual') : [];
      const gPrEstadual = base.filter((r) => r.rede === 'Estadual');

      const mApg = mediaCampo(gApg, 'ideb');
      const mReg = mediaCampo(gRegional, 'ideb');
      const mMun = mediaCampo(gMunEstadual, 'ideb');
      const mPr = mediaCampo(gPrEstadual, 'ideb');

      // 7a) Comparação de médias (só grupos com registro entram).
      {
        const partes: string[] = [];
        const regs: string[] = [refLinha(inep, etapa, anoAtual, 'ideb')];
        partes.push(`grupo APG ${mApg.media === null ? SEM_REGISTRO : n1(mApg.media)} (n=${mApg.n})`);
        if (mApg.n > 0) regs.push(refGrupo(etapa, anoAtual, 'is_apogeu=verdadeiro', mApg.n));
        if (regional) {
          partes.push(`regional ${regional} ${mReg.media === null ? SEM_REGISTRO : n1(mReg.media)} (n=${mReg.n})`);
          if (mReg.n > 0) regs.push(refGrupo(etapa, anoAtual, `regional=${regional}`, mReg.n));
        } else {
          partes.push(`regional ${SEM_REGISTRO}`);
        }
        partes.push(`rede estadual do município${cidade ? ` (${cidade})` : ''} ${mMun.media === null ? SEM_REGISTRO : n1(mMun.media)} (n=${mMun.n})`);
        if (mMun.n > 0) regs.push(refGrupo(etapa, anoAtual, `rede=Estadual, cidade=${cidade}`, mMun.n));
        partes.push(`rede estadual do Paraná ${mPr.media === null ? SEM_REGISTRO : n1(mPr.media)} (n=${mPr.n})`);
        if (mPr.n > 0) regs.push(refGrupo(etapa, anoAtual, 'rede=Estadual', mPr.n));

        const descricao =
          `${EmEtapa(etapa)}, em ${anoAtual}, o IDEB da escola foi ${n1(idebEsc)}. ` +
          `Médias simples de referência — ${partes.join('; ')}.`;
        out.push({ ...base0('posicionamento', 'Comparação com referências'), descricao, registrosUtilizados: regs });
      }

      // 7b) Ranking no grupo APG.
      {
        const rk = posicaoNoGrupo(gApg, inep);
        if (rk) {
          out.push({
            ...base0('posicionamento', 'Ranking — grupo APG'),
            descricao:
              `${EmEtapa(etapa)}, em ${anoAtual}, a escola ocupa a ${rk.pos}ª posição entre ${rk.total} ` +
              `escolas APG com IDEB disponível (IDEB ${n1(rk.valor)}).`,
            registrosUtilizados: [refGrupo(etapa, anoAtual, 'is_apogeu=verdadeiro', rk.total)],
          });
        }
      }

      // 7c) Ranking na rede estadual do município.
      {
        const rk = posicaoNoGrupo(gMunEstadual, inep);
        if (rk && cidade) {
          out.push({
            ...base0('posicionamento', 'Ranking — município'),
            descricao:
              `${EmEtapa(etapa)}, em ${anoAtual}, a escola ocupa a ${rk.pos}ª posição entre ${rk.total} ` +
              `escolas estaduais de ${cidade} com IDEB disponível (IDEB ${n1(rk.valor)}).`,
            registrosUtilizados: [refGrupo(etapa, anoAtual, `rede=Estadual, cidade=${cidade}`, rk.total)],
          });
        }
      }

      // 7d) Ranking na rede estadual do Paraná.
      {
        const rk = posicaoNoGrupo(gPrEstadual, inep);
        if (rk) {
          out.push({
            ...base0('posicionamento', 'Ranking — rede estadual do Paraná'),
            descricao:
              `${EmEtapa(etapa)}, em ${anoAtual}, a escola ocupa a ${rk.pos}ª posição entre ${rk.total} ` +
              `escolas estaduais do Paraná com IDEB disponível (IDEB ${n1(rk.valor)}).`,
            registrosUtilizados: [refGrupo(etapa, anoAtual, 'rede=Estadual', rk.total)],
          });
        }
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Função principal: recebe os dados da escola e devolve a lista de insights.
// Determinística: mesma entrada → mesma saída (mesma ordem).
// ---------------------------------------------------------------------------
export function gerarInsights(dados: DadosEscolaInsights): Insight[] {
  const out: Insight[] = [];
  // Ordem fixa das etapas para reprodutibilidade.
  const ordem: IdebEtapa[] = ['anos_finais', 'ensino_medio'];
  const etapasOrdenadas = [...dados.etapas].sort(
    (a, b) => ordem.indexOf(a.etapa) - ordem.indexOf(b.etapa)
  );
  etapasOrdenadas.forEach((et) => {
    out.push(...insightsDaEtapa(dados.inep, et));
  });
  return out;
}
