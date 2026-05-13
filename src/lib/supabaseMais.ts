import { createClient } from '@supabase/supabase-js';
import { UNIDADE_MAPEADA } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

export const uploadProvaDataMais = async (data: any[]) => {
  const { data: result, error } = await supabase
    .from('prova_resultados_mais')
    .insert(data);

  if (error) throw error;
  return result;
};

export const fetchProvaDataMais = async (filters: any = {}) => {
  const searchWithFilters = async (searchFilters: any) => {
    const allData: any[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('prova_resultados_mais')
        .select('*')
        .order('nome_aluno', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      Object.entries(searchFilters).forEach(([key, value]) => {
        if (value && key !== 'aluno') {
          query = query.eq(key, value);
        }
      });

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        allData.push(...data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    return allData;
  };

  try {
    const data = await searchWithFilters(filters);

    if (filters.aluno) {
      return data.filter((item: any) =>
        item.nome_aluno.toLowerCase().includes(filters.aluno.toLowerCase())
      );
    }

    return data;
  } catch (error) {
    console.error('Erro ao buscar dados da prova Mais:', error);
    return [];
  }
};

export const fetchAllProvaDataMais = async (filters: any = {}) => {
  try {
    const allData: any[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('prova_resultados_mais')
        .select('*')
        .order('nome_aluno', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== 'aluno') {
          query = query.eq(key, value);
        }
      });

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        allData.push(...data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    if (filters.aluno) {
      return allData.filter((item: any) =>
        item.nome_aluno.toLowerCase().includes(filters.aluno.toLowerCase())
      );
    }

    return allData;
  } catch (error) {
    console.error('Erro ao buscar todos os dados da prova Mais:', error);
    return [];
  }
};

export const searchStudentsMais = async (searchTerm: string, filters: any = {}) => {
  try {
    let query = supabase
      .from('prova_resultados_mais')
      .select('nome_aluno')
      .ilike('nome_aluno', `%${searchTerm}%`)
      .order('nome_aluno')
      .limit(10);

    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        query = query.eq(key, value);
      }
    });

    const { data, error } = await query;

    if (error) throw error;

    const uniqueStudents = Array.from(new Set(data?.map(item => item.nome_aluno) || []));
    return uniqueStudents;
  } catch (error) {
    console.error('Erro ao buscar alunos:', error);
    return [];
  }
};

export const getFilterOptionsMais = async (filters: any = {}) => {
  try {
    let query = supabase
      .from('prova_resultados_mais')
      .select('nivel_aprendizagem, habilidade_codigo, habilidade_id, descricao_habilidade');

    Object.entries(filters).forEach(([key, value]) => {
      if (value && key !== 'nivel_aprendizagem') {
        query = query.eq(key, value);
      }
    });

    const { data, error } = await query;

    if (error) throw error;

    const niveis = Array.from(new Set(data?.map(item => item.nivel_aprendizagem).filter(Boolean) || []));
    const habilidades = Array.from(new Map(
      data?.map(item => [item.habilidade_codigo, {
        codigo: item.habilidade_codigo,
        id: item.habilidade_id,
        descricao: item.descricao_habilidade
      }]) || []
    ).values());

    return {
      niveis: niveis as string[],
      habilidades: habilidades as Array<{ codigo: string; id: string; descricao: string }>
    };
  } catch (error) {
    console.error('Erro ao buscar opções de filtro:', error);
    return {
      niveis: [],
      habilidades: []
    };
  }
};

export const getLinkByHabilidadeComponenteMais = async (habilidadeCodigo: string, componente: string) => {
  try {
    const { data, error } = await supabase
      .from('links_questoes_mais')
      .select('link')
      .eq('habilidade_codigo', habilidadeCodigo)
      .eq('componente', componente)
      .limit(1);

    if (error) throw error;

    return data && data.length > 0 ? data[0].link : null;
  } catch (error) {
    console.error('Erro ao buscar link:', error);
    return null;
  }
};

export const getProficiencyDataMais = async (filters: any = {}) => {
  try {
    const allData: any[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('prova_resultados_mais')
        .select('nome_aluno, acertos, total, avaliado')
        .eq('avaliado', true)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.eq(key, value);
        }
      });

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        allData.push(...data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    return allData;
  } catch (error) {
    console.error('Erro ao buscar dados de proficiência:', error);
    return [];
  }
};

export const getSalasDeAulaMais = async (unidade?: string) => {
  try {
    let query = supabase
      .from('sala_de_aula_mais')
      .select('id, nome, unidade, sala_de_aula_alunos_mais(nome_aluno, turma)')
      .order('nome');

    if (unidade) {
      query = query.eq('unidade', unidade);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erro ao buscar salas de aula mais:', error);
    return [];
  }
};

export const getAlunosDaSalaMais = async (salaId: string) => {
  try {
    const { data, error } = await supabase
      .from('sala_de_aula_alunos_mais')
      .select('nome_aluno, turma')
      .eq('sala_id', salaId);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Erro ao buscar alunos da sala mais:', error);
    return [];
  }
};
