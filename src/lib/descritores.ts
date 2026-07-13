import { supabase } from './supabase';

// Sistema selecionado no app -> tipo_prova (na tabela componentes_habilidades)
// e nome da tabela de resultados correspondente.
export type SystemKey = 'prova-parana' | 'parceiro' | 'parana-mais';

export const tipoProvaFromSystem = (system: SystemKey): 'prova-parana' | 'mais' | 'parceiro' =>
  system === 'prova-parana' ? 'prova-parana' : system === 'parana-mais' ? 'mais' : 'parceiro';

export const provaTableFromSystem = (system: SystemKey): string =>
  system === 'prova-parana'
    ? 'prova_resultados'
    : system === 'parana-mais'
    ? 'prova_resultados_mais'
    : 'prova_resultados_parceiro';

export interface ComponenteHabilidade {
  id: string;
  tipo_prova: 'prova-parana' | 'mais' | 'parceiro';
  rede: string | null;
  ano_escolar: string;
  componente: string;
  habilidade_posicao: string;
  habilidade: string;
  posicao: string;
  descricao: string;
  created_at?: string;
}

export interface DescritorInput {
  tipo_prova: 'prova-parana' | 'mais' | 'parceiro';
  rede?: string | null;
  ano_escolar: string;
  componente: string;
  // O usuario pode informar "H 07 (D025_P)" (habilidade_posicao) OU habilidade/posicao separados.
  habilidade_posicao?: string;
  habilidade?: string;
  posicao?: string;
  descricao: string;
}

export interface DescritorOrfao {
  ano_escolar: string;
  componente: string;
  habilidade_id: string;
  habilidade_codigo: string;
  descricao_habilidade: string;
  qtd: number;
}

// "H 07 (D025_P)" -> { habilidade: 'H07', posicao: 'D025_P' }
export const parseHabilidadePosicao = (
  hp: string
): { habilidade: string; posicao: string } => {
  const m = (hp || '').match(/^H\s*(\d+)\s*\((.+)\)$/);
  if (m) {
    return { habilidade: `H${String(parseInt(m[1], 10)).padStart(2, '0')}`, posicao: m[2].trim() };
  }
  // fallback: tenta separar por espaco/parenteses de forma tolerante
  const num = (hp || '').match(/H\s*(\d+)/i);
  const cod = (hp || '').match(/\(([^)]+)\)/);
  return {
    habilidade: num ? `H${String(parseInt(num[1], 10)).padStart(2, '0')}` : (hp || '').trim(),
    posicao: cod ? cod[1].trim() : '',
  };
};

// Normaliza um DescritorInput -> objeto pronto para insert/update na tabela.
const normalizeDescritor = (input: DescritorInput) => {
  let { habilidade, posicao } = input;
  let habilidade_posicao = input.habilidade_posicao?.trim() || '';

  if ((!habilidade || !posicao) && habilidade_posicao) {
    const parsed = parseHabilidadePosicao(habilidade_posicao);
    habilidade = habilidade || parsed.habilidade;
    posicao = posicao || parsed.posicao;
  }
  if (!habilidade_posicao && habilidade && posicao) {
    // reconstroi "H 07 (D025_P)" a partir das partes
    const num = habilidade.match(/(\d+)/);
    habilidade_posicao = num ? `H ${String(parseInt(num[1], 10)).padStart(2, '0')} (${posicao})` : `${habilidade} (${posicao})`;
  }

  return {
    tipo_prova: input.tipo_prova,
    rede: input.rede ?? null,
    ano_escolar: input.ano_escolar,
    componente: input.componente,
    habilidade_posicao,
    habilidade: (habilidade || '').trim(),
    posicao: (posicao || '').trim(),
    descricao: input.descricao.trim(),
  };
};

// ---- CRUD componentes_habilidades ----
export const getComponentesHabilidades = async (
  tipoProva: 'prova-parana' | 'mais' | 'parceiro',
  filtros: { ano_escolar?: string; componente?: string; busca?: string } = {}
): Promise<ComponenteHabilidade[]> => {
  let query = supabase
    .from('componentes_habilidades')
    .select('*')
    .eq('tipo_prova', tipoProva)
    .order('ano_escolar', { ascending: true })
    .order('componente', { ascending: true })
    .order('habilidade', { ascending: true });

  if (filtros.ano_escolar) query = query.eq('ano_escolar', filtros.ano_escolar);
  if (filtros.componente) query = query.eq('componente', filtros.componente);
  if (filtros.busca) {
    const b = `%${filtros.busca}%`;
    query = query.or(`posicao.ilike.${b},descricao.ilike.${b},habilidade_posicao.ilike.${b}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ComponenteHabilidade[];
};

export const createComponenteHabilidade = async (
  input: DescritorInput
): Promise<ComponenteHabilidade> => {
  const row = normalizeDescritor(input);
  const { data, error } = await supabase
    .from('componentes_habilidades')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as ComponenteHabilidade;
};

export const updateComponenteHabilidade = async (
  id: string,
  input: DescritorInput
): Promise<ComponenteHabilidade> => {
  const row = normalizeDescritor(input);
  const { data, error } = await supabase
    .from('componentes_habilidades')
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as ComponenteHabilidade;
};

export const deleteComponenteHabilidade = async (id: string): Promise<void> => {
  const { error } = await supabase.from('componentes_habilidades').delete().eq('id', id);
  if (error) throw error;
};

// ---- Vincular descritores a resultados orfaos ----
export const getDescritoresOrfaos = async (
  system: SystemKey,
  unidade?: string
): Promise<DescritorOrfao[]> => {
  const { data, error } = await supabase.rpc('rpc_descritores_orfaos', {
    p_tipo: tipoProvaFromSystem(system),
    p_unidade: unidade ?? null,
  });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    ano_escolar: r.ano_escolar,
    componente: r.componente,
    habilidade_id: r.habilidade_id,
    habilidade_codigo: r.habilidade_codigo,
    descricao_habilidade: r.descricao_habilidade,
    qtd: Number(r.qtd) || 0,
  }));
};

// Vincula todas as linhas da tabela de prova que correspondem exatamente ao "orfao"
// (mesma ano_escolar/componente/habilidade_id/habilidade_codigo e ainda sem FK) ao
// descritor informado. Opcionalmente preenche descricao_habilidade/habilidade_codigo vazios.
export const vincularDescritorAResultados = async (
  system: SystemKey,
  orfao: Pick<DescritorOrfao, 'ano_escolar' | 'componente' | 'habilidade_id' | 'habilidade_codigo'>,
  descritor: ComponenteHabilidade,
  opts: { preencherDescricao?: boolean } = {}
): Promise<void> => {
  const tabela = provaTableFromSystem(system);

  const update: Record<string, any> = { componente_habilidade_id: descritor.id };
  if (opts.preencherDescricao) {
    update.descricao_habilidade = descritor.descricao;
    update.habilidade_codigo = descritor.posicao;
  }

  const { error } = await supabase
    .from(tabela)
    .update(update)
    .is('componente_habilidade_id', null)
    .eq('ano_escolar', orfao.ano_escolar)
    .eq('componente', orfao.componente)
    .eq('habilidade_id', orfao.habilidade_id)
    .eq('habilidade_codigo', orfao.habilidade_codigo);

  if (error) throw error;
};

// Lista de anos escolares por tipo de prova (para selects do formulario).
export const ANOS_POR_TIPO: Record<'prova-parana' | 'mais' | 'parceiro', string[]> = {
  'prova-parana': ['3º ano', '6º ano', '9º ano'],
  mais: ['3º ano', '9º ano'],
  parceiro: ['1º ano', '2º ano', '3º ano', '6º ano', '7º ano', '8º ano', '9º ano'],
};

export const COMPONENTES_POR_TIPO: Record<'prova-parana' | 'mais' | 'parceiro', string[]> = {
  'prova-parana': ['LP', 'MT'],
  mais: ['LP', 'MT', 'CN', 'CH'],
  parceiro: ['LP', 'MT'],
};
