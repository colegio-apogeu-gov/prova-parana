// =============================================================================
// Geração de insights do ENEM — 100% por regras e cálculos determinísticos.
//
// Espelha idebInsights.ts, adaptado aos dados do ENEM: sem etapas, 5 áreas
// (MT/LC/CN/CH/RD) + média geral, e médias de grupo PONDERADAS pelo nº de
// alunos válidos (como no restante do sistema ENEM — mediaPonderada).
//
// NÃO usa IA nem aleatoriedade — mesma entrada, mesma saída.
//
// Regras aplicadas:
//  - Nunca inventar informação; dado ausente vira "sem registro".
//  - Ausência de dado NÃO é tratada como zero.
//  - Não calcular variação quando um dos períodos está sem registro.
//  - Escolas sem dado não entram nas médias de grupo.
//  - Sem adjetivos de valor ("excelente", "péssimo", etc.).
//  - Todo insight expõe os valores que o originaram e os registros usados.
// =============================================================================

import { EnemResultado, EnemArea } from '../types';

// ---------------------------------------------------------------------------
// Constantes ENEM (reutilizadas pelo relatório).
// ---------------------------------------------------------------------------
export const AREAS_5: { key: Exclude<EnemArea, 'media'>; label: string; short: string; field: keyof EnemResultado }[] = [
  { key: 'mt', label: 'Matemática', short: 'Matemática', field: 'mt' },
  { key: 'lc', label: 'Linguagens', short: 'Linguagens', field: 'lc' },
  { key: 'cn', label: 'Ciências da Natureza', short: 'Ciências', field: 'cn' },
  { key: 'ch', label: 'Ciências Humanas', short: 'Humanas', field: 'ch' },
  { key: 'rd', label: 'Redação', short: 'Redação', field: 'rd' },
];

// Referência nacional por área (valor fixo do INEP, usado no dashboard ENEM).
// É uma referência divulgada — sempre rotulada como tal, nunca como dado da escola.
export const MEDIA_NACIONAL: Record<Exclude<EnemArea, 'media'> | 'media', number> = {
  media: 541.6, mt: 525.9, lc: 534.8, cn: 499.0, ch: 513.6, rd: 634.8,
};

// Limiar de diferença relevante entre médias (em pontos ENEM).
export const LIMIAR_VARIACAO = 1; // |Δ| ≥ 1 ponto → variação; senão "estável"

export const SEM_REGISTRO = 'sem registro';

export type InsightTipo =
  | 'evolucao'
  | 'area'
  | 'redacao'
  | 'participacao'
  | 'posicionamento';

export interface Insight {
  tipo: InsightTipo;
  titulo: string;
  descricao: string;
  escolaId: string;   // código INEP
  registrosUtilizados: string[];
}

export interface DadosEnemInsights {
  inep: string;
  data: EnemResultado[];   // todas as escolas, todas as edições (base completa carregada)
  anos: string[];          // edições disponíveis, ascendente
}

// ---------------------------------------------------------------------------
// Formatação (pt-BR, determinística)
// ---------------------------------------------------------------------------
const ehNumero = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);
const arred = (v: number, dec: number): number => Number(v.toFixed(dec));

const n1 = (v: number | null | undefined): string =>
  ehNumero(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : SEM_REGISTRO;
const int = (v: number | null | undefined): string =>
  ehNumero(v) ? v.toLocaleString('pt-BR') : SEM_REGISTRO;
const sinal1 = (v: number): string => `${v >= 0 ? '+' : '−'}${n1(Math.abs(v))}`;

// ---------------------------------------------------------------------------
// Cálculos de conjunto
// ---------------------------------------------------------------------------
const areaField = (area: EnemArea): keyof EnemResultado =>
  (AREAS_5.find((a) => a.key === area)?.field ?? 'media');

const areaValue = (r: EnemResultado, area: EnemArea): number | null => {
  const v = area === 'media' ? r.media : r[areaField(area)];
  return ehNumero(v) ? (v as number) : null;
};

// Média PONDERADA pelo nº de alunos válidos (escolas sem valor não entram).
const mediaPonderada = (rows: EnemResultado[], area: EnemArea): { media: number | null; n: number; alunos: number } => {
  let soma = 0, alunos = 0, n = 0;
  rows.forEach((r) => {
    const v = areaValue(r, area);
    if (v !== null) { soma += v * (r.alunos || 0); alunos += r.alunos || 0; n += 1; }
  });
  return { media: alunos > 0 ? soma / alunos : null, n, alunos };
};

// Posição por média geral decrescente; empates na mesma posição.
const posicaoNoGrupo = (
  rows: EnemResultado[],
  inep: string
): { pos: number; total: number; valor: number } | null => {
  const comValor = rows.filter((r) => ehNumero(r.media));
  const esc = comValor.find((r) => r.inep_codigo === inep);
  if (!esc || !ehNumero(esc.media)) return null;
  const v = esc.media as number;
  const melhores = comValor.filter((r) => (r.media as number) > v).length;
  return { pos: melhores + 1, total: comValor.length, valor: v };
};

// ---------------------------------------------------------------------------
// Rastreabilidade
// ---------------------------------------------------------------------------
const refLinha = (inep: string, ano: string, campos: string): string =>
  `enem_resultados[inep=${inep}, ano=${ano}].${campos}`;
const refGrupo = (ano: string, criterio: string, n: number): string =>
  `enem_resultados[ano=${ano}, ${criterio}, media≠nulo] (n=${n}, ponderada por alunos)`;

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------
export function gerarInsightsEnem(dados: DadosEnemInsights): Insight[] {
  const { inep, data, anos } = dados;
  const out: Insight[] = [];
  const anoAtual = anos[anos.length - 1] ?? null;
  const anoAnterior = anos[anos.length - 2] ?? null;

  const linhasEscola = data.filter((r) => r.inep_codigo === inep);
  const escAtual = anoAtual ? linhasEscola.find((r) => r.ano === anoAtual) ?? null : null;
  const escAnt = anoAnterior ? linhasEscola.find((r) => r.ano === anoAnterior) ?? null : null;
  const baseAtual = anoAtual ? data.filter((r) => r.ano === anoAtual) : [];

  const base0 = (tipo: InsightTipo, titulo: string): Omit<Insight, 'descricao' | 'registrosUtilizados'> => ({
    tipo, titulo, escolaId: inep,
  });

  // ---- 1) Evolução da média geral ----
  {
    const atual = escAtual?.media ?? null;
    const anterior = escAnt?.media ?? null;
    const regs: string[] = [];
    if (ehNumero(atual) && anoAtual) regs.push(refLinha(inep, anoAtual, 'media'));
    if (ehNumero(anterior) && anoAnterior) regs.push(refLinha(inep, anoAnterior, 'media'));

    let descricao: string;
    if (!ehNumero(atual)) {
      const compl = ehNumero(anterior) ? ` Registro anterior (${anoAnterior}): ${n1(anterior)}.` : '';
      descricao = `A média geral do ENEM em ${anoAtual ?? SEM_REGISTRO}: ${SEM_REGISTRO}.${compl}`;
    } else if (!ehNumero(anterior)) {
      descricao =
        `A média geral do ENEM em ${anoAtual} foi ${n1(atual)}. ` +
        `Edição anterior (${anoAnterior ?? SEM_REGISTRO}): ${SEM_REGISTRO}; variação não calculada.`;
    } else {
      const a = arred(atual, 1);
      const b = arred(anterior, 1);
      const d = arred(a - b, 1);
      if (Math.abs(d) >= LIMIAR_VARIACAO) {
        const verbo = d > 0 ? 'aumentou' : 'diminuiu';
        descricao =
          `A média geral do ENEM ${verbo} ${n1(Math.abs(d))} ponto(s), passando de ${n1(b)} em ${anoAnterior} ` +
          `para ${n1(a)} em ${anoAtual} (variação de ${sinal1(d)}).`;
      } else {
        descricao =
          `A média geral do ENEM manteve-se estável entre ${anoAnterior} (${n1(b)}) e ${anoAtual} (${n1(a)}) ` +
          `(variação de ${sinal1(d)}).`;
      }
    }
    out.push({ ...base0('evolucao', 'Média geral — evolução'), descricao, registrosUtilizados: regs });
  }

  // ---- 2) Histórico da média geral ----
  {
    const ordenadas = [...linhasEscola].sort((a, b) => a.ano.localeCompare(b.ano));
    const comValor = ordenadas.filter((r) => ehNumero(r.media));
    if (comValor.length > 0) {
      const partes = comValor.map((r) => `${r.ano}: ${n1(r.media)}`);
      out.push({
        ...base0('evolucao', 'Média geral — histórico'),
        descricao: `Histórico da média geral do ENEM por edição — ${partes.join('; ')}.`,
        registrosUtilizados: comValor.map((r) => refLinha(inep, r.ano, 'media')),
      });
    }
  }

  // ---- 3) Perfil por área (edição atual) ----
  {
    if (escAtual && anoAtual) {
      const vals = AREAS_5.map((a) => ({ a, v: areaValue(escAtual, a.key) }));
      const comValor = vals.filter((x) => ehNumero(x.v)) as { a: typeof AREAS_5[number]; v: number }[];
      const regs = comValor.map((x) => refLinha(inep, anoAtual, x.a.field as string));
      if (comValor.length === 0) {
        out.push({ ...base0('area', 'Perfil por área'), descricao: `Notas por área em ${anoAtual}: ${SEM_REGISTRO}.`, registrosUtilizados: [] });
      } else {
        const partes = comValor.map((x) => `${x.a.label} ${n1(x.v)}`);
        const maior = comValor.reduce((m, x) => (x.v > m.v ? x : m));
        const menor = comValor.reduce((m, x) => (x.v < m.v ? x : m));
        const extremos = maior.a.key === menor.a.key
          ? ''
          : ` Maior: ${maior.a.label} (${n1(maior.v)}); menor: ${menor.a.label} (${n1(menor.v)}).`;
        out.push({
          ...base0('area', 'Perfil por área'),
          descricao: `Em ${anoAtual}, as notas por área foram — ${partes.join('; ')}.${extremos}`,
          registrosUtilizados: regs,
        });
      }
    }
  }

  // ---- 4) Redação ----
  {
    const atual = escAtual?.rd ?? null;
    const anterior = escAnt?.rd ?? null;
    const regs: string[] = [];
    if (ehNumero(atual) && anoAtual) regs.push(refLinha(inep, anoAtual, 'rd'));
    if (ehNumero(anterior) && anoAnterior) regs.push(refLinha(inep, anoAnterior, 'rd'));
    let descricao: string;
    if (!ehNumero(atual) && !ehNumero(anterior)) {
      descricao = `Nota de Redação: ${SEM_REGISTRO}.`;
    } else if (!ehNumero(anterior)) {
      descricao = `A nota de Redação em ${anoAtual} foi ${n1(atual)}. Edição anterior (${anoAnterior ?? SEM_REGISTRO}): ${SEM_REGISTRO}; variação não calculada.`;
    } else if (!ehNumero(atual)) {
      descricao = `A nota de Redação em ${anoAtual ?? SEM_REGISTRO}: ${SEM_REGISTRO}. Registro anterior (${anoAnterior}): ${n1(anterior)}.`;
    } else {
      const d = arred(arred(atual, 1) - arred(anterior, 1), 1);
      descricao = `A nota de Redação passou de ${n1(anterior)} em ${anoAnterior} para ${n1(atual)} em ${anoAtual} (variação de ${sinal1(d)}).`;
    }
    out.push({ ...base0('redacao', 'Redação'), descricao, registrosUtilizados: regs });
  }

  // ---- 5) Participação (alunos válidos) ----
  {
    const atual = escAtual?.alunos ?? null;
    const anterior = escAnt?.alunos ?? null;
    const partAtual = escAtual?.participantes ?? null;
    const regs: string[] = [];
    if (ehNumero(atual) && anoAtual) regs.push(refLinha(inep, anoAtual, 'alunos'));
    if (ehNumero(anterior) && anoAnterior) regs.push(refLinha(inep, anoAnterior, 'alunos'));
    let descricao: string;
    if (!ehNumero(atual)) {
      descricao = `Nº de alunos válidos para a média em ${anoAtual ?? SEM_REGISTRO}: ${SEM_REGISTRO}.`;
    } else {
      const complPart = ehNumero(partAtual) ? ` Participantes inscritos presentes: ${int(partAtual)}.` : '';
      if (!ehNumero(anterior)) {
        descricao = `Em ${anoAtual}, ${int(atual)} aluno(s) entraram no cálculo da média.${complPart} Edição anterior (${anoAnterior ?? SEM_REGISTRO}): ${SEM_REGISTRO}; variação não calculada.`;
      } else {
        const d = atual - anterior;
        descricao = `O nº de alunos válidos passou de ${int(anterior)} em ${anoAnterior} para ${int(atual)} em ${anoAtual} (variação de ${d >= 0 ? '+' : '−'}${int(Math.abs(d))}).${complPart}`;
      }
    }
    out.push({ ...base0('participacao', 'Participação'), descricao, registrosUtilizados: regs });
  }

  // ---- 6) Comparação e rankings (edição atual) ----
  {
    const mediaEsc = escAtual?.media ?? null;
    if (!ehNumero(mediaEsc) || !anoAtual) {
      out.push({
        ...base0('posicionamento', 'Comparação e rankings'),
        descricao: `Sem média registrada em ${anoAtual ?? SEM_REGISTRO}; comparações e rankings não calculados.`,
        registrosUtilizados: [],
      });
    } else {
      const cidade = escAtual?.cidade ?? null;
      const gApg = baseAtual.filter((r) => r.is_apogeu);
      const gCidade = cidade ? baseAtual.filter((r) => r.cidade === cidade && r.uf === 'PR') : [];
      const gPr = baseAtual.filter((r) => r.uf === 'PR');
      const mApg = mediaPonderada(gApg, 'media');
      const mCid = mediaPonderada(gCidade, 'media');
      const mPr = mediaPonderada(gPr, 'media');

      // 6a) Comparação de médias (ponderadas) + referência nacional.
      {
        const partes: string[] = [
          `grupo APG ${mApg.media === null ? SEM_REGISTRO : n1(mApg.media)} (n=${mApg.n})`,
          `rede pública do município${cidade ? ` (${cidade})` : ''} ${mCid.media === null ? SEM_REGISTRO : n1(mCid.media)} (n=${mCid.n})`,
          `escolas do Paraná ${mPr.media === null ? SEM_REGISTRO : n1(mPr.media)} (n=${mPr.n})`,
          `referência nacional ${n1(MEDIA_NACIONAL.media)}`,
        ];
        const regs: string[] = [refLinha(inep, anoAtual, 'media')];
        if (mApg.n > 0) regs.push(refGrupo(anoAtual, 'is_apogeu=verdadeiro', mApg.n));
        if (mCid.n > 0) regs.push(refGrupo(anoAtual, `cidade=${cidade}, uf=PR`, mCid.n));
        if (mPr.n > 0) regs.push(refGrupo(anoAtual, 'uf=PR', mPr.n));
        out.push({
          ...base0('posicionamento', 'Comparação com referências'),
          descricao:
            `Em ${anoAtual}, a média geral da escola foi ${n1(mediaEsc)}. ` +
            `Referências (médias ponderadas por alunos) — ${partes.join('; ')}.`,
          registrosUtilizados: regs,
        });
      }

      // 6b/c/d) Rankings por média geral.
      const rankBloco = (rows: EnemResultado[], titulo: string, criterio: string, sufixo: string) => {
        const rk = posicaoNoGrupo(rows, inep);
        if (rk) {
          out.push({
            ...base0('posicionamento', titulo),
            descricao: `Em ${anoAtual}, a escola ocupa a ${rk.pos}ª posição entre ${rk.total} ${sufixo} (média ${n1(rk.valor)}).`,
            registrosUtilizados: [refGrupo(anoAtual!, criterio, rk.total)],
          });
        }
      };
      rankBloco(gApg, 'Ranking — grupo APG', 'is_apogeu=verdadeiro', 'escolas APG com média disponível');
      if (cidade) rankBloco(gCidade, 'Ranking — município', `cidade=${cidade}, uf=PR`, `escolas de ${cidade} com média disponível`);
      rankBloco(gPr, 'Ranking — Paraná', 'uf=PR', 'escolas do Paraná com média disponível');
    }
  }

  // ---- 7) Área de maior oportunidade (edição atual) ----
  {
    if (escAtual && anoAtual) {
      const gApg = baseAtual.filter((r) => r.is_apogeu);
      const gaps = AREAS_5.map((a) => {
        const v = areaValue(escAtual, a.key);
        const m = mediaPonderada(gApg, a.key).media;
        return { a, v, m, gap: ehNumero(v) && ehNumero(m) ? m - v : null };
      }).filter((x) => ehNumero(x.gap)) as { a: typeof AREAS_5[number]; v: number; m: number; gap: number }[];
      const abaixo = gaps.filter((x) => x.gap > 0).sort((a, b) => b.gap - a.gap);
      if (abaixo.length > 0) {
        const top = abaixo[0];
        out.push({
          ...base0('area', 'Área de maior oportunidade'),
          descricao:
            `Em ${anoAtual}, a maior distância abaixo da média do grupo APG está em ${top.a.label}: ` +
            `escola ${n1(top.v)} × APG ${n1(top.m)} (diferença de ${n1(top.gap)} ponto(s)).`,
          registrosUtilizados: [refLinha(inep, anoAtual, top.a.field as string), refGrupo(anoAtual, `is_apogeu=verdadeiro, área=${top.a.key}`, gApg.filter((r) => ehNumero(areaValue(r, top.a.key))).length)],
        });
      } else if (gaps.length > 0) {
        out.push({
          ...base0('area', 'Área de maior oportunidade'),
          descricao: `Em ${anoAtual}, a escola está igual ou acima da média do grupo APG em todas as áreas com registro.`,
          registrosUtilizados: gaps.map((x) => refLinha(inep, anoAtual, x.a.field as string)),
        });
      }
    }
  }

  return out;
}
