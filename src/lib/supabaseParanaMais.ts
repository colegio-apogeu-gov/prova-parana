import { createClient } from '@supabase/supabase-js';
import { UNIDADE_MAPEADA } from '../types';

const supabaseUrl = "https://riioawdlnzjtisxftprx.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpaW9hd2RsbnpqdGlzeGZ0cHJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTQ2OTMsImV4cCI6MjA2ODI3MDY5M30.3qdM7ulWanTTjJwuYG7tJg7LJu7qE4USYVKRgToe06U";

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
  };

  if (filters.unidade && typeof filters.unidade === 'string') {
    const originalUnidade = filters.unidade;
    const unidadeCorrigida = UNIDADE_MAPEADA[originalUnidade as keyof typeof UNIDADE_MAPEADA] || originalUnidade;
    filters.unidade = unidadeCorrigida;

    let result = await searchWithFilters(filters);

    if (result.length === 0) {
      const cleanValue = unidadeCorrigida
        .replace(/,/g, '')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const cleanFilters = { ...filters, unidade: cleanValue };
      result = await searchWithFilters(cleanFilters);

      if (result.length === 0) {
        const withoutProfis = cleanValue.replace(/\s*PROFIS\s*$/i, '').trim();
        const noProfisFilters = { ...filters, unidade: withoutProfis };
        result = await searchWithFilters(noProfisFilters);

        if (result.length === 0) {
          let query = supabase
            .from('prova_resultados_mais')
            .select('*')
            .ilike('unidade', `%${withoutProfis}%`);

          Object.entries(filters).forEach(([key, value]) => {
            if (value && key !== 'unidade') {
              query = query.eq(key, value);
            }
          });

          const { data, error } = await query;
          if (error) throw error;

          result = data || [];
        }
      }
    }

    return result;
  } else {
    const result = await searchWithFilters(filters);
    return result;
  }
};

export const fetchAllProvaDataMais = async (filters: any = {}) => {
  const allData: any[] = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;

  if (filters.unidade && typeof filters.unidade === 'string') {
    const originalUnidade = filters.unidade;
    const unidadeCorrigida = UNIDADE_MAPEADA[originalUnidade as keyof typeof UNIDADE_MAPEADA] || originalUnidade;
    filters.unidade = unidadeCorrigida;

    while (hasMore) {
      let query = supabase
        .from('prova_resultados_mais')
        .select('*')
        .order('habilidade_id', { ascending: true })
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

    if (allData.length === 0) {
      const cleanValue = unidadeCorrigida
        .replace(/,/g, '')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const cleanFilters = { ...filters, unidade: cleanValue };

      page = 0;
      hasMore = true;
      while (hasMore) {
        let query = supabase
          .from('prova_resultados_mais')
          .select('*')
          .order('habilidade_id', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        Object.entries(cleanFilters).forEach(([key, value]) => {
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

      if (allData.length === 0) {
        const withoutProfis = cleanValue.replace(/\s*PROFIS\s*$/i, '').trim();
        const noProfisFilters = { ...filters, unidade: withoutProfis };

        page = 0;
        hasMore = true;
        while (hasMore) {
          let query = supabase
            .from('prova_resultados_mais')
            .select('*')
            .order('habilidade_id', { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          Object.entries(noProfisFilters).forEach(([key, value]) => {
            if (value && key !== 'unidade') {
              query = query.eq(key, value);
            }
          });

          if (noProfisFilters.unidade) {
            query = query.eq('unidade', noProfisFilters.unidade);
          }

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

        if (allData.length === 0) {
          page = 0;
          hasMore = true;
          while (hasMore) {
            let query = supabase
              .from('prova_resultados_mais')
              .select('*')
              .ilike('unidade', `%${withoutProfis}%`)
              .order('habilidade_id', { ascending: true })
              .range(page * pageSize, (page + 1) * pageSize - 1);

            Object.entries(filters).forEach(([key, value]) => {
              if (value && key !== 'unidade') {
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
        }
      }
    }

    return allData;
  } else {
    while (hasMore) {
      let query = supabase
        .from('prova_resultados_mais')
        .select('*')
        .order('habilidade_id', { ascending: true })
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

    return allData;
  }
};

export const searchStudentsMais = async (searchTerm: string, filters: any = {}) => {
  if (!searchTerm || searchTerm.length < 1) return [];

  const filtrosLimpos = { ...filters };

  if (filtrosLimpos.unidade && typeof filtrosLimpos.unidade === 'string') {
    const originalUnidade = filtrosLimpos.unidade;
    const unidadeCorrigida = UNIDADE_MAPEADA[originalUnidade as keyof typeof UNIDADE_MAPEADA] || originalUnidade;
    filtrosLimpos.unidade = unidadeCorrigida
      .replace(/,/g, '')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s*PROFIS\s*$/i, '')
      .trim();
  }

  let query = supabase
    .from('prova_resultados_mais')
    .select('nome_aluno')
    .ilike('nome_aluno', `%${searchTerm}%`)
    .limit(20);

  Object.entries(filtrosLimpos).forEach(([key, value]) => {
    if (value && key !== 'nome_aluno') {
      query = query.eq(key, value);
    }
  });

  const { data, error } = await query;
  if (error) throw error;

  const uniqueNames = [...new Set(data?.map(item => item.nome_aluno) || [])];
  return uniqueNames;
};

export const getFilterOptionsMais = async (filters: any = {}) => {
  try {
    const filtrosLimpos = { ...filters };

    if (filtrosLimpos.unidade && typeof filtrosLimpos.unidade === 'string') {
      const originalUnidade = filtrosLimpos.unidade;
      const unidadeCorrigida = UNIDADE_MAPEADA[originalUnidade as keyof typeof UNIDADE_MAPEADA] || originalUnidade;
      filtrosLimpos.unidade = unidadeCorrigida
        .replace(/,/g, '')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s*PROFIS\s*$/i, '')
        .trim();
    }

    let niveisQuery = supabase
      .from('prova_resultados_mais')
      .select('nivel_aprendizagem', { count: 'exact' })
      .not('nivel_aprendizagem', 'is', null)
      .not('nivel_aprendizagem', 'eq', '')
      .limit(100);

    let habilidadesQuery = supabase
      .from('prova_resultados_mais')
      .select('habilidade_codigo, habilidade_id, descricao_habilidade, nivel_aprendizagem', { count: 'exact' })
      .not('habilidade_codigo', 'is', null)
      .not('habilidade_codigo', 'eq', '')
      .limit(500);

    Object.entries(filtrosLimpos).forEach(([key, value]) => {
      if (value && key !== 'nivel_aprendizagem' && key !== 'nome_aluno') {
        niveisQuery = niveisQuery.eq(key, value);
      }
    });

    Object.entries(filtrosLimpos).forEach(([key, value]) => {
      if (value && key !== 'habilidade_codigo' && key !== 'nome_aluno') {
        habilidadesQuery = habilidadesQuery.eq(key, value);
      }
    });

    const [niveisResult, habilidadesResult] = await Promise.all([
      niveisQuery,
      habilidadesQuery
    ]);

    if (niveisResult.error) throw niveisResult.error;
    if (habilidadesResult.error) throw habilidadesResult.error;

    const niveisUnicos = [...new Set(
      niveisResult.data?.map(item => item.nivel_aprendizagem).filter(Boolean) || []
    )].sort();

    const habilidadesMap = new Map();
    habilidadesResult.data?.forEach(item => {
      if (item.habilidade_codigo) {
        habilidadesMap.set(item.habilidade_codigo, {
          codigo: item.habilidade_codigo,
          id: item.habilidade_id,
          descricao: item.descricao_habilidade,
          nivel_aprendizagem: item.nivel_aprendizagem
        });
      }
    });

    const habilidadesUnicas = Array.from(habilidadesMap.values())
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

    return {
      niveis: niveisUnicos,
      habilidades: habilidadesUnicas
    };
  } catch (error) {
    console.error('Erro ao buscar opções de filtro:', error);
    return {
      niveis: [],
      habilidades: []
    };
  }
};

export const getLinksQuestoesMais = async () => {
  const { data, error } = await supabase
    .from('links_questoes_mais')
    .select('*')
    .order('habilidade_codigo');

  if (error) throw error;
  return data || [];
};

export const createLinkQuestaoMais = async (linkData: {
  link: string;
  habilidade_codigo: string;
  componente: string;
}) => {
  const { data, error } = await supabase
    .from('links_questoes_mais')
    .insert(linkData)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateLinkQuestaoMais = async (id: string, linkData: {
  link: string;
  habilidade_codigo: string;
  componente: string;
}) => {
  const { data, error } = await supabase
    .from('links_questoes_mais')
    .update(linkData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteLinkQuestaoMais = async (id: string) => {
  const { error } = await supabase
    .from('links_questoes_mais')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const getLinkByHabilidadeComponenteMais = async (habilidadeCodigo: string, componente: string) => {
  const { data, error } = await supabase
    .from('links_questoes_mais')
    .select('link')
    .eq('habilidade_codigo', habilidadeCodigo)
    .eq('componente', componente)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data?.link || null;
};

export const getSalasDeAulaMais = async (unidade: string) => {
  const { data, error } = await supabase
    .from('sala_de_aula_mais')
    .select(`
      *,
      sala_de_aula_alunos_mais (
        id,
        nome_aluno,
        turma
      )
    `)
    .eq('unidade', unidade)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Normalizar o nome do campo para sala_de_aula_alunos para compatibilidade com o componente
  const normalizedData = (data || []).map(sala => ({
    ...sala,
    sala_de_aula_alunos: sala.sala_de_aula_alunos_mais || []
  }));

  return normalizedData;
};

export const createSalaDeAulaMais = async (salaData: {
  nome: string;
  unidade: string;
  alunos: Array<{ nome_aluno: string; turma: string }>;
}) => {
  const { data: sala, error: salaError } = await supabase
    .from('sala_de_aula_mais')
    .insert({
      nome: salaData.nome,
      unidade: salaData.unidade
    })
    .select()
    .single();

  if (salaError) throw salaError;

  if (salaData.alunos.length > 0) {
    const alunosData = salaData.alunos.map(aluno => ({
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

export const deleteSalaDeAulaMais = async (salaId: string) => {
  const { error } = await supabase
    .from('sala_de_aula_mais')
    .delete()
    .eq('id', salaId);

  if (error) throw error;
};

export const getAlunosDisponivelMais = async (filters: any = {}) => {
  const data = await fetchProvaDataMais(filters);

  const uniqueStudents = new Map<string, { nome_aluno: string; turma: string }>();

  data.forEach(item => {
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

export const getProficiencyDataMais = async (filters: any = {}) => {
  try {
    const allData: any[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('prova_resultados_mais')
        .select('nome_aluno, unidade, regional, componente, ano_escolar, semestre, avaliado, nivel_aprendizagem, created_at')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.eq(key, value as any);
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
