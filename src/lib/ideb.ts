import { supabase } from './supabase';
import { IdebResultado, IdebEtapa, IdebIndicador, IdebAgregadoPR } from '../types';

// Os grupos parceiros e o mapa de cidades são exatamente os mesmos do ENEM (as
// escolas são identificadas pelo mesmo código INEP), então reaproveitamos as
// constantes em vez de duplicá-las.
export { PARCEIROS, parceiroLabel, parceiroColor, APG_BLUE, CITY_COORDS, PR_BOUNDS } from './enem';

const PAGE_SIZE = 1000;

// Colunas que o front usa — evita trafegar created_at/uf/regional à toa.
const COLS = 'id,ano,etapa,inep_codigo,escola,cidade,uf,regional,rede,ideb,meta,saeb_mt,saeb_lp,aprendizado,fluxo,aprovacao,parceiro,is_apogeu,posicao_geral,posicao';

// Pagina em blocos porque o PostgREST devolve no máximo 1000 linhas por resposta
// (mesmo problema que o ENEM teve: sem paginar, escolas de posição intermediária somem).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const paginar = async (build: () => any): Promise<IdebResultado[]> => {
  const all: IdebResultado[] = [];
  let page = 0;
  for (;;) {
    const { data, error } = await build().range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    const chunk = (data || []) as IdebResultado[];
    all.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    page++;
  }
  return all;
};

// Escolas do PR de uma etapa numa edição (base do Dashboard e do Consolidado).
// O `id` entra como critério de desempate: sem uma ordem total, o PostgREST pode
// devolver a mesma linha em duas páginas (ou pular outra) entre as requisições.
export const getIdebResultados = async (etapa: IdebEtapa, ano?: string): Promise<IdebResultado[]> =>
  paginar(() => {
    let q = supabase
      .from('ideb_resultados')
      .select(COLS)
      .eq('etapa', etapa)
      .order('posicao_geral', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true });
    if (ano) q = q.eq('ano', ano);
    return q;
  });

// Série histórica das escolas dos grupos parceiros + das que têm regional
// preenchida (~1,7 mil linhas): cobre o agregado "Grupo Apogeu", o filtro por
// regional e a escolha de qualquer escola parceira no Histórico.
// Inclui `regional` porque nem toda escola do grupo APG está marcada com
// parceiro='apg' na base do IDEB (algumas só têm a regional) — sem isso, elas
// sumiriam do recorte por regional.
export const getIdebParceiros = async (): Promise<IdebResultado[]> =>
  paginar(() =>
    supabase
      .from('ideb_resultados')
      .select(COLS)
      .or('parceiro.not.is.null,regional.not.is.null')
      .order('ano', { ascending: true })
      .order('id', { ascending: true })
  );

// Série histórica de uma escola específica (usada quando o usuário escolhe uma
// escola fora dos grupos parceiros no Histórico).
export const getIdebHistoricoEscola = async (inep: string): Promise<IdebResultado[]> => {
  const { data, error } = await supabase
    .from('ideb_resultados')
    .select(COLS)
    .eq('inep_codigo', inep)
    .order('ano', { ascending: true });
  if (error) throw error;
  return (data || []) as IdebResultado[];
};

// Médias do Paraná por etapa/edição (referência das linhas cinzas do Histórico).
export const getIdebAgregadoPR = async (): Promise<IdebAgregadoPR[]> => {
  const { data, error } = await supabase
    .from('ideb_pr_agregado')
    .select('*')
    .order('ano', { ascending: true });
  if (error) throw error;
  return (data || []) as IdebAgregadoPR[];
};

export interface IdebEscolaOpcao {
  inep: string;
  escola: string;
  cidade: string;
  parceiro: string | null;
}

// Busca de escolas no servidor (o Histórico não baixa as ~3,6 mil escolas da base).
// A base tem uma linha por edição, então o resultado é deduplicado por INEP — daí
// pedir mais linhas do que o limite de escolas.
export const buscarEscolasIdeb = async (
  termo: string,
  etapa: IdebEtapa,
  limite = 40
): Promise<IdebEscolaOpcao[]> => {
  const q = termo.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from('ideb_resultados')
    .select('inep_codigo,escola,cidade,parceiro')
    .eq('etapa', etapa)
    .or(`escola.ilike.%${q}%,cidade.ilike.%${q}%`)
    .limit(limite * 12);
  if (error) throw error;
  const rows = (data || []) as { inep_codigo: string; escola: string; cidade: string; parceiro: string | null }[];
  const m = new Map<string, IdebEscolaOpcao>();
  rows.forEach((r) => {
    if (!m.has(r.inep_codigo)) {
      m.set(r.inep_codigo, { inep: r.inep_codigo, escola: r.escola, cidade: r.cidade, parceiro: r.parceiro });
    }
  });
  return Array.from(m.values()).slice(0, limite);
};

// ---- Etapas ----
export const ETAPAS: { key: IdebEtapa; label: string; short: string; anosEscolares: string }[] = [
  { key: 'anos_finais', label: 'Anos Finais (6º ao 9º)', short: 'Anos Finais', anosEscolares: '6º ao 9º ano' },
  { key: 'ensino_medio', label: 'Ensino Médio', short: 'Ensino Médio', anosEscolares: '1ª a 3ª série' },
];
export const etapaLabel = (e: IdebEtapa): string => ETAPAS.find((x) => x.key === e)?.short ?? '--';

// ---- Indicadores (equivalente às áreas do ENEM) ----
// `dec` = casas decimais; `pct` = valor 0..1 exibido como porcentagem;
// `sufixo` = unidade colada no número.
export const IDEB_INDICADORES: {
  key: IdebIndicador;
  label: string;
  short: string;
  field: keyof IdebResultado;
  dec: number;
  pct?: boolean;
  sufixo?: string;
  descricao: string;
}[] = [
  { key: 'ideb', label: 'IDEB', short: 'IDEB', field: 'ideb', dec: 1, descricao: 'nota final do IDEB (Aprendizado x Fluxo), de 0 a 10' },
  { key: 'saeb_mt', label: 'SAEB Matemática', short: 'Matemática', field: 'saeb_mt', dec: 1, descricao: 'proficiência média em Matemática na escala SAEB' },
  { key: 'saeb_lp', label: 'SAEB Língua Portuguesa', short: 'Português', field: 'saeb_lp', dec: 1, descricao: 'proficiência média em Língua Portuguesa na escala SAEB' },
  { key: 'aprendizado', label: 'Aprendizado (N)', short: 'Aprendizado', field: 'aprendizado', dec: 2, descricao: 'nota média padronizada do SAEB, de 0 a 10' },
  { key: 'fluxo', label: 'Fluxo (P)', short: 'Fluxo', field: 'fluxo', dec: 1, pct: true, descricao: 'indicador de rendimento — quanto do fluxo escolar é aprovado' },
  { key: 'aprovacao', label: 'Aprovação', short: 'Aprovação', field: 'aprovacao', dec: 1, sufixo: '%', descricao: 'taxa de aprovação total da etapa' },
];

// Eixos do radar "Perfil da escola" (o IDEB não tem 5 provas como o ENEM, então o
// radar cruza a nota final com seus componentes).
export const IDEB_RADAR: { key: IdebIndicador; label: string; field: keyof IdebResultado }[] = [
  { key: 'ideb', label: 'IDEB', field: 'ideb' },
  { key: 'saeb_mt', label: 'Matemática', field: 'saeb_mt' },
  { key: 'saeb_lp', label: 'Português', field: 'saeb_lp' },
  { key: 'aprendizado', label: 'Aprendizado', field: 'aprendizado' },
  { key: 'fluxo', label: 'Fluxo', field: 'fluxo' },
];

export const indicadorMeta = (ind: IdebIndicador) =>
  IDEB_INDICADORES.find((i) => i.key === ind) ?? IDEB_INDICADORES[0];

export const indicadorLabel = (ind: IdebIndicador): string => indicadorMeta(ind).label;

export const indicadorField = (ind: IdebIndicador): keyof IdebResultado => indicadorMeta(ind).field;

export const indicadorValue = (r: IdebResultado, ind: IdebIndicador): number | null => {
  const v = r[indicadorField(ind)];
  return typeof v === 'number' ? v : null;
};

// Formatação sensível ao indicador (IDEB com 1 casa, SAEB com 1, Fluxo em %...).
export const fmtIndicador = (v: number | null | undefined, ind: IdebIndicador): string => {
  if (v == null || Number.isNaN(v)) return '--';
  const m = indicadorMeta(ind);
  const valor = m.pct ? v * 100 : v;
  const dec = m.pct ? 1 : m.dec;
  return (
    valor.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) +
    (m.pct ? '%' : m.sufixo ?? '')
  );
};

// Igual ao fmtIndicador, mas arredonda PARA CIMA na casa exibida
// (ex.: IDEB 5,034 → 5,1; 5,779 → 5,8). Usado só no card "Média Paraná",
// por decisão de produto. O epsilon evita empurrar um valor já exato na casa
// (ex.: 5,1) para a próxima por erro de ponto flutuante.
export const fmtIndicadorCeil = (v: number | null | undefined, ind: IdebIndicador): string => {
  if (v == null || Number.isNaN(v)) return '--';
  const m = indicadorMeta(ind);
  const valor = m.pct ? v * 100 : v;
  const dec = m.pct ? 1 : m.dec;
  const f = Math.pow(10, dec);
  const arred = Math.ceil(valor * f - 1e-9) / f;
  return (
    arred.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) +
    (m.pct ? '%' : m.sufixo ?? '')
  );
};

// O IDEB não publica número de participantes por escola, então a média do recorte
// é aritmética simples (diferente do ENEM, que pondera pelos alunos).
export const mediaCampo = (rows: IdebResultado[], field: keyof IdebResultado): number | null => {
  let soma = 0;
  let n = 0;
  rows.forEach((r) => {
    const v = r[field];
    if (typeof v === 'number' && !Number.isNaN(v)) {
      soma += v;
      n += 1;
    }
  });
  return n > 0 ? soma / n : null;
};

export const mediaSimples = (rows: IdebResultado[], ind: IdebIndicador): number | null =>
  mediaCampo(rows, indicadorField(ind));

// Escolas do recorte que bateram a meta projetada pelo INEP (só faz sentido nas
// edições em que existe projeção: até 2021).
export const metasAtingidas = (rows: IdebResultado[]): { atingiram: number; comMeta: number } => {
  let atingiram = 0;
  let comMeta = 0;
  rows.forEach((r) => {
    if (r.meta != null && r.ideb != null) {
      comMeta += 1;
      if (r.ideb >= r.meta) atingiram += 1;
    }
  });
  return { atingiram, comMeta };
};

// ---- Referência nacional (INEP, "divulgacao_brasil_ideb_2025") ----
// Médias do Brasil por etapa e edição: `ideb` é a rede total e `idebEstadual` a
// rede estadual (comparação mais justa para as escolas do grupo).
export interface BrasilRef {
  ideb: number | null;
  idebEstadual: number | null;
  saeb_mt: number | null;
  saeb_lp: number | null;
  aprendizado: number | null;
  fluxo: number | null;
}

export const BRASIL_REF: Record<IdebEtapa, Record<string, BrasilRef>> = {
  anos_finais: {
    '2005': { ideb: 3.5, idebEstadual: 3.3, saeb_mt: 239.52, saeb_lp: 231.82, aprendizado: 4.52, fluxo: 0.772 },
    '2007': { ideb: 3.8, idebEstadual: 3.6, saeb_mt: 247.39, saeb_lp: 234.64, aprendizado: 4.7, fluxo: 0.8 },
    '2009': { ideb: 4.0, idebEstadual: 3.8, saeb_mt: 248.74, saeb_lp: 244.01, aprendizado: 4.88, fluxo: 0.815 },
    '2011': { ideb: 4.1, idebEstadual: 3.9, saeb_mt: 252.77, saeb_lp: 245.2, aprendizado: 4.97, fluxo: 0.835 },
    '2013': { ideb: 4.2, idebEstadual: 4.0, saeb_mt: 251.54, saeb_lp: 245.81, aprendizado: 4.96, fluxo: 0.852 },
    '2015': { ideb: 4.5, idebEstadual: 4.2, saeb_mt: 257.73, saeb_lp: 253.5, aprendizado: 5.19, fluxo: 0.858 },
    '2017': { ideb: 4.7, idebEstadual: 4.5, saeb_mt: 260.8, saeb_lp: 260.77, aprendizado: 5.36, fluxo: 0.873 },
    '2019': { ideb: 4.9, idebEstadual: 4.7, saeb_mt: 265.16, saeb_lp: 262.3, aprendizado: 5.46, fluxo: 0.9 },
    '2021': { ideb: 5.1, idebEstadual: 5.0, saeb_mt: 258.59, saeb_lp: 260.41, aprendizado: 5.32, fluxo: 0.957 },
    // A planilha Brasil não traz o IDEB 2023 dos anos finais; recomposto por N x P.
    '2023': { ideb: 5.0, idebEstadual: 4.9, saeb_mt: 258.94, saeb_lp: 260.84, aprendizado: 5.33, fluxo: 0.94 },
    '2025': { ideb: 5.3, idebEstadual: 5.1, saeb_mt: 264.2, saeb_lp: 263.91, aprendizado: 5.47, fluxo: 0.962 },
  },
  ensino_medio: {
    '2017': { ideb: 3.8, idebEstadual: 3.5, saeb_mt: 270.63, saeb_lp: 268.52, aprendizado: 4.51, fluxo: 0.839 },
    '2019': { ideb: 4.2, idebEstadual: 3.9, saeb_mt: 278.53, saeb_lp: 279.53, aprendizado: 4.79, fluxo: 0.871 },
    '2021': { ideb: 4.2, idebEstadual: 3.9, saeb_mt: 270.85, saeb_lp: 275.89, aprendizado: 4.62, fluxo: 0.901 },
    '2023': { ideb: 4.3, idebEstadual: 4.1, saeb_mt: 272.88, saeb_lp: 276.91, aprendizado: 4.67, fluxo: 0.92 },
    '2025': { ideb: 4.5, idebEstadual: 4.3, saeb_mt: 277.72, saeb_lp: 280.49, aprendizado: 4.79, fluxo: 0.948 },
  },
};

// Valor de referência do Brasil para o indicador selecionado (a taxa de aprovação
// não é publicada de forma comparável no arquivo nacional).
export const brasilValor = (etapa: IdebEtapa, ano: string, ind: IdebIndicador): number | null => {
  const ref = BRASIL_REF[etapa]?.[ano];
  if (!ref) return null;
  switch (ind) {
    case 'ideb': return ref.ideb;
    case 'saeb_mt': return ref.saeb_mt;
    case 'saeb_lp': return ref.saeb_lp;
    case 'aprendizado': return ref.aprendizado;
    case 'fluxo': return ref.fluxo;
    default: return null;
  }
};

// Cor de destaque do IDEB (o ENEM usa emerald; o IDEB, violeta).
export const IDEB_ROXO = '#7c3aed';
