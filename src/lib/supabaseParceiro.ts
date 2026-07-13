import { createClient } from '@supabase/supabase-js';
import { UNIDADE_MAPEADA, ComparacaoAnualAgregado } from '../types';
import { normalizeAgregado, normalizeNivelAgg, isRpcAusente, RpcAusenteError } from './supabase';
import { ComparacaoAnualNivel } from '../types';

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
export const enrichWithComponentesHabilidadesParceiro = async (data: any[]) => {
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

export const uploadProvaDataParceiro = async (data: any[]) => {
  const enriched = await enrichWithComponentesHabilidadesParceiro(data);
  const { data: result, error } = await supabase
    .from('prova_resultados_parceiro')
    .insert(enriched);

  if (error) throw error;
  return result;
};

// Retorna lista distinta de ano_prova encontrados na tabela prova_resultados_parceiro,
// opcionalmente filtrando pela unidade.
export const getAnosProvaParceiro = async (unidade?: string): Promise<string[]> => {
  try {
    const allRows: { ano_prova: string | null }[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('prova_resultados_parceiro')
        .select('ano_prova')
        .not('ano_prova', 'is', null)
        .not('ano_prova', 'eq', '')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (unidade) {
        const unidadeCorrigida =
          UNIDADE_MAPEADA[unidade as keyof typeof UNIDADE_MAPEADA] || unidade;
        query = query.eq('unidade', unidadeCorrigida);
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

export const fetchProvaDataParceiro = async (filters: any = {}) => {
  // Função para buscar dados com filtros específicos
  const searchWithFilters = async (searchFilters: any) => {
    const allData: any[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('prova_resultados_parceiro')
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
            .from('prova_resultados_parceiro')
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

export const fetchAllProvaDataParceiro = async (filters: any = {}) => {
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
        .from('prova_resultados_parceiro')
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
          .from('prova_resultados_parceiro')
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
            .from('prova_resultados_parceiro')
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
              .from('prova_resultados_parceiro')
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
        .from('prova_resultados_parceiro')
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

export const searchStudentsParceiro = async (searchTerm: string, filters: any = {}) => {
  if (!searchTerm || searchTerm.length < 1) return [];

  let query = supabase
    .from('prova_resultados_parceiro')
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

// Paginação padrão (pageSize = 1000) para qualquer query do Supabase
const fetchAllPaginated = async <T>(buildQuery: () => any, pageSize = 1000): Promise<T[]> => {
  const all: T[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    // IMPORTANTE: construir uma NOVA query a cada iteração
    const query = buildQuery().range(page * pageSize, (page + 1) * pageSize - 1);
    const { data, error } = await query;
    if (error) throw error;

    if (data && data.length > 0) {
      all.push(...data);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  return all;
};


export const getFilterOptionsParceiro = async (filters: any = {}) => {
  try {
    // Base "limpa" para filtros
    const filtrosLimpos = { ...filters };

    // ====== PADRÕES (padrao_desempenho) ======
    // Puxa todos os padrões de desempenho distintos existentes no banco,
    // em vez de uma lista fixa (hardcoded).
    const buildPadroesQuery = () => {
      let q = supabase
        .from('prova_resultados_parceiro')
        .select('padrao_desempenho')
        .not('padrao_desempenho', 'is', null)
        .not('padrao_desempenho', 'eq', '');

      // aplica filtros exceto ele mesmo
      Object.entries(filtrosLimpos).forEach(([key, value]) => {
        if (value && key !== 'padrao_desempenho') {
          q = q.eq(key, value as any);
        }
      });
      return q;
    };

    const padroesRows = await fetchAllPaginated<{ padrao_desempenho: string | null }>(buildPadroesQuery);
    const padroesUnicos = [...new Set(
      (padroesRows || []).map(r => r.padrao_desempenho).filter(Boolean) as string[]
    )].sort();

    // ====== HABILIDADES (habilidade_codigo, habilidade_id, descricao_habilidade) ======
    const buildHabilidadesQuery = () => {
      let q = supabase
        .from('prova_resultados_parceiro')
        .select('habilidade_codigo, habilidade_id, descricao_habilidade')
        .not('habilidade_codigo', 'is', null)
        .not('habilidade_codigo', 'eq', '');

      // aplica filtros (inclui padrao, se vier no filtro)
      Object.entries(filtrosLimpos).forEach(([key, value]) => {
        if (value && key !== 'habilidade_codigo') {
          q = q.eq(key, value as any);
        }
      });
      return q;
    };

    const habilidadesRows = await fetchAllPaginated<{
      habilidade_codigo: string | null;
      habilidade_id: number | null;
      descricao_habilidade: string | null;
    }>(buildHabilidadesQuery);

    // map/unique/sort de habilidades
    const habilidadesMap = new Map<string, { codigo: string; id: number | null; descricao: string | null }>();
    (habilidadesRows || []).forEach(item => {
      if (item.habilidade_codigo) {
        habilidadesMap.set(item.habilidade_codigo, {
          codigo: item.habilidade_codigo,
          id: item.habilidade_id ?? null,
          descricao: item.descricao_habilidade ?? null
        });
      }
    });

    const habilidadesUnicas = Array
      .from(habilidadesMap.values())
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

    return {
      padroes: padroesUnicos,
      habilidades: habilidadesUnicas
    };
  } catch (e) {
    console.error(e);
    return {
      padroes: [],
      habilidades: []
    };
  }
};


// Links questões functions
export const getLinksQuestoesParceiro = async () => {
  const { data, error } = await supabase
    .from('links_questoes_parceiro')
    .select('*')
    .order('habilidade_codigo');
  
  if (error) throw error;
  return data || [];
};

export const createLinkQuestaoParceiro = async (linkData: {
  link: string;
  habilidade_codigo: string;
  componente: string;
}) => {
  const { data, error } = await supabase
    .from('links_questoes_parceiro')
    .insert(linkData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const updateLinkQuestaoParceiro = async (id: string, linkData: {
  link: string;
  habilidade_codigo: string;
  componente: string;
}) => {
  const { data, error } = await supabase
    .from('links_questoes_parceiro')
    .update(linkData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteLinkQuestaoParceiro = async (id: string) => {
  const { error } = await supabase
    .from('links_questoes_parceiro')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

export const getLinkByHabilidadeComponenteParceiro = async (habilidadeCodigo: string, componente: string) => {
  const { data, error } = await supabase
    .from('links_questoes_parceiro')
    .select('link')
    .eq('habilidade_codigo', habilidadeCodigo)
    .eq('componente', componente)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data?.link || null;
};

// Sala de Aula functions
export const getSalasDeAulaParceiro = async (unidade: string) => {
  const { data, error } = await supabase
    .from('sala_de_aula_parceiro')
    .select(`
      *,
      sala_de_aula_alunos_parceiros (
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

export const createSalaDeAulaParceiro = async (salaData: {
  nome: string;
  unidade: string;
  alunos: Array<{ nome_aluno: string; turma: string }>;
}) => {
  // Create classroom
  const { data: sala, error: salaError } = await supabase
    .from('sala_de_aula_parceiro')
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
      .from('sala_de_aula_alunos_parceiros')
      .insert(alunosData);
    
    if (alunosError) throw alunosError;
  }
  
  return sala;
};

export const addAlunoToSalaParceiro = async (salaId: string, aluno: { nome_aluno: string; turma: string }) => {
  const { data, error } = await supabase
    .from('sala_de_aula_alunos_parceiros')
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

export const removeAlunoFromSalaParceiro = async (alunoId: string) => {
  const { error } = await supabase
    .from('sala_de_aula_alunos_parceiros')
    .delete()
    .eq('id', alunoId);
  
  if (error) throw error;
};

/**
 * Agregados da Comparação Anual para TODAS as escolas (sistema Parceiro).
 * Ver supabase/migrations/20260709130000_add_rpc_comparacao_anual.sql
 */
export const getComparacaoAnualAgregadaParceiro = async (): Promise<ComparacaoAnualAgregado[]> => {
  const { data, error } = await supabase.rpc('rpc_comparacao_anual_parceiro');
  if (error) {
    if (isRpcAusente(error)) throw new RpcAusenteError('rpc_comparacao_anual_parceiro');
    throw error;
  }
  return (data ?? []).map(normalizeAgregado);
};

export const getComparacaoAnualNiveisParceiro = async (): Promise<ComparacaoAnualNivel[]> => {
  const { data, error } = await supabase.rpc('rpc_comparacao_anual_niveis_parceiro');
  if (error) {
    if (isRpcAusente(error)) throw new RpcAusenteError('rpc_comparacao_anual_niveis_parceiro');
    throw error;
  }
  return (data ?? []).map(normalizeNivelAgg);
};

export const deleteSalaDeAulaParceiro = async (salaId: string) => {
  const { error } = await supabase
    .from('sala_de_aula_parceiro')
    .delete()
    .eq('id', salaId);

  if (error) throw error;
};

// Atualiza o mapa de professores (turma||componente -> nome) de uma sala.
export const updateSalaProfessoresParceiro = async (
  salaId: string,
  professores: Record<string, string>
) => {
  const { error } = await supabase
    .from('sala_de_aula_parceiro')
    .update({ professores })
    .eq('id', salaId);

  if (error) throw error;
};

export const getAlunosDisponivelParceiro = async (filters: any = {}) => {
  const data = await fetchProvaDataParceiro(filters);
  
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

export const getProficiencyDataParceiro = async (filters: any = {}) => {
  try {
    const allData: any[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('prova_resultados_parceiro')
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