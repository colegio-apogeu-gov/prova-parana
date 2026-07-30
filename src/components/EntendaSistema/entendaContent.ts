// Conteúdo da aba "Entenda o Sistema", por sistema do Radar APG.
//
// Este arquivo é a ÚNICA fonte do texto exibido no modal de ajuda. Para
// replicar/ajustar o conteúdo de um sistema, edite o objeto correspondente em
// ENTENDA. Para publicar os materiais informativos, basta preencher o array
// `materiais` de cada sistema com { label, descricao?, url }.

export type EntendaSystemKey = 'prova-parana' | 'parceiro' | 'parana-mais' | 'enem';

export interface MaterialLink {
  label: string;
  descricao?: string;
  url: string;
}

export interface EntendaItem {
  nome: string;
  desc: string;
}

export interface EntendaConteudo {
  titulo: string;
  publico: string;
  resumo: string;
  abas: EntendaItem[];
  indicadores: EntendaItem[];
  filtros: string[];
  particularidades: string[];
  materiais: MaterialLink[];
}

// Materiais comuns a todos os sistemas (vídeo e material de explicação geral).
const MATERIAIS_GERAIS: MaterialLink[] = [
  {
    label: 'Vídeo explicativo do sistema',
    descricao: 'Apresentação do Radar APG como um todo',
    url: 'https://drive.google.com/file/d/14FvdOE4fft4XVk3SqQBVPmFNh9Theonq/view?usp=sharing',
  },
  {
    label: 'Material de explicação do sistema',
    descricao: 'Guia do Radar APG como um todo',
    url: 'https://drive.google.com/file/d/1zjFGDhlBcA6p6E_aGGaB6l0OVZCOyv3W/view?usp=sharing',
  },
];

export const ENTENDA: Record<EntendaSystemKey, EntendaConteudo> = {
  'prova-parana': {
    titulo: 'Prova Paraná Recomposição',
    publico: '9º, 6º e 3º ano · Língua Portuguesa e Matemática',
    resumo:
      'Painel para acompanhar o desempenho dos estudantes na Prova Paraná Recomposição. ' +
      'Reúne os resultados por aluno, turma, componente e habilidade, ajudando a identificar ' +
      'as fragilidades de aprendizagem e a direcionar o reforço.',
    abas: [
      { nome: 'Dashboard', desc: 'visão principal com indicadores, gráficos, salas de aula e a lista de alunos com desempenho por habilidade.' },
      { nome: 'Gráficos', desc: 'conjunto de gráficos para analisar o desempenho por ano, componente, nível, habilidade, turma e participação.' },
      { nome: 'Comparação Semestres', desc: 'compara o 1º e o 2º semestre para medir a evolução de cada aluno e habilidade.' },
      { nome: 'Comparação Anual', desc: 'compara o desempenho médio entre dois anos de prova diferentes.' },
      { nome: 'Descritores', desc: 'cadastro dos descritores (código e descrição de cada habilidade) usados nas análises.' },
    ],
    indicadores: [
      { nome: 'Total de Alunos e Alunos Avaliados', desc: 'quantos estudantes existem e quantos efetivamente fizeram a prova.' },
      { nome: 'Taxa de Participação', desc: 'percentual de alunos avaliados sobre o total.' },
      { nome: 'Distribuição por nível de aprendizagem', desc: 'quantos alunos estão em cada nível.' },
      { nome: 'Desempenho por habilidade', desc: 'percentual médio de acertos em cada habilidade avaliada.' },
      { nome: 'Salas de aula', desc: 'agrupe alunos em turmas, filtre por nível/componente/habilidade, veja a média por disciplina, registre o professor responsável e gere insights com IA em PDF.' },
    ],
    filtros: ['Aluno', 'Unidade', 'Ano Prova', 'Ano Escolar', 'Componente', 'Semestre', 'Nível de Aprendizagem', 'Habilidade'],
    particularidades: [
      'É o único sistema com a aba "Comparação Semestres" (1º vs 2º semestre).',
      'O desempenho é classificado por "Nível de Aprendizagem".',
    ],
    materiais: MATERIAIS_GERAIS,
  },

  'parana-mais': {
    titulo: 'Paraná Mais',
    publico: '9º e 3º ano · Língua Portuguesa e Matemática',
    resumo:
      'Painel de acompanhamento do Paraná Mais, avaliação complementar de desempenho. ' +
      'Organiza os resultados por aluno, turma, componente e habilidade, no mesmo padrão de ' +
      'análise dos demais sistemas do Radar APG.',
    abas: [
      { nome: 'Dashboard', desc: 'visão principal com indicadores, gráficos, salas de aula e a lista de alunos com desempenho por habilidade.' },
      { nome: 'Gráficos', desc: 'gráficos de desempenho por ano, componente, nível, habilidade, turma e participação.' },
      { nome: 'Comparação Anual', desc: 'compara o desempenho médio entre dois anos de prova diferentes.' },
      { nome: 'Descritores', desc: 'cadastro dos descritores (código e descrição de cada habilidade) usados nas análises.' },
    ],
    indicadores: [
      { nome: 'Total de Alunos e Alunos Avaliados', desc: 'quantos estudantes existem e quantos fizeram a avaliação.' },
      { nome: 'Taxa de Participação', desc: 'percentual de alunos avaliados sobre o total.' },
      { nome: 'Distribuição por nível de aprendizagem', desc: 'quantos alunos estão em cada nível.' },
      { nome: 'Desempenho por habilidade', desc: 'percentual médio de acertos em cada habilidade avaliada.' },
      { nome: 'Salas de aula', desc: 'agrupe alunos em turmas, filtre por nível/componente/habilidade, veja a média por disciplina, registre o professor responsável e gere insights com IA em PDF.' },
    ],
    filtros: ['Aluno', 'Unidade', 'Ano Prova', 'Ano Escolar', 'Componente', 'Semestre', 'Nível de Aprendizagem', 'Habilidade'],
    particularidades: [
      'Atende 9º e 3º ano.',
      'O desempenho é classificado por "Nível de Aprendizagem".',
      'Não possui a aba "Comparação Semestres".',
    ],
    materiais: MATERIAIS_GERAIS,
  },

  parceiro: {
    titulo: 'Avaliação Parceiro da Escola',
    publico: '1º, 2º, 3º, 6º, 7º, 8º e 9º ano · Língua Portuguesa e Matemática',
    resumo:
      'Painel da Avaliação Parceiro da Escola, com análise detalhada do desempenho por aluno, ' +
      'turma, componente e habilidade. Abrange a maior faixa de anos escolares entre os sistemas.',
    abas: [
      { nome: 'Dashboard', desc: 'visão principal com indicadores, gráficos, salas de aula e a lista de alunos com desempenho por habilidade.' },
      { nome: 'Gráficos', desc: 'gráficos de desempenho por ano, componente, padrão de desempenho, habilidade, turma e participação.' },
      { nome: 'Comparação Anual', desc: 'compara o desempenho médio entre dois anos de prova diferentes.' },
      { nome: 'Descritores', desc: 'cadastro dos descritores (código e descrição de cada habilidade) usados nas análises.' },
    ],
    indicadores: [
      { nome: 'Total de Alunos e Alunos Avaliados', desc: 'quantos estudantes existem e quantos fizeram a avaliação.' },
      { nome: 'Taxa de Participação', desc: 'percentual de alunos avaliados sobre o total.' },
      { nome: 'Distribuição por padrão de desempenho', desc: 'quantos alunos estão em cada padrão.' },
      { nome: 'Desempenho por habilidade', desc: 'percentual médio de acertos em cada habilidade avaliada.' },
      { nome: 'Salas de aula', desc: 'agrupe alunos em turmas, filtre por padrão/componente/habilidade, veja a média por disciplina, registre o professor responsável e gere insights com IA em PDF.' },
    ],
    filtros: ['Aluno', 'Unidade', 'Ano Prova', 'Ano Escolar', 'Componente', 'Semestre', 'Padrão de Desempenho', 'Habilidade'],
    particularidades: [
      'É o sistema com a maior faixa de anos: 1º, 2º, 3º, 6º, 7º, 8º e 9º ano.',
      'O desempenho é classificado por "Padrão de Desempenho" (em vez de "Nível de Aprendizagem").',
      'Não possui a aba "Comparação Semestres".',
    ],
    materiais: MATERIAIS_GERAIS,
  },

  enem: {
    titulo: 'ENEM APG',
    publico: 'Grupo Apogeu e rede pública do PR · MT, LC, CN, CH e Redação',
    resumo:
      'Painel do ENEM focado no ranking e no desempenho das escolas do grupo Apogeu, com ' +
      'comparação frente à rede pública do Paraná. Analisa as médias por área de conhecimento ' +
      '(Matemática, Linguagens, Ciências da Natureza, Ciências Humanas e Redação).',
    abas: [
      { nome: 'Dashboard', desc: 'ranking das escolas, médias por área, gráfico de radar e mapa do Paraná com a distribuição do grupo.' },
      { nome: 'Consolidado APG-Salta-Tom', desc: 'comparação entre os grupos parceiros (Apogeu, Salta e Tom).' },
      { nome: 'Histórico', desc: 'evolução do desempenho ao longo dos anos.' },
    ],
    indicadores: [
      { nome: 'Média ponderada por área', desc: 'média por área de conhecimento, ponderada pelo número de participantes.' },
      { nome: 'Ranking de escolas', desc: 'posição das escolas do grupo Apogeu e da rede pública.' },
      { nome: 'Radar por área', desc: 'compara o desempenho nas cinco provas de uma só vez.' },
      { nome: 'Mapa do Paraná', desc: 'distribuição geográfica das escolas do grupo por cidade.' },
    ],
    filtros: ['Ano', 'Busca por escola', 'Regional', 'Cidade', 'Área de conhecimento', 'Escopo (grupo Apogeu ou toda a rede pública)'],
    particularidades: [
      'É um painel próprio, em tela cheia, separado das abas dos demais sistemas.',
      'Compara os grupos parceiros Apogeu, Salta e Tom, sempre destacando as escolas do grupo Apogeu.',
      'Trabalha com dados públicos de toda a rede estadual do Paraná como referência.',
    ],
    materiais: MATERIAIS_GERAIS,
  },
};
