import { createClient } from '@supabase/supabase-js';
import { UNIDADE_MAPEADA, ComparacaoAnualAgregado } from '../types';
import { normalizeAgregado, isRpcAusente, RpcAusenteError } from './supabase';

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

// Enriquecimento: a partir da tabela componentes_habilidades, preenche
// habilidade_codigo (= posicao) e descricao_habilidade (= descricao) quando
// (componente, ano_escolar, habilidade) baterem com (componente, ano_escolar, habilidade_id).
export const enrichWithComponentesHabilidadesMais = async (data: any[]) => {
  if (!data || data.length === 0) return data;

  const componentes = [...new Set(data.map((d) => d.componente).filter(Boolean))];
  const anos = [...new Set(data.map((d) => d.ano_escolar).filter(Boolean))];
  const habilidades = [...new Set(data.map((d) => d.habilidade_id).filter(Boolean))];

  if (componentes.length === 0 || anos.length === 0 || habilidades.length === 0) {
    return data;
  }

  const { data: habRows, error } = await supabase
    .from('componentes_habilidades')
    .select('componente, ano_escolar, habilidade, posicao, descricao')
    .in('componente', componentes)
    .in('ano_escolar', anos)
    .in('habilidade', habilidades);

  if (error) {
    console.error('Erro ao buscar componentes_habilidades:', error);
    return data;
  }

  const lookup = new Map<string, { posicao: string; descricao: string }>();
  (habRows || []).forEach((h: any) => {
    const key = `${h.componente}||${h.ano_escolar}||${h.habilidade}`;
    lookup.set(key, { posicao: h.posicao ?? '', descricao: h.descricao ?? '' });
  });

  return data.map((row) => {
    const key = `${row.componente}||${row.ano_escolar}||${row.habilidade_id}`;
    const info = lookup.get(key);
    if (info) {
      return {
        ...row,
        habilidade_codigo: info.posicao,
        descricao_habilidade: info.descricao,
      };
    }
    return row;
  });
};

export const uploadProvaDataMais = async (data: any[]) => {
  const enriched = await enrichWithComponentesHabilidadesMais(data);
  const { data: result, error } = await supabase
    .from('prova_resultados_mais')
    .insert(enriched);

  if (error) throw error;
  return result;
};

// Retorna lista distinta de ano_prova encontrados na tabela prova_resultados_mais,
// opcionalmente filtrando pela unidade.
export const getAnosProvaMais = async (unidade?: string): Promise<string[]> => {
  try {
    const allRows: { ano_prova: string | null }[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('prova_resultados_mais')
        .select('ano_prova')
        .not('ano_prova', 'is', null)
        .not('ano_prova', 'eq', '')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (unidade) {
        query = query.eq('unidade', unidade);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        allRows.push(...data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    return [...new Set(allRows.map((r) => r.ano_prova).filter(Boolean) as string[])].sort(
      (a, b) => b.localeCompare(a)
    );
  } catch (error) {
    console.error('Erro ao buscar anos de prova:', error);
    return [];
  }
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
      .select('id, nome, unidade, professores, sala_de_aula_alunos_mais(nome_aluno, turma)')
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

export const createSalaDeAulaMais = async (salaData: {
  nome: string;
  unidade: string;
  alunos: Array<{ nome_aluno: string; turma: string }>;
}) => {
  // Cria a sala
  const { data: sala, error: salaError } = await supabase
    .from('sala_de_aula_mais')
    .insert({
      nome: salaData.nome,
      unidade: salaData.unidade
    })
    .select()
    .single();

  if (salaError) throw salaError;

  // Adiciona os alunos à sala
  if (salaData.alunos.length > 0) {
    const alunosData = salaData.alunos.map((aluno) => ({
      sala_id: sala.id,
      nome_aluno: aluno.nome_aluno,
      turma: aluno.turma
    }));

    const { error: alunosError } = await supabase
      .from('sala_de_aula_alunos_mais')
      .insert(alunosData);

    if (alunosError) throw alunosError;
  }

  return sala;
};

export const addAlunoToSalaMais = async (salaId: string, aluno: { nome_aluno: string; turma: string }) => {
  const { data, error } = await supabase
    .from('sala_de_aula_alunos_mais')
    .insert({
      sala_id: salaId,
      nome_aluno: aluno.nome_aluno,
      turma: aluno.turma
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const removeAlunoFromSalaMais = async (alunoId: string) => {
  const { error } = await supabase
    .from('sala_de_aula_alunos_mais')
    .delete()
    .eq('id', alunoId);

  if (error) throw error;
};

/**
 * Agregados da Comparação Anual para TODAS as escolas (sistema Paraná Mais).
 * Ver supabase/migrations/20260709130000_add_rpc_comparacao_anual.sql
 */
export const getComparacaoAnualAgregadaMais = async (): Promise<ComparacaoAnualAgregado[]> => {
  const { data, error } = await supabase.rpc('rpc_comparacao_anual_mais');
  if (error) {
    if (isRpcAusente(error)) throw new RpcAusenteError('rpc_comparacao_anual_mais');
    throw error;
  }
  return (data ?? []).map(normalizeAgregado);
};

export const deleteSalaDeAulaMais = async (salaId: string) => {
  const { error } = await supabase
    .from('sala_de_aula_mais')
    .delete()
    .eq('id', salaId);

  if (error) throw error;
};

// Atualiza o mapa de professores (turma||componente -> nome) de uma sala.
export const updateSalaProfessoresMais = async (
  salaId: string,
  professores: Record<string, string>
) => {
  const { error } = await supabase
    .from('sala_de_aula_mais')
    .update({ professores })
    .eq('id', salaId);

  if (error) throw error;
};

export const getAlunosDisponiveisMais = async (filters: any = {}) => {
  const data = await fetchProvaDataMais(filters);

  // Alunos únicos com sua turma
  const uniqueStudents = new Map<string, { nome_aluno: string; turma: string }>();

  data.forEach((item: any) => {
    const key = `${item.nome_aluno}-${item.turma}`;
    if (!uniqueStudents.has(key)) {
      uniqueStudents.set(key, {
        nome_aluno: item.nome_aluno,
        turma: item.turma
      });
    }
  });

  return Array.from(uniqueStudents.values()).sort((a, b) =>
    a.nome_aluno.localeCompare(b.nome_aluno)
  );
};
