import { supabase } from './supabase';
import { EnemResultado, EnemArea, EnemParceiro } from '../types';

// Busca os resultados ENEM (todas as escolas), opcionalmente filtrando por ano.
// Pagina em blocos porque o PostgREST limita cada resposta a 1000 linhas — e a
// base tem ~4 mil escolas/ano. Sem paginar, só as ~1000 de menor posição voltavam
// (as escolas do grupo, de posição intermediária, sumiam do dashboard).
export const getEnemResultados = async (ano?: string): Promise<EnemResultado[]> => {
  const pageSize = 1000;
  const all: EnemResultado[] = [];
  let page = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = supabase
      .from('enem_resultados')
      .select('*')
      .order('ano', { ascending: false })
      .order('posicao_geral', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (ano) q = q.eq('ano', ano);
    const { data, error } = await q;
    if (error) throw error;
    const chunk = (data || []) as EnemResultado[];
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    page++;
  }
  return all;
};

export const getEnemAnos = async (): Promise<string[]> => {
  const { data, error } = await supabase.from('enem_resultados').select('ano').not('ano', 'is', null);
  if (error) throw error;
  return [...new Set((data || []).map((r: any) => r.ano).filter(Boolean) as string[])].sort((a, b) =>
    b.localeCompare(a)
  );
};

// ---- Metadados das áreas ENEM (rótulo, campo e cor do radar) ----
export const ENEM_AREAS: { key: EnemArea; label: string; short: string; field: keyof EnemResultado }[] = [
  { key: 'media', label: 'Média Geral', short: 'Média', field: 'media' },
  { key: 'mt', label: 'Matemática', short: 'Matemática', field: 'mt' },
  { key: 'lc', label: 'Linguagens', short: 'Linguagens', field: 'lc' },
  { key: 'cn', label: 'Ciências da Natureza', short: 'Ciências', field: 'cn' },
  { key: 'ch', label: 'Ciências Humanas', short: 'Humanas', field: 'ch' },
  { key: 'rd', label: 'Redação', short: 'Redação', field: 'rd' },
];

// Áreas exibidas no radar (as 5 provas), na ordem dos vértices.
export const ENEM_RADAR_AREAS: { key: Exclude<EnemArea, 'media'>; label: string; field: keyof EnemResultado }[] = [
  { key: 'mt', label: 'Matemática', field: 'mt' },
  { key: 'lc', label: 'Linguagens', field: 'lc' },
  { key: 'cn', label: 'Ciências', field: 'cn' },
  { key: 'ch', label: 'Humanas', field: 'ch' },
  { key: 'rd', label: 'Redação', field: 'rd' },
];

export const areaField = (area: EnemArea): keyof EnemResultado =>
  (ENEM_AREAS.find((a) => a.key === area)?.field ?? 'media');

export const areaValue = (r: EnemResultado, area: EnemArea): number | null => {
  const v = r[areaField(area)];
  return typeof v === 'number' ? v : null;
};

// ---- Grupos parceiros (empresas mantenedoras) ----
// 'apg' é o nosso grupo — sempre destacado (contorno azul) nas telas.
export const PARCEIROS: { key: EnemParceiro; label: string; color: string }[] = [
  { key: 'apg', label: 'Apg', color: '#2563eb' },   // azul (nosso grupo)
  { key: 'salta', label: 'Salta', color: '#8b5cf6' },
  { key: 'tom', label: 'Tom', color: '#f59e0b' },
];
export const parceiroLabel = (p: EnemParceiro | null | undefined): string =>
  PARCEIROS.find((x) => x.key === p)?.label ?? '—';
export const parceiroColor = (p: EnemParceiro | null | undefined): string =>
  PARCEIROS.find((x) => x.key === p)?.color ?? '#94a3b8';

// Cor de destaque do nosso grupo, reutilizada nos contornos.
export const APG_BLUE = '#2563eb';

// Coordenadas aproximadas (lat, lon) das cidades das escolas parceiras, para o
// mapa geográfico do "Consolidado". Cobre a união das cidades de apg/salta/tom.
export const CITY_COORDS: Record<string, [number, number]> = {
  'Almirante Tamandaré': [-25.32, -49.30], 'Andirá': [-23.05, -50.23],
  'Apucarana': [-23.55, -51.46], 'Arapongas': [-23.42, -51.42],
  'Assis Chateaubriand': [-24.41, -53.52], 'Balsa Nova': [-25.58, -49.63],
  'Bocaiúva do Sul': [-25.20, -49.11], 'Campina Grande do Sul': [-25.31, -49.05],
  'Campo Largo': [-25.46, -49.53], 'Campo Magro': [-25.37, -49.45],
  'Cascavel': [-24.96, -53.46], 'Castro': [-24.79, -50.01], 'Colombo': [-25.29, -49.22],
  'Curitiba': [-25.43, -49.27], 'Fazenda Rio Grande': [-25.66, -49.31],
  'Foz do Iguaçu': [-25.54, -54.59], 'Guarapuava': [-25.39, -51.46],
  'Jaguariaíva': [-24.24, -49.71], 'Laranjeiras do Sul': [-25.41, -52.42],
  'Londrina': [-23.31, -51.16], 'Maringá': [-23.42, -51.94], 'Matinhos': [-25.82, -48.55],
  'Mauá da Serra': [-23.90, -51.22], 'Medianeira': [-25.30, -54.09],
  'Nova Santa Rosa': [-24.47, -53.80], 'Ouro Verde do Oeste': [-24.79, -53.90],
  'Palmeira': [-25.43, -50.00], 'Pinhais': [-25.44, -49.19], 'Piraí do Sul': [-24.53, -49.94],
  'Ponta Grossa': [-25.09, -50.16], 'Pontal do Paraná': [-25.67, -48.51],
  'Porecatu': [-22.75, -51.38], 'Roncador': [-24.60, -52.27], 'Sarandi': [-23.44, -51.87],
  'São José dos Pinhais': [-25.53, -49.20], 'Toledo': [-24.71, -53.74],
};
// Caixa envolvente do Paraná (aprox.) para normalizar as coordenadas no mapa.
export const PR_BOUNDS = { north: -22.4, south: -26.8, west: -54.7, east: -48.0 };

// Média ponderada por número de alunos (aproxima a média por participante).
export const mediaPonderada = (rows: EnemResultado[], area: EnemArea): number | null => {
  let soma = 0;
  let alunos = 0;
  rows.forEach((r) => {
    const v = areaValue(r, area);
    if (v !== null) {
      soma += v * (r.alunos || 0);
      alunos += r.alunos || 0;
    }
  });
  return alunos > 0 ? soma / alunos : null;
};
