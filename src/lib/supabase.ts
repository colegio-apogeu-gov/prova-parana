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

export const uploadProvaData = async (data: any[]) => {
  const { data: result, error } = await supabase
    .from('prova_resultados')
    .insert(data);
  
  if (error) throw error;
  return result;
};

export const fetchProvaData = async (filters: any = {}) => {
  // Função para buscar dados com filtros específicos
  const searchWithFilters = async (searchFilters: any) => {
    const allData: any[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('prova_resultados')
        .select('*')
        .order('nome_aluno', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      // Aplicar filtros válidos
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


  // Se há filtro de unidade, tenta múltiplas estratégias
  if (filters.unidade && typeof filters.unidade === 'string') {
    const originalUnidade = filters.unidade;
    const unidadeCorrigida = UNIDADE_MAPEADA[originalUnidade as keyof typeof UNIDADE_MAPEADA] || originalUnidade;
    filters.unidade = unidadeCorrigida;

    let result = await searchWithFilters(filters);
    
    if (result.length === 0) {
      // Estratégia 2: Remove vírgulas e normaliza hífens
      const cleanValue = unidadeCorrigida
        .replace(/,/g, '') // Remove vírgulas
        .replace(/-/g, ' ') // Substitui hífens por espaços
        .replace(/\s+/g, ' ') // Normaliza espaços múltiplos para um só
        .trim();
      
      const cleanFilters = { ...filters, unidade: cleanValue };
      result = await searchWithFilters(cleanFilters);
      
      if (result.length === 0) {
        // Estratégia 3: Remove "PROFIS" do final
        const withoutProfis = cleanValue.replace(/\s*PROFIS\s*$/i, '').trim();
        const noProfisFilters = { ...filters, unidade: withoutProfis };
        result = await searchWithFilters(noProfisFilters);
        
        if (result.length === 0) {
          // Estratégia 4: Busca com LIKE (parcial)
          
          let query = supabase
            .from('prova_resultados')
            .select('*')
            .ilike('unidade', `%${withoutProfis}%`);
          
          // Aplica outros filtros
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
    // Sem filtro de unidade, busca normal
    const result = await searchWithFilters(filters);
    return result;
  }
};

export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) throw error;

  // Normaliza o campo "unidade"

  const originalUnidade = data.unidade;
  const unidadeCorrigida = UNIDADE_MAPEADA[originalUnidade as keyof typeof UNIDADE_MAPEADA] || originalUnidade;
  data.unidade = unidadeCorrigida;

  return data;
};

export const createUserProfile = async (profile: any) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .insert(profile);
  
  if (error) throw error;
  return data;
};

export const getPerformanceInsights = async (filters: any = {}) => {
  // This would implement complex queries for dashboard insights
  // For now, return basic structure
  return {
    total_alunos: 0,
    alunos_avaliados: 0,
    percentual_participacao: 0,
    distribuicao_niveis: [],
    performance_habilidades: []
  };
}

export const searchStudents = async (searchTerm: string, filters: any = {}) => {
  if (!searchTerm || searchTerm.length < 1) return [];

  let query = supabase
    .from('prova_resultados')
    .select('nome_aluno')
    .ilike('nome_aluno', `%${searchTerm}%`)
    .limit(10);

  // Limpeza no filtro da unidade
  const filtrosLimpos = { ...filters };

  if (filtrosLimpos.unidade && typeof filtrosLimpos.unidade === 'string') {
    filtrosLimpos.unidade = filtrosLimpos.unidade
      .replace(/,/g, '')               // remove vírgulas
      .replace(/-/g, ' ')              // troca hífen por espaço
      .replace(/\s+/g, ' ')            // normaliza espaços duplos
      .replace(/\s*PROFIS\s*$/i, '')   // remove "PROFIS" no final
      .trim();
  }

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

export const getFilterOptions = async (filters: any = {}) => {
  try {
    // Busca níveis de aprendizagem únicos
    let niveisQuery = supabase
      .from('prova_resultados')
      .select('nivel_aprendizagem')
      .not('nivel_aprendizagem', 'is', null)
      .not('nivel_aprendizagem', 'eq', '');

    // Busca habilidades únicas
    let habilidadesQuery = supabase
      .from('prova_resultados')
      .select('habilidade_codigo, habilidade_id, descricao_habilidade')
      .not('habilidade_codigo', 'is', null)
      .not('habilidade_codigo', 'eq', '');

    const filtrosLimpos = { ...filters };

    // Aplica filtros para a busca de níveis (exceto ele mesmo)
    Object.entries(filtrosLimpos).forEach(([key, value]) => {
      if (value && key !== 'nivel_aprendizagem') {
        niveisQuery = niveisQuery.eq(key, value);
      }
    });

    // Aplica filtros à busca de habilidades, incluindo o nível, se houver
    Object.entries(filtrosLimpos).forEach(([key, value]) => {
      if (value && key !== 'habilidade_codigo') {
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
          descricao: item.descricao_habilidade
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


// Links questões functions
export const getLinksQuestoes = async () => {
  const { data, error } = await supabase
    .from('links_questoes')
    .select('*')
    .order('habilidade_codigo');
  
  if (error) throw error;
  return data || [];
};

export const createLinkQuestao = async (linkData: {
  link: string;
  habilidade_codigo: string;
  componente: string;
}) => {
  const { data, error } = await supabase
    .from('links_questoes')
    .insert(linkData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateLinkQuestao = async (id: string, linkData: {
  link: string;
  habilidade_codigo: string;
  componente: string;
}) => {
  const { data, error } = await supabase
    .from('links_questoes')
    .update(linkData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteLinkQuestao = async (id: string) => {
  const { error } = await supabase
    .from('links_questoes')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

export const getLinkByHabilidadeComponente = async (habilidadeCodigo: string, componente: string) => {
  const { data, error } = await supabase
    .from('links_questoes')
    .select('link')
    .eq('habilidade_codigo', habilidadeCodigo)
    .eq('componente', componente)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data?.link || null;
};

// Sala de Aula functions
export const getSalasDeAula = async (unidade: string) => {
  const { data, error } = await supabase
    .from('sala_de_aula')
    .select(`
      *,
      sala_de_aula_alunos (
        id,
        nome_aluno,
        turma
      )
    `)
    .eq('unidade', unidade)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const createSalaDeAula = async (salaData: {
  nome: string;
  unidade: string;
  alunos: Array<{ nome_aluno: string; turma: string }>;
}) => {
  // Create classroom
  const { data: sala, error: salaError } = await supabase
    .from('sala_de_aula')
    .insert({
      nome: salaData.nome,
      unidade: salaData.unidade
    })
    .select()
    .single();
  
  if (salaError) throw salaError;
  
  // Add students to classroom
  if (salaData.alunos.length > 0) {
    const alunosData = salaData.alunos.map(aluno => ({
      sala_id: sala.id,
      nome_aluno: aluno.nome_aluno,
      turma: aluno.turma
    }));
    
    const { error: alunosError } = await supabase
      .from('sala_de_aula_alunos')
      .insert(alunosData);
    
    if (alunosError) throw alunosError;
  }
  
  return sala;
};

export const addAlunoToSala = async (salaId: string, aluno: { nome_aluno: string; turma: string }) => {
  const { data, error } = await supabase
    .from('sala_de_aula_alunos')
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

export const removeAlunoFromSala = async (alunoId: string) => {
  const { error } = await supabase
    .from('sala_de_aula_alunos')
    .delete()
    .eq('id', alunoId);
  
  if (error) throw error;
};

export const deleteSalaDeAula = async (salaId: string) => {
  const { error } = await supabase
    .from('sala_de_aula')
    .delete()
    .eq('id', salaId);
  
  if (error) throw error;
};

export const getAlunosDisponiveis = async (filters: any = {}) => {
  const data = await fetchProvaData(filters);
  
  // Get unique students with their turma
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

// Função específica para buscar TODOS os dados sem limitação (para gráficos)
export const fetchAllProvaData = async (filters: any = {}) => {
  const allData: any[] = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;

  // Se há filtro de unidade, tenta múltiplas estratégias
  if (filters.unidade && typeof filters.unidade === 'string') {
    const originalUnidade = filters.unidade;
    const unidadeCorrigida = UNIDADE_MAPEADA[originalUnidade as keyof typeof UNIDADE_MAPEADA] || originalUnidade;
    filters.unidade = unidadeCorrigida;

    // Busca com paginação completa
    while (hasMore) {
      let query = supabase
        .from('prova_resultados')
        .select('*')
        .order('habilidade_id', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      // Aplicar filtros válidos
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
    
    // Se não encontrou dados, tenta estratégias alternativas
    if (allData.length === 0) {
      // Estratégia 2: Remove vírgulas e normaliza hífens
      const cleanValue = unidadeCorrigida
        .replace(/,/g, '') // Remove vírgulas
        .replace(/-/g, ' ') // Substitui hífens por espaços
        .replace(/\s+/g, ' ') // Normaliza espaços múltiplos para um só
        .trim();
      
      const cleanFilters = { ...filters, unidade: cleanValue };
      
      page = 0;
      hasMore = true;
      while (hasMore) {
        let query = supabase
          .from('prova_resultados')
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
      
      // Estratégia 3: Remove "PROFIS" do final
      if (allData.length === 0) {
        const withoutProfis = cleanValue.replace(/\s*PROFIS\s*$/i, '').trim();
        const noProfisFilters = { ...filters, unidade: withoutProfis };
        
        page = 0;
        hasMore = true;
        while (hasMore) {
          let query = supabase
            .from('prova_resultados')
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
        
        // Estratégia 4: Busca com LIKE (parcial)
        if (allData.length === 0) {
          page = 0;
          hasMore = true;
          while (hasMore) {
            let query = supabase
              .from('prova_resultados')
              .select('*')
              .ilike('unidade', `%${withoutProfis}%`)
              .order('habilidade_id', { ascending: true })
              .range(page * pageSize, (page + 1) * pageSize - 1);
            
            // Aplica outros filtros
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
    // Sem filtro de unidade, busca normal com paginação completa
    while (hasMore) {
      let query = supabase
        .from('prova_resultados')
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
}

export const getProficiencyData = async (filters: any = {}) => {
  try {
    const allData: any[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('prova_resultados')
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