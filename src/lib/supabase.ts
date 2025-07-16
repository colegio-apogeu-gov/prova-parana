import { createClient } from '@supabase/supabase-js';
import { auth } from './firebase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to get authenticated Supabase client
export const getAuthenticatedSupabase = async () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Usuário não autenticado');
  }
  
  const token = await user.getIdToken();
  
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};

export const uploadProvaData = async (data: any[]) => {
  const authenticatedSupabase = await getAuthenticatedSupabase();
  const { data: result, error } = await authenticatedSupabase
    .from('prova_resultados')
    .insert(data);
  
  if (error) throw error;
  return result;
};

export const fetchProvaData = async (filters: any = {}) => {
  const authenticatedSupabase = await getAuthenticatedSupabase();
  
  // Debug: buscar algumas unidades do banco para comparação
  const { data: sampleUnidades } = await authenticatedSupabase
    .from('prova_resultados')
    .select('unidade')
    .limit(10);
  
  if (sampleUnidades) {
    const uniqueUnidades = [...new Set(sampleUnidades.map(item => item.unidade))];
    uniqueUnidades.forEach(unidade => console.log(`"${unidade}"`));
  }

  // Função para buscar dados com filtros específicos
  const searchWithFilters = async (searchFilters: any) => {
    const allData: any[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      let query = authenticatedSupabase
        .from('prova_resultados')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      // Apply filters
      Object.entries(searchFilters).forEach(([key, value]) => {
        if (value) {
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

    let result = await searchWithFilters(filters);
    
    if (result.length === 0) {
      // Estratégia 2: Remove vírgulas e normaliza hífens
      const cleanValue = originalUnidade
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
          
          let query = authenticatedSupabase
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
  const authenticatedSupabase = await getAuthenticatedSupabase();
  const { data, error } = await authenticatedSupabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error) throw error;
  return data;
};

export const createUserProfile = async (profile: any) => {
  const authenticatedSupabase = await getAuthenticatedSupabase();
  const { data, error } = await authenticatedSupabase
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