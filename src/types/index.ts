// =============================
// index.ts (consolidado)
// =============================

// ---------- Database types (Prova Paraná)
export interface ProvaResultado {
  id: string;
  ano_escolar: '9º ano' | '3º ano';
  componente: 'MT' | 'LP';
  semestre: '1' | '2';
  unidade: string;
  turma: string;
  nome_aluno: string;
  avaliado: boolean;
  nivel_aprendizagem: string;
  habilidade_id: string;
  habilidade_codigo: string;
  descricao_habilidade: string;
  acertos: number;
  total: number;
  percentual: number;
  created_at: string;
}

// ---------- Parceiro system types
export interface ProvaResultadoParceiro {
  id: string;
  ano_escolar: '8º ano' | '2º ano';
  componente: 'MT' | 'LP';
  semestre: '1' | '2';
  unidade: string;
  turma: string;
  nome_aluno: string;
  avaliado: boolean;
  proficiencia: string;
  padrao_desempenho: string;
  habilidade_id: string;
  habilidade_codigo: string;
  descricao_habilidade: string;
  acertos: number;
  total: number;
  percentual: number;
  ano_escolar_resultados: string;
  created_at: string;
}

export interface LinkQuestaoParceiro {
  id: string;
  link: string;
  habilidade_codigo: string;
  componente: 'LP' | 'MT';
  created_at: string;
}

export interface SalaDeAulaParceiro {
  id: string;
  nome: string;
  unidade: string;
  created_at: string;
}

export interface SalaDeAulaAlunoParceiro {
  id: string;
  sala_id: string;
  nome_aluno: string;
  turma: string;
  created_at: string;
}

export interface UploadFormParceiro {
  ano: '8º ano' | '2º ano';
  componente: 'MT' | 'LP';
  semestre: '1' | '2';
  unidade: string;
  file: File | null;
}

export interface UserProfile {
  id: string;
  email: string;
  unidade: string;
  created_at: string;
}

export interface UploadForm {
  ano: '9º ano' | '3º ano';
  componente: 'MT' | 'LP';
  semestre: '1' | '2';
  unidade: string;
  file: File | null;
}

export interface DashboardFilters {
  unidade?: string;
  ano_escolar?: string;
  componente?: string;
  semestre?: string;
  nome_aluno?: string;
  nivel_aprendizagem?: string;
  padrao_desempenho?: string;
  habilidade_codigo?: string;
}

export interface PerformanceInsight {
  total_alunos: number;
  alunos_avaliados: number;
  percentual_participacao: number;
  distribuicao_niveis: Array<{
    nivel: string;
    quantidade: number;
    percentual: number;
  }>;
  performance_habilidades: Array<{
    habilidade_id: string;
    habilidade_codigo: string;
    descricao: string;
    media_acertos: number;
    total_questoes: number;
    percentual_medio: number;
  }>;
}

export interface LinkQuestao {
  id: string;
  link: string;
  habilidade_codigo: string;
  componente: 'LP' | 'MT';
  created_at: string;
}

export interface SalaDeAula {
  id: string;
  nome: string;
  unidade: string;
  created_at: string;
}

export interface SalaDeAulaAluno {
  id: string;
  sala_id: string;
  nome_aluno: string;
  turma: string;
  created_at: string;
}

// ---------- School units
export const UNIDADES_ESCOLARES = [
  'ANITA CANET, C E-EF M P',
  'ANTONIO TUPY PINHEIRO, C E-EF M PROFIS',
  'COSTA VIANA, C E-EF M PROFIS N',
  'CRISTO REI, C E-EF M PROFIS',
  'DECIO DOSSI, C E DR-EF M PROFIS',
  'FRANCISCO C MARTINS, C E-M P',
  'GODOFREDO MACHADO, E E-EF',
  'ISABEL L S SOUZA, C E PROFA-EF M PROFIS',
  'IVO LEAO, C E-EF M',
  'JOAO DE OLIVEIRA FRANCO, C E-EF M',
  'JOAO MAZZAROTTO, C E-EF M',
  'LIANE MARTA DA COSTA, C E-EF M PROFIS',
  'PAULO FREIRE, C E PROF-E F M N',
  'SANTO AGOSTINHO, C E-EF M',
  'TARSILA DO AMARAL, C E-EF M PROFIS',
  'TEREZA DA S RAMOS, C E PROFA-EF M'
] as const;

export const UNIDADE_MAPEADA: Record<(typeof UNIDADES_ESCOLARES)[number], string> = {
  'ANITA CANET, C E-EF M P': 'ANITA CANET C E EF M',
  'ANTONIO TUPY PINHEIRO, C E-EF M PROFIS': 'ANTONIO TUPY PINHEIRO C E EF M',
  'COSTA VIANA, C E-EF M PROFIS N': 'COSTA VIANA C E EF M PROFIS N',
  'CRISTO REI, C E-EF M PROFIS': 'CRISTO REI C E EF M',
  'DECIO DOSSI, C E DR-EF M PROFIS': 'DECIO DOSSI C E DR EF M PROFIS',
  'FRANCISCO C MARTINS, C E-M P': 'FRANCISCO C MARTINS C E EM PROF',
  'GODOFREDO MACHADO, E E-EF': 'GODOFREDO MACHADO E E EF',
  'ISABEL L S SOUZA, C E PROFA-EF M PROFIS': 'ISABEL L S SOUZA C E PROFA EF M',
  'IVO LEAO, C E-EF M': 'IVO LEAO C E EF M',
  'JOAO DE OLIVEIRA FRANCO, C E-EF M': 'JOAO DE OLIVEIRA FRANCO C E EF M',
  'JOAO MAZZAROTTO, C E-EF M': 'JOAO MAZZAROTTO C E EF M',
  'LIANE MARTA DA COSTA, C E-EF M PROFIS': 'LIANE MARTA DA COSTA C E EF M',
  'PAULO FREIRE, C E PROF-E F M N': 'PAULO FREIRE C E PROF E F M N',
  'SANTO AGOSTINHO, C E-EF M': 'SANTO AGOSTINHO C E EF M',
  'TARSILA DO AMARAL, C E-EF M PROFIS': 'TARSILA DO AMARAL C E EF M',
  'TEREZA DA S RAMOS, C E PROFA-EF M': 'TEREZA DA S RAMOS C E PROFA EF M'
};

// ---------- Skills mapping
export const HABILIDADES_3_ANO = {
  LP: {
    H01: { codigo: 'D016_P', descricao: 'Identificar a finalidade de textos de diferentes gêneros.' },
    H02: { codigo: 'D019_P', descricao: 'Reconhecer formas de tratar uma informação na comparação de textos que tratam do mesmo tema.' },
    H03: { codigo: 'D023_P', descricao: 'Inferir informações em textos.' },
    H04: { codigo: 'D024_P', descricao: 'Reconhecer efeito de humor ou de ironia em um texto.' },
    H05: { codigo: 'D027_P', descricao: 'Distinguir ideias centrais de secundárias ou tópicos e subtópicos em um dado gênero textual.' },
    H06: { codigo: 'D032_P', descricao: 'Identificar a tese de um texto.' },
    H07: { codigo: 'D033_P', descricao: 'Reconhecer posições distintas relativas ao mesmo fato ou mesmo tema.' },
    H08: { codigo: 'D037_P', descricao: 'Reconhecer as relações entre partes de um texto, identificando os recursos coesivos.' },
    H09: { codigo: 'D038_P', descricao: 'Distinguir um fato da opinião.' },
    H10: { codigo: 'D039_P', descricao: 'Reconhecer o sentido das relações lógico-discursivas.' },
    H11: { codigo: 'D053_P', descricao: 'Reconhecer o efeito de sentido de uma palavra ou expressão.' },
    H12: { codigo: 'D055_P', descricao: 'Estabelecer relação entre tese e argumentos.' },
    H13: { codigo: 'D061_P', descricao: 'Estabelecer relação causa/consequência.' },
    H14: { codigo: 'D102_P', descricao: 'Exploração de recursos ortográficos e/ou morfossintáticos.' },
    H15: { codigo: 'D103_P', descricao: 'Marcas linguísticas do locutor e interlocutor.' }
  },
  MT: {
    H01: { codigo: 'D021_M', descricao: 'Uso de gráficos/tabelas' },
    H02: { codigo: 'D033_M', descricao: 'Princípio multiplicativo' },
    H03: { codigo: 'D034_M', descricao: 'Probabilidade' },
    H04: { codigo: 'D035_M', descricao: 'Proporcionalidade' },
    H05: { codigo: 'D039_M', descricao: 'Sistema cartesiano' },
    H06: { codigo: 'D042_M', descricao: 'Volume/capacidade' },
    H07: { codigo: 'D043_M', descricao: 'Perímetro' },
    H08: { codigo: 'D064_M', descricao: 'Triângulo retângulo' },
    H09: { codigo: 'D066_M', descricao: 'Análise gráfica de funções' },
    H10: { codigo: 'D070_M', descricao: 'Função do 1º grau' },
    H11: { codigo: 'D074_M', descricao: 'Função do 2º grau (tabela)' },
    H12: { codigo: 'D075_M', descricao: 'Área de sólidos' },
    H13: { codigo: 'D076_M', descricao: 'Função exponencial' },
    H14: { codigo: 'D077_M', descricao: 'Função do 2º grau (problemas)' },
    H15: { codigo: 'D078_M', descricao: 'PA e PG' },
    H16: { codigo: 'D105_M', descricao: 'Equação do 2º grau' },
    H17: { codigo: 'D110_M', descricao: 'Gráficos de funções trigonométricas' },
    H18: { codigo: 'D133_M', descricao: 'Razões trigonométricas' }
  }
} as const;

export const HABILIDADES_9_ANO = {
  LP: {
    H01: { codigo: 'D016_P', descricao: 'Finalidade de textos' },
    H02: { codigo: 'D019_P', descricao: 'Comparação temática' },
    H03: { codigo: 'D022_P', descricao: 'Inferência de palavra ou expressão' },
    H04: { codigo: 'D023_P', descricao: 'Inferência de informações' },
    H05: { codigo: 'D024_P', descricao: 'Humor ou ironia' },
    H06: { codigo: 'D028_P', descricao: 'Assunto do texto' },
    H07: { codigo: 'D030_P', descricao: 'Elementos de narrativa' },
    H08: { codigo: 'D032_P', descricao: 'Tese textual' },
    H09: { codigo: 'D037_P', descricao: 'Coesão textual' },
    H10: { codigo: 'D038_P', descricao: 'Fato x opinião' },
    H11: { codigo: 'D039_P', descricao: 'Relações lógico-discursivas' },
    H12: { codigo: 'D053_P', descricao: 'Escolha de palavras' },
    H13: { codigo: 'D055_P', descricao: 'Argumentação' },
    H14: { codigo: 'D102_P', descricao: 'Recursos morfossintáticos' },
    H15: { codigo: 'D103_P', descricao: 'Locutor e interlocutor' }
  },
  MT: {
    H01: { codigo: 'D020_M', descricao: 'Planificação de sólidos' },
    H02: { codigo: 'D021_M', descricao: 'Gráficos/tabelas' },
    H03: { codigo: 'D025_M', descricao: 'Área de figuras' },
    H04: { codigo: 'D028_M', descricao: 'Frações equivalentes' },
    H05: { codigo: 'D030_M', descricao: 'Unidades de medida' },
    H06: { codigo: 'D033_M', descricao: 'Princípio multiplicativo' },
    H07: { codigo: 'D035_M', descricao: 'Proporcionalidade' },
    H08: { codigo: 'D036_M', descricao: 'Classificação de quadriláteros' },
    H09: { codigo: 'D037_M', descricao: 'Classificação de triângulos' },
    H10: { codigo: 'D038_M', descricao: 'Representação de números racionais' },
    H11: { codigo: 'D042_M', descricao: 'Volume de prismas/cilindros' },
    H12: { codigo: 'D043_M', descricao: 'Perímetro' },
    H13: { codigo: 'D044_M', descricao: 'Porcentagem' },
    H14: { codigo: 'D046_M', descricao: 'Padrões e sequências' },
    H15: { codigo: 'D053_M', descricao: 'Cálculos com reais' },
    H16: { codigo: 'D057_M', descricao: 'Valor numérico de expressões' },
    H17: { codigo: 'D064_M', descricao: 'Triângulo retângulo' },
    H18: { codigo: 'D105_M', descricao: 'Equação do 2º grau' },
    H19: { codigo: 'D128_M', descricao: 'Operações com racionais' },
    H20: { codigo: 'D129_M', descricao: 'Equações e inequações do 1º grau' }
  }
} as const;

// ==================================================
// utils/semester-compare.ts (inline neste index.ts)
// ==================================================
export type ComponenteCodigo = 'MT' | 'LP';

// Tipo base que cobre ambos os sistemas
export interface BaseResultado {
  id: string;
  ano_escolar: string;
  componente: ComponenteCodigo;     // 'MT' (Matemática) | 'LP' (Língua Portuguesa)
  semestre: '1' | '2';
  unidade: string;
  turma: string;
  nome_aluno: string;
  avaliado: boolean;
  // Campos nucleares p/ match:
  habilidade_id?: string | null;
  habilidade_codigo: string;
  descricao_habilidade?: string;
  acertos: number;
  total: number;

  // Campos opcionais:
  nivel_aprendizagem?: string;
  padrao_desempenho?: string;
}

// Interface de saída (para UI)
export interface HabilidadeMatch {
  habilidade_codigo: string;
  descricao?: string;
  s1: { acertos: number; total: number; pct: number } | null;
  s2: { acertos: number; total: number; pct: number } | null;
  deltaPct: number | null; // s2 - s1
  trend: 'up' | 'down' | 'flat' | 'n/a';
}

export interface ComponenteResumo {
  componente: ComponenteCodigo;
  habilidades: HabilidadeMatch[];
  mediaS1: number | null;
  mediaS2: number | null;
  deltaGeral: number | null;
  trendGeral: 'up' | 'down' | 'flat' | 'n/a';
}

export interface AlunoComparativo {
  aluno: string;
  componentes: ComponenteResumo[];
  deltaGeral: number | null;
  trendGeral: 'up' | 'down' | 'flat' | 'n/a';
}

// --- helpers
function pct(acertos: number, total: number) {
  if (!total || total <= 0) return 0;
  return (acertos / total) * 100;
}

function weightedAggregate(
  rows: { acertos: number; total: number }[]
): { acertos: number; total: number; pct: number } {
  const sumAcertos = rows.reduce((s, r) => s + r.acertos, 0);
  const sumTotal = rows.reduce((s, r) => s + r.total, 0);
  return { acertos: sumAcertos, total: sumTotal, pct: pct(sumAcertos, sumTotal) };
}

function trend(delta: number | null): 'up' | 'down' | 'flat' | 'n/a' {
  if (delta === null) return 'n/a';
  if (delta > 0.5) return 'up';
  if (delta < -0.5) return 'down';
  return 'flat';
}

function groupBy<T>(arr: T[], key: (x: T) => string): Record<string, T[]> {
  return arr.reduce((acc, cur) => {
    const k = key(cur);
    (acc[k] ||= []).push(cur);
    return acc;
  }, {} as Record<string, T[]>);
}

// Normaliza para garantir tipo base
export function normalizeResults<T extends BaseResultado>(rows: T[]): BaseResultado[] {
  return rows.map(r => ({
    ...r,
    componente: r.componente as ComponenteCodigo,
    semestre: r.semestre as '1' | '2',
    habilidade_codigo: r.habilidade_codigo,
    acertos: Number(r.acertos ?? 0),
    total: Number(r.total ?? 0),
  }));
}

// Core: constrói comparativos por aluno > componente > match de habilidades
export function buildAlunoComparativos<T extends BaseResultado>(rows: T[]): AlunoComparativo[] {
  const data = normalizeResults(rows).filter(
    r => r.avaliado && (r.semestre === '1' || r.semestre === '2')
  );

  // aluno + componente
  const byAlunoComp = groupBy(
    data,
    r => `${r.nome_aluno}::${r.componente}`
  );

  const alunoMap: Record<string, Record<ComponenteCodigo, ComponenteResumo>> = {};

  Object.entries(byAlunoComp).forEach(([alunoCompKey, registros]) => {
    const [aluno, comp] = alunoCompKey.split('::') as [string, ComponenteCodigo];

    const s1 = registros.filter(r => r.semestre === '1');
    const s2 = registros.filter(r => r.semestre === '2');

    // Index por habilidade
    const byHabS1 = groupBy(s1, r => r.habilidade_codigo);
    const byHabS2 = groupBy(s2, r => r.habilidade_codigo);

    const habilidadesSet = new Set<string>([
      ...Object.keys(byHabS1),
      ...Object.keys(byHabS2),
    ]);

    const habilidades: HabilidadeMatch[] = [];
    habilidadesSet.forEach(hab => {
      const s1Agg = byHabS1[hab]
        ? weightedAggregate(byHabS1[hab].map(r => ({ acertos: r.acertos, total: r.total })))
        : null;

      const s2Agg = byHabS2[hab]
        ? weightedAggregate(byHabS2[hab].map(r => ({ acertos: r.acertos, total: r.total })))
        : null;

      const delta = s1Agg && s2Agg ? (s2Agg.pct - s1Agg.pct) : null;
      const descr =
        (byHabS2[hab]?.[0]?.descricao_habilidade) ??
        (byHabS1[hab]?.[0]?.descricao_habilidade) ??
        undefined;

      habilidades.push({
        habilidade_codigo: hab,
        descricao: descr,
        s1: s1Agg,
        s2: s2Agg,
        deltaPct: delta,
        trend: trend(delta),
      });
    });

    // médias gerais por componente (ponderadas por total)
    const compS1Agg = s1.length
      ? weightedAggregate(s1.map(r => ({ acertos: r.acertos, total: r.total })))
      : null;
    const compS2Agg = s2.length
      ? weightedAggregate(s2.map(r => ({ acertos: r.acertos, total: r.total })))
      : null;

    const deltaGeral = compS1Agg && compS2Agg ? (compS2Agg.pct - compS1Agg.pct) : null;

    const compResumo: ComponenteResumo = {
      componente: comp,
      habilidades: habilidades.sort((a, b) => (a.habilidade_codigo > b.habilidade_codigo ? 1 : -1)),
      mediaS1: compS1Agg?.pct ?? null,
      mediaS2: compS2Agg?.pct ?? null,
      deltaGeral,
      trendGeral: trend(deltaGeral),
    };

    (alunoMap[aluno] ||= {} as any)[comp] = compResumo;
  });

  // Monta saída por aluno
  const comparativos: AlunoComparativo[] = Object.entries(alunoMap).map(([aluno, comps]) => {
    const compList = Object.values(comps);
    // delta geral do aluno = média dos deltas por componente (ignorando n/a)
    const deltas = compList.map(c => c.deltaGeral).filter((d): d is number => d !== null);
    const deltaGeral =
      deltas.length ? deltas.reduce((s, x) => s + x, 0) / deltas.length : null;

    return {
      aluno,
      componentes: compList.sort((a, b) => (a.componente > b.componente ? 1 : -1)),
      deltaGeral,
      trendGeral: trend(deltaGeral),
    };
  });

  return comparativos.sort((a, b) => a.aluno.localeCompare(b.aluno));
}
