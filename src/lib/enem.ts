import { supabase } from './supabase';
import { EnemResultado, EnemArea } from '../types';

// Busca os resultados ENEM (todas as escolas), opcionalmente filtrando por ano.
export const getEnemResultados = async (ano?: string): Promise<EnemResultado[]> => {
  let q = supabase
    .from('enem_resultados')
    .select('*')
    .order('posicao_geral', { ascending: true });
  if (ano) q = q.eq('ano', ano);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as EnemResultado[];
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
