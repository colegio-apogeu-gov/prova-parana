// Cores fixas por nível de aprendizagem / padrão de desempenho, usadas nas barras de
// "Distribuição por Padrão de Desempenho / Nível de Aprendizagem" (Dashboard e Gráficos).
// A chave é o nome do nível (normalizado), que é único entre os sistemas:
//   Prova Paraná: Defasagem=vermelho, Aprendizado Intermediário=amarelo, Aprendizado Adequado=verde
//   Paraná Mais / Parceiro: Abaixo do Básico=vermelho, Básico=laranja escuro, Adequado=amarelo, Avançado=verde

const norm = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// Gradientes Tailwind (mantidos como literais completos p/ o scanner não purgar).
const GRAD: Record<string, string> = {
  'abaixo do basico': 'from-red-400 to-red-600',
  defasagem: 'from-red-400 to-red-600',
  basico: 'from-orange-500 to-orange-700',
  'aprendizado intermediario': 'from-yellow-300 to-yellow-500',
  adequado: 'from-yellow-300 to-yellow-500',
  avancado: 'from-green-400 to-green-600',
  'aprendizado adequado': 'from-green-400 to-green-600',
};

const SOLID: Record<string, string> = {
  'abaixo do basico': 'bg-red-500',
  defasagem: 'bg-red-500',
  basico: 'bg-orange-600',
  'aprendizado intermediario': 'bg-yellow-400',
  adequado: 'bg-yellow-400',
  avancado: 'bg-green-500',
  'aprendizado adequado': 'bg-green-500',
};

// Classe de barra (gradiente) para um nível; cinza quando desconhecido (ex.: "-" sem nível).
export const nivelGradient = (nivel: string): string =>
  `bg-gradient-to-r ${GRAD[norm(nivel)] ?? 'from-gray-300 to-gray-400'}`;

// Cor sólida (ex.: para pontinhos de legenda), cinza quando desconhecido.
export const nivelSolid = (nivel: string): string => SOLID[norm(nivel)] ?? 'bg-gray-400';
