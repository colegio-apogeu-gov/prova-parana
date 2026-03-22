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
        if (value && key !== 'aluno' && key !== 'ano_prova') {
          query = query.eq(key, value);
        }
      });

      // Filtro de ano da prova (baseado em created_at)
      if (searchFilters.ano_prova) {
        const ano = searchFilters.ano_prova;
        const startDate = `${ano}-01-01`;
        const endDate = `${ano}-12-31`;
        query = query.gte('created_at', startDate).lte('created_at', endDate);
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

    let anosQuery = supabase
      .from('prova_resultados_mais')
      .select('created_at')
      .not('created_at', 'is', null)
      .limit(1000);

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
      if (value && key !== 'ano_prova' && key !== 'nome_aluno') {
        anosQuery = anosQuery.eq(key, value);
      }
    });

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

    const [anosResult, niveisResult, habilidadesResult] = await Promise.all([
      anosQuery,
      niveisQuery,
      habilidadesQuery
    ]);

    if (anosResult.error) throw anosResult.error;
    if (niveisResult.error) throw niveisResult.error;
    if (habilidadesResult.error) throw habilidadesResult.error;

    const anosUnicos = [...new Set(
      anosResult.data?.map(item => new Date(item.created_at).getFullYear().toString()).filter(Boolean) || []
    )].sort((a, b) => b.localeCompare(a));

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
      anos: anosUnicos,
      niveis: niveisUnicos,
      habilidades: habilidadesUnicas
    };
  } catch (error) {
    console.error('Erro ao buscar opções de filtro:', error);
    return {
      anos: [],
      niveis: [],
      habilidades: []
    };
  }
};

export const getComparativoEscolasMais = async (filters: any = {}) => {
  try {
    let query = supabase
      .from('prova_resultados_mais')
      .select('unidade, componente_curricular, created_at, proficiencia, ano_escolar');

    Object.entries(filters).forEach(([key, value]) => {
      if (value && key !== 'ano_prova') {
        query = query.eq(key, value);
      }
    });

    const { data, error } = await query;
    if (error) throw error;

    const isEM = filters.ano_escolar?.toUpperCase() === 'EM';

    const escolasMap = new Map<string, {
      lp2024: number[];
      lp2025: number[];
      mat2024: number[];
      mat2025: number[];
      ch2024: number[];
      ch2025: number[];
      cn2024: number[];
      cn2025: number[];
    }>();

    data?.forEach(item => {
      const escola = item.unidade;
      const ano = new Date(item.created_at).getFullYear();
      const componente = item.componente_curricular;
      const proficiencia = Number(item.proficiencia) || 0;

      if (!escola) return;

      if (!escolasMap.has(escola)) {
        escolasMap.set(escola, {
          lp2024: [],
          lp2025: [],
          mat2024: [],
          mat2025: [],
          ch2024: [],
          ch2025: [],
          cn2024: [],
          cn2025: []
        });
      }

      const escolaData = escolasMap.get(escola)!;

      if (componente === 'Língua Portuguesa') {
        if (ano === 2024) escolaData.lp2024.push(proficiencia);
        else if (ano === 2025) escolaData.lp2025.push(proficiencia);
      } else if (componente === 'Matemática') {
        if (ano === 2024) escolaData.mat2024.push(proficiencia);
        else if (ano === 2025) escolaData.mat2025.push(proficiencia);
      } else if (componente === 'Ciências Humanas') {
        if (ano === 2024) escolaData.ch2024.push(proficiencia);
        else if (ano === 2025) escolaData.ch2025.push(proficiencia);
      } else if (componente === 'Ciências da Natureza') {
        if (ano === 2024) escolaData.cn2024.push(proficiencia);
        else if (ano === 2025) escolaData.cn2025.push(proficiencia);
      }
    });

    const resultado = Array.from(escolasMap.entries()).map(([escola, dados]) => {
      const lpMedia2024 = dados.lp2024.length > 0
        ? Math.round(dados.lp2024.reduce((a, b) => a + b, 0) / dados.lp2024.length)
        : null;
      const lpMedia2025 = dados.lp2025.length > 0
        ? Math.round(dados.lp2025.reduce((a, b) => a + b, 0) / dados.lp2025.length)
        : null;
      const matMedia2024 = dados.mat2024.length > 0
        ? Math.round(dados.mat2024.reduce((a, b) => a + b, 0) / dados.mat2024.length)
        : null;
      const matMedia2025 = dados.mat2025.length > 0
        ? Math.round(dados.mat2025.reduce((a, b) => a + b, 0) / dados.mat2025.length)
        : null;

      const chMedia2024 = dados.ch2024.length > 0
        ? Math.round(dados.ch2024.reduce((a, b) => a + b, 0) / dados.ch2024.length)
        : null;
      const chMedia2025 = dados.ch2025.length > 0
        ? Math.round(dados.ch2025.reduce((a, b) => a + b, 0) / dados.ch2025.length)
        : null;
      const cnMedia2024 = dados.cn2024.length > 0
        ? Math.round(dados.cn2024.reduce((a, b) => a + b, 0) / dados.cn2024.length)
        : null;
      const cnMedia2025 = dados.cn2025.length > 0
        ? Math.round(dados.cn2025.reduce((a, b) => a + b, 0) / dados.cn2025.length)
        : null;

      let mediaGeral2024 = null;
      let mediaGeral2025 = null;

      if (isEM) {
        const valores2024 = [lpMedia2024, matMedia2024, chMedia2024, cnMedia2024].filter(v => v !== null) as number[];
        const valores2025 = [lpMedia2025, matMedia2025, chMedia2025, cnMedia2025].filter(v => v !== null) as number[];

        mediaGeral2024 = valores2024.length > 0
          ? Math.round(valores2024.reduce((a, b) => a + b, 0) / valores2024.length)
          : null;
        mediaGeral2025 = valores2025.length > 0
          ? Math.round(valores2025.reduce((a, b) => a + b, 0) / valores2025.length)
          : null;
      } else {
        const valores2024 = [lpMedia2024, matMedia2024].filter(v => v !== null) as number[];
        const valores2025 = [lpMedia2025, matMedia2025].filter(v => v !== null) as number[];

        mediaGeral2024 = valores2024.length > 0
          ? Math.round(valores2024.reduce((a, b) => a + b, 0) / valores2024.length)
          : null;
        mediaGeral2025 = valores2025.length > 0
          ? Math.round(valores2025.reduce((a, b) => a + b, 0) / valores2025.length)
          : null;
      }

      return {
        escola,
        lp2024: lpMedia2024,
        lp2025: lpMedia2025,
        lpDiff: lpMedia2024 !== null && lpMedia2025 !== null ? lpMedia2025 - lpMedia2024 : null,
        mat2024: matMedia2024,
        mat2025: matMedia2025,
        matDiff: matMedia2024 !== null && matMedia2025 !== null ? matMedia2025 - matMedia2024 : null,
        ch2024: chMedia2024,
        ch2025: chMedia2025,
        chDiff: chMedia2024 !== null && chMedia2025 !== null ? chMedia2025 - chMedia2024 : null,
        cn2024: cnMedia2024,
        cn2025: cnMedia2025,
        cnDiff: cnMedia2024 !== null && cnMedia2025 !== null ? cnMedia2025 - cnMedia2024 : null,
        mediaGeral2024,
        mediaGeral2025,
        mediaGeralDiff: mediaGeral2024 !== null && mediaGeral2025 !== null ? mediaGeral2025 - mediaGeral2024 : null
      };
    }).sort((a, b) => a.escola.localeCompare(b.escola));

    const calcularMedia = (arr: (number | null)[]) => {
      const validos = arr.filter(v => v !== null) as number[];
      return validos.length > 0 ? Math.round(validos.reduce((a, b) => a + b, 0) / validos.length) : null;
    };

    const totais: any = {
      escola: 'Geral',
      lp2024: calcularMedia(resultado.map(r => r.lp2024)),
      lp2025: calcularMedia(resultado.map(r => r.lp2025)),
      lpDiff: null,
      mat2024: calcularMedia(resultado.map(r => r.mat2024)),
      mat2025: calcularMedia(resultado.map(r => r.mat2025)),
      matDiff: null,
      ch2024: calcularMedia(resultado.map(r => r.ch2024)),
      ch2025: calcularMedia(resultado.map(r => r.ch2025)),
      chDiff: null,
      cn2024: calcularMedia(resultado.map(r => r.cn2024)),
      cn2025: calcularMedia(resultado.map(r => r.cn2025)),
      cnDiff: null,
      mediaGeral2024: null,
      mediaGeral2025: null,
      mediaGeralDiff: null
    };

    if (totais.lp2024 !== null && totais.lp2025 !== null) {
      totais.lpDiff = totais.lp2025 - totais.lp2024;
    }
    if (totais.mat2024 !== null && totais.mat2025 !== null) {
      totais.matDiff = totais.mat2025 - totais.mat2024;
    }
    if (totais.ch2024 !== null && totais.ch2025 !== null) {
      totais.chDiff = totais.ch2025 - totais.ch2024;
    }
    if (totais.cn2024 !== null && totais.cn2025 !== null) {
      totais.cnDiff = totais.cn2025 - totais.cn2024;
    }

    if (isEM) {
      const valores2024 = [totais.lp2024, totais.mat2024, totais.ch2024, totais.cn2024].filter(v => v !== null) as number[];
      const valores2025 = [totais.lp2025, totais.mat2025, totais.ch2025, totais.cn2025].filter(v => v !== null) as number[];

      totais.mediaGeral2024 = valores2024.length > 0
        ? Math.round(valores2024.reduce((a, b) => a + b, 0) / valores2024.length)
        : null;
      totais.mediaGeral2025 = valores2025.length > 0
        ? Math.round(valores2025.reduce((a, b) => a + b, 0) / valores2025.length)
        : null;
    } else {
      const valores2024 = [totais.lp2024, totais.mat2024].filter(v => v !== null) as number[];
      const valores2025 = [totais.lp2025, totais.mat2025].filter(v => v !== null) as number[];

      totais.mediaGeral2024 = valores2024.length > 0
        ? Math.round(valores2024.reduce((a, b) => a + b, 0) / valores2024.length)
        : null;
      totais.mediaGeral2025 = valores2025.length > 0
        ? Math.round(valores2025.reduce((a, b) => a + b, 0) / valores2025.length)
        : null;
    }

    if (totais.mediaGeral2024 !== null && totais.mediaGeral2025 !== null) {
      totais.mediaGeralDiff = totais.mediaGeral2025 - totais.mediaGeral2024;
    }

    resultado.push(totais);

    return { data: resultado, isEM };
  } catch (error) {
    console.error('Erro ao buscar comparativo de escolas:', error);
    return { data: [], isEM: false };
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
