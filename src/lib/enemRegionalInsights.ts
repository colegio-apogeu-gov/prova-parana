// =============================================================================
// Geração de insights REGIONAIS do ENEM — 100% por regras e cálculos.
//
// Espelha enemInsights.ts, mas o "sujeito" é uma REGIONAL (SJP/GUA/CWT): cada
// indicador é a MÉDIA PONDERADA pelo nº de alunos válidos das escolas da
// regional com valor naquela edição. Determinístico: mesma entrada, mesma saída.
//
// Regras: nunca inventar; dado ausente vira "sem registro"; ausência não é zero;
// escolas sem valor não entram; sem adjetivos de valor; sempre expor valores e
// registros usados.
// =============================================================================

import { EnemResultado, EnemArea } from '../types';
import { AREAS_5, MEDIA_NACIONAL } from './enemInsights';

export const LIMIAR_VARIACAO = 1; // |Δ| ≥ 1 ponto → variação; senão "estável"
export const SEM_REGISTRO = 'sem registro';

export type InsightTipo = 'evolucao' | 'area' | 'redacao' | 'participacao' | 'posicionamento';

export interface Insight {
  tipo: InsightTipo;
  titulo: string;
  descricao: string;
  regionalId: string;
  registrosUtilizados: string[];
}

export interface DadosRegionalEnemInsights {
  regional: string;
  data: EnemResultado[];   // todas as escolas, todas as edições
  anos: string[];          // ascendente
}

const ehNumero = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v);
const arred = (v: number, dec: number): number => Number(v.toFixed(dec));
const n1 = (v: number | null | undefined): string =>
  ehNumero(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : SEM_REGISTRO;
const int = (v: number | null | undefined): string => (ehNumero(v) ? v.toLocaleString('pt-BR') : SEM_REGISTRO);
const sinal1 = (v: number): string => `${v >= 0 ? '+' : '−'}${n1(Math.abs(v))}`;

const areaField = (area: EnemArea): keyof EnemResultado =>
  (AREAS_5.find((a) => a.key === area)?.field ?? 'media');
const areaValue = (r: EnemResultado, area: EnemArea): number | null => {
  const v = area === 'media' ? r.media : r[areaField(area)];
  return ehNumero(v) ? (v as number) : null;
};

// Média ponderada pelo nº de alunos válidos.
const mediaPond = (rows: EnemResultado[], area: EnemArea): { media: number | null; n: number; alunos: number } => {
  let soma = 0, alunos = 0, n = 0;
  rows.forEach((r) => {
    const v = areaValue(r, area);
    if (v !== null) { soma += v * (r.alunos || 0); alunos += r.alunos || 0; n += 1; }
  });
  return { media: alunos > 0 ? soma / alunos : null, n, alunos };
};

// Posição da regional entre as regionais, por média geral ponderada decrescente.
const posicaoEntreRegionais = (
  base: EnemResultado[],
  regional: string
): { pos: number; total: number; valor: number } | null => {
  const codigos = Array.from(new Set(base.map((r) => r.regional).filter(Boolean) as string[]));
  const medias = codigos
    .map((cod) => ({ cod, m: mediaPond(base.filter((r) => r.regional === cod), 'media').media }))
    .filter((x): x is { cod: string; m: number } => ehNumero(x.m));
  const eu = medias.find((x) => x.cod === regional);
  if (!eu) return null;
  const melhores = medias.filter((x) => x.m > eu.m).length;
  return { pos: melhores + 1, total: medias.length, valor: eu.m };
};

const refReg = (regional: string, ano: string, campo: string, n: number): string =>
  `média ponderada de enem_resultados[regional=${regional}, ano=${ano}].${campo} (n=${n})`;
const refGrupo = (ano: string, criterio: string, n: number): string =>
  `enem_resultados[ano=${ano}, ${criterio}, media≠nulo] (n=${n}, ponderada por alunos)`;

// ---------------------------------------------------------------------------
export function gerarInsightsEnemRegional(dados: DadosRegionalEnemInsights): Insight[] {
  const { regional, data, anos } = dados;
  const out: Insight[] = [];
  const anoAtual = anos[anos.length - 1] ?? null;
  const anoAnterior = anos[anos.length - 2] ?? null;

  const linhasReg = data.filter((r) => r.regional === regional);
  const rowsAtual = anoAtual ? linhasReg.filter((r) => r.ano === anoAtual) : [];
  const rowsAnt = anoAnterior ? linhasReg.filter((r) => r.ano === anoAnterior) : [];
  const baseAtual = anoAtual ? data.filter((r) => r.ano === anoAtual) : [];

  const base0 = (tipo: InsightTipo, titulo: string): Omit<Insight, 'descricao' | 'registrosUtilizados'> => ({
    tipo, titulo, regionalId: regional,
  });

  // ---- 1) Evolução da média geral ponderada ----
  {
    const mA = mediaPond(rowsAtual, 'media');
    const mB = mediaPond(rowsAnt, 'media');
    const atual = mA.media, anterior = mB.media;
    const regs: string[] = [];
    if (ehNumero(atual) && anoAtual) regs.push(refReg(regional, anoAtual, 'media', mA.n));
    if (ehNumero(anterior) && anoAnterior) regs.push(refReg(regional, anoAnterior, 'media', mB.n));

    let descricao: string;
    if (!ehNumero(atual)) {
      const compl = ehNumero(anterior) ? ` Média anterior (${anoAnterior}): ${n1(anterior)}.` : '';
      descricao = `A média geral da regional em ${anoAtual ?? SEM_REGISTRO}: ${SEM_REGISTRO}.${compl}`;
    } else if (!ehNumero(anterior)) {
      descricao = `A média geral ponderada da regional em ${anoAtual} foi ${n1(atual)} (${mA.n} escola(s)). Edição anterior (${anoAnterior ?? SEM_REGISTRO}): ${SEM_REGISTRO}; variação não calculada.`;
    } else {
      const a = arred(atual, 1), b = arred(anterior, 1), d = arred(a - b, 1);
      const escopo = `(média ponderada de ${mB.n}→${mA.n} escola(s))`;
      if (Math.abs(d) >= LIMIAR_VARIACAO) {
        const verbo = d > 0 ? 'aumentou' : 'diminuiu';
        descricao = `A média geral da regional ${verbo} ${n1(Math.abs(d))} ponto(s), passando de ${n1(b)} em ${anoAnterior} para ${n1(a)} em ${anoAtual} (variação de ${sinal1(d)}) ${escopo}.`;
      } else {
        descricao = `A média geral da regional manteve-se estável entre ${anoAnterior} (${n1(b)}) e ${anoAtual} (${n1(a)}) (variação de ${sinal1(d)}) ${escopo}.`;
      }
    }
    out.push({ ...base0('evolucao', 'Média geral — evolução'), descricao, registrosUtilizados: regs });
  }

  // ---- 2) Histórico da média geral ponderada ----
  {
    const partes: string[] = [], regs: string[] = [];
    anos.forEach((ano) => {
      const m = mediaPond(linhasReg.filter((r) => r.ano === ano), 'media');
      if (ehNumero(m.media)) { partes.push(`${ano}: ${n1(m.media)} (n=${m.n})`); regs.push(refReg(regional, ano, 'media', m.n)); }
    });
    if (partes.length > 0) {
      out.push({ ...base0('evolucao', 'Média geral — histórico'), descricao: `Histórico da média geral ponderada da regional por edição — ${partes.join('; ')}.`, registrosUtilizados: regs });
    }
  }

  // ---- 3) Perfil por área (edição atual) ----
  {
    if (rowsAtual.length > 0 && anoAtual) {
      const vals = AREAS_5.map((a) => ({ a, m: mediaPond(rowsAtual, a.key) }));
      const comValor = vals.filter((x) => ehNumero(x.m.media)) as { a: typeof AREAS_5[number]; m: { media: number; n: number; alunos: number } }[];
      if (comValor.length === 0) {
        out.push({ ...base0('area', 'Perfil por área'), descricao: `Notas médias por área em ${anoAtual}: ${SEM_REGISTRO}.`, registrosUtilizados: [] });
      } else {
        const partes = comValor.map((x) => `${x.a.label} ${n1(x.m.media)}`);
        const maior = comValor.reduce((mx, x) => (x.m.media > mx.m.media ? x : mx));
        const menor = comValor.reduce((mn, x) => (x.m.media < mn.m.media ? x : mn));
        const extremos = maior.a.key === menor.a.key ? '' : ` Maior: ${maior.a.label} (${n1(maior.m.media)}); menor: ${menor.a.label} (${n1(menor.m.media)}).`;
        out.push({
          ...base0('area', 'Perfil por área'),
          descricao: `Em ${anoAtual}, as notas médias ponderadas por área foram — ${partes.join('; ')}.${extremos}`,
          registrosUtilizados: comValor.map((x) => refReg(regional, anoAtual, x.a.field as string, x.m.n)),
        });
      }
    }
  }

  // ---- 4) Redação ----
  {
    const mA = mediaPond(rowsAtual, 'rd');
    const mB = mediaPond(rowsAnt, 'rd');
    const atual = mA.media, anterior = mB.media;
    const regs: string[] = [];
    if (ehNumero(atual) && anoAtual) regs.push(refReg(regional, anoAtual, 'rd', mA.n));
    if (ehNumero(anterior) && anoAnterior) regs.push(refReg(regional, anoAnterior, 'rd', mB.n));
    let descricao: string;
    if (!ehNumero(atual) && !ehNumero(anterior)) descricao = `Nota média de Redação da regional: ${SEM_REGISTRO}.`;
    else if (!ehNumero(anterior)) descricao = `A nota média de Redação da regional em ${anoAtual} foi ${n1(atual)}. Edição anterior (${anoAnterior ?? SEM_REGISTRO}): ${SEM_REGISTRO}; variação não calculada.`;
    else if (!ehNumero(atual)) descricao = `A nota média de Redação da regional em ${anoAtual ?? SEM_REGISTRO}: ${SEM_REGISTRO}. Registro anterior (${anoAnterior}): ${n1(anterior)}.`;
    else { const d = arred(arred(atual, 1) - arred(anterior, 1), 1); descricao = `A nota média de Redação da regional passou de ${n1(anterior)} em ${anoAnterior} para ${n1(atual)} em ${anoAtual} (variação de ${sinal1(d)}).`; }
    out.push({ ...base0('redacao', 'Redação'), descricao, registrosUtilizados: regs });
  }

  // ---- 5) Participação (alunos válidos da regional) ----
  {
    const somaAtual = rowsAtual.reduce((s, r) => s + (ehNumero(r.alunos) ? r.alunos : 0), 0);
    const somaAnt = rowsAnt.reduce((s, r) => s + (ehNumero(r.alunos) ? r.alunos : 0), 0);
    const escAtual = rowsAtual.filter((r) => ehNumero(r.media)).length;
    const regs: string[] = [];
    if (anoAtual) regs.push(refGrupo(anoAtual, `regional=${regional}`, escAtual));
    let descricao: string;
    if (somaAtual === 0) descricao = `Nº de alunos válidos da regional em ${anoAtual ?? SEM_REGISTRO}: ${SEM_REGISTRO}.`;
    else if (somaAnt === 0) descricao = `Em ${anoAtual}, a regional somou ${int(somaAtual)} aluno(s) válidos (${escAtual} escola(s)). Edição anterior (${anoAnterior ?? SEM_REGISTRO}): ${SEM_REGISTRO}; variação não calculada.`;
    else { const d = somaAtual - somaAnt; descricao = `O nº de alunos válidos da regional passou de ${int(somaAnt)} em ${anoAnterior} para ${int(somaAtual)} em ${anoAtual} (variação de ${d >= 0 ? '+' : '−'}${int(Math.abs(d))}).`; }
    out.push({ ...base0('participacao', 'Participação'), descricao, registrosUtilizados: regs });
  }

  // ---- 6) Comparação e ranking entre regionais ----
  {
    const mReg = mediaPond(rowsAtual, 'media');
    if (!ehNumero(mReg.media) || !anoAtual) {
      out.push({ ...base0('posicionamento', 'Comparação e ranking'), descricao: `Sem média registrada em ${anoAtual ?? SEM_REGISTRO}; comparações e ranking não calculados.`, registrosUtilizados: [] });
    } else {
      const gApg = baseAtual.filter((r) => r.is_apogeu);
      const gPr = baseAtual.filter((r) => r.uf === 'PR');
      const mApg = mediaPond(gApg, 'media');
      const mPr = mediaPond(gPr, 'media');

      // 6a) Comparação de médias.
      {
        const partes = [
          `regional ${regional} ${n1(mReg.media)} (n=${mReg.n})`,
          `grupo APG ${mApg.media === null ? SEM_REGISTRO : n1(mApg.media)} (n=${mApg.n})`,
          `escolas do Paraná ${mPr.media === null ? SEM_REGISTRO : n1(mPr.media)} (n=${mPr.n})`,
          `referência nacional ${n1(MEDIA_NACIONAL.media)}`,
        ];
        const regs = [refReg(regional, anoAtual, 'media', mReg.n)];
        if (mApg.n > 0) regs.push(refGrupo(anoAtual, 'is_apogeu=verdadeiro', mApg.n));
        if (mPr.n > 0) regs.push(refGrupo(anoAtual, 'uf=PR', mPr.n));
        out.push({
          ...base0('posicionamento', 'Comparação com referências'),
          descricao: `Em ${anoAtual}, a média geral ponderada da regional foi ${n1(mReg.media)}. Referências — ${partes.join('; ')}.`,
          registrosUtilizados: regs,
        });
      }

      // 6b) Ranking entre regionais.
      {
        const rk = posicaoEntreRegionais(baseAtual, regional);
        if (rk) {
          out.push({
            ...base0('posicionamento', 'Ranking entre regionais'),
            descricao: `Em ${anoAtual}, a regional ocupa a ${rk.pos}ª posição entre ${rk.total} regionais com média disponível (média ponderada ${n1(rk.valor)}).`,
            registrosUtilizados: [refGrupo(anoAtual, 'agrupado por regional', rk.total)],
          });
        }
      }

      // 6c) Escolas da regional frente à média APG.
      if (ehNumero(mApg.media)) {
        const comMedia = rowsAtual.filter((r) => ehNumero(r.media));
        const acima = comMedia.filter((r) => (r.media as number) >= (mApg.media as number)).length;
        out.push({
          ...base0('posicionamento', 'Escolas frente à média APG'),
          descricao: `Em ${anoAtual}, ${acima} de ${comMedia.length} escola(s) da regional ficaram igual ou acima da média ponderada do grupo APG (${n1(mApg.media)}).`,
          registrosUtilizados: [refGrupo(anoAtual, `regional=${regional}`, comMedia.length), refGrupo(anoAtual, 'is_apogeu=verdadeiro', mApg.n)],
        });
      }

      // 6d) Amplitude interna.
      {
        const comMedia = rowsAtual.filter((r) => ehNumero(r.media)).sort((a, b) => (b.media as number) - (a.media as number));
        if (comMedia.length >= 1) {
          const top = comMedia[0], bot = comMedia[comMedia.length - 1];
          const descricao = comMedia.length === 1
            ? `Em ${anoAtual}, apenas ${top.escola} tem média registrada na regional (${n1(top.media)}).`
            : `Em ${anoAtual}, a maior média da regional é ${n1(top.media)} (${top.escola}) e a menor é ${n1(bot.media)} (${bot.escola}); amplitude de ${n1(arred((top.media as number) - (bot.media as number), 1))} ponto(s).`;
          out.push({ ...base0('posicionamento', 'Amplitude interna'), descricao, registrosUtilizados: comMedia.map((r) => `enem_resultados[inep=${r.inep_codigo}, ano=${anoAtual}].media`) });
        }
      }
    }
  }

  // ---- 7) Área de maior oportunidade ----
  {
    if (rowsAtual.length > 0 && anoAtual) {
      const gApg = baseAtual.filter((r) => r.is_apogeu);
      const gaps = AREAS_5.map((a) => {
        const rReg = mediaPond(rowsAtual, a.key).media;
        const rApg = mediaPond(gApg, a.key).media;
        return { a, rReg, rApg, gap: ehNumero(rReg) && ehNumero(rApg) ? rApg - rReg : null };
      }).filter((x) => ehNumero(x.gap)) as { a: typeof AREAS_5[number]; rReg: number; rApg: number; gap: number }[];
      const abaixo = gaps.filter((x) => x.gap > 0).sort((a, b) => b.gap - a.gap);
      if (abaixo.length > 0) {
        const top = abaixo[0];
        out.push({
          ...base0('area', 'Área de maior oportunidade'),
          descricao: `Em ${anoAtual}, a maior distância abaixo da média do grupo APG está em ${top.a.label}: regional ${n1(top.rReg)} × APG ${n1(top.rApg)} (diferença de ${n1(top.gap)} ponto(s)).`,
          registrosUtilizados: [refReg(regional, anoAtual, top.a.field as string, mediaPond(rowsAtual, top.a.key).n), refGrupo(anoAtual, `is_apogeu=verdadeiro, área=${top.a.key}`, mediaPond(gApg, top.a.key).n)],
        });
      } else if (gaps.length > 0) {
        out.push({
          ...base0('area', 'Área de maior oportunidade'),
          descricao: `Em ${anoAtual}, a regional está igual ou acima da média do grupo APG em todas as áreas com registro.`,
          registrosUtilizados: gaps.map((x) => refReg(regional, anoAtual, x.a.field as string, mediaPond(rowsAtual, x.a.key).n)),
        });
      }
    }
  }

  return out;
}
