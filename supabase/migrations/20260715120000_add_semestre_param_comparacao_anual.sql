/*
  # Comparação Anual: filtro opcional por semestre (p_semestre)

  Adiciona um parâmetro `p_semestre` (NULL = todos os semestres, como antes) às RPCs de
  agregação da Comparação Anual, filtrando no servidor. Isso mantém a contagem de alunos
  DISTINTOS correta por recorte (um filtro client-side sobre agregados que já somam os dois
  semestres duplicaria alunos que fizeram S1 e S2).

  Como a assinatura muda (0 -> 1 arg com default), é preciso DROPar a versão antiga antes do
  CREATE, senão o PostgREST fica com duas sobrecargas e a chamada sem args vira ambígua.
*/

-- ===== agregação principal (série × componente) =====
DROP FUNCTION IF EXISTS rpc_comparacao_anual_prova();
DROP FUNCTION IF EXISTS rpc_comparacao_anual_parceiro();
DROP FUNCTION IF EXISTS rpc_comparacao_anual_mais();

CREATE OR REPLACE FUNCTION rpc_comparacao_anual_prova(p_semestre text DEFAULT NULL)
RETURNS TABLE (ano_prova text, unidade text, ano_escolar text, componente text,
               soma_acertos bigint, soma_total bigint, alunos bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET statement_timeout = '60s'
AS $$
  SELECT t.ano_prova, t.unidade, t.ano_escolar, t.componente,
         COALESCE(SUM(t.acertos),0)::bigint, COALESCE(SUM(t.total),0)::bigint, COUNT(DISTINCT t.nome_aluno)::bigint
  FROM prova_resultados t
  WHERE t.avaliado AND t.ano_prova IS NOT NULL AND t.ano_prova <> ''
    AND t.unidade IS NOT NULL AND t.ano_escolar IS NOT NULL AND t.componente IS NOT NULL AND t.nome_aluno IS NOT NULL
    AND (p_semestre IS NULL OR t.semestre = p_semestre)
  GROUP BY GROUPING SETS ((t.ano_prova,t.unidade,t.ano_escolar,t.componente),(t.ano_prova,t.unidade,t.ano_escolar));
$$;

CREATE OR REPLACE FUNCTION rpc_comparacao_anual_parceiro(p_semestre text DEFAULT NULL)
RETURNS TABLE (ano_prova text, unidade text, ano_escolar text, componente text,
               soma_acertos bigint, soma_total bigint, alunos bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET statement_timeout = '60s'
AS $$
  SELECT t.ano_prova, t.unidade, t.ano_escolar, t.componente,
         COALESCE(SUM(t.acertos),0)::bigint, COALESCE(SUM(t.total),0)::bigint, COUNT(DISTINCT t.nome_aluno)::bigint
  FROM prova_resultados_parceiro t
  WHERE t.avaliado AND t.ano_prova IS NOT NULL AND t.ano_prova <> ''
    AND t.unidade IS NOT NULL AND t.ano_escolar IS NOT NULL AND t.componente IS NOT NULL AND t.nome_aluno IS NOT NULL
    AND (p_semestre IS NULL OR t.semestre = p_semestre)
  GROUP BY GROUPING SETS ((t.ano_prova,t.unidade,t.ano_escolar,t.componente),(t.ano_prova,t.unidade,t.ano_escolar));
$$;

CREATE OR REPLACE FUNCTION rpc_comparacao_anual_mais(p_semestre text DEFAULT NULL)
RETURNS TABLE (ano_prova text, unidade text, ano_escolar text, componente text,
               soma_acertos bigint, soma_total bigint, alunos bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET statement_timeout = '60s'
AS $$
  SELECT t.ano_prova, t.unidade, t.ano_escolar, t.componente,
         COALESCE(SUM(t.acertos),0)::bigint, COALESCE(SUM(t.total),0)::bigint, COUNT(DISTINCT t.nome_aluno)::bigint
  FROM prova_resultados_mais t
  WHERE t.avaliado AND t.ano_prova IS NOT NULL AND t.ano_prova <> ''
    AND t.unidade IS NOT NULL AND t.ano_escolar IS NOT NULL AND t.componente IS NOT NULL AND t.nome_aluno IS NOT NULL
    AND (p_semestre IS NULL OR t.semestre = p_semestre)
  GROUP BY GROUPING SETS ((t.ano_prova,t.unidade,t.ano_escolar,t.componente),(t.ano_prova,t.unidade,t.ano_escolar));
$$;

-- ===== agregação por nível =====
DROP FUNCTION IF EXISTS rpc_comparacao_anual_niveis_prova();
DROP FUNCTION IF EXISTS rpc_comparacao_anual_niveis_parceiro();
DROP FUNCTION IF EXISTS rpc_comparacao_anual_niveis_mais();

CREATE OR REPLACE FUNCTION rpc_comparacao_anual_niveis_prova(p_semestre text DEFAULT NULL)
RETURNS TABLE (ano_prova text, unidade text, ano_escolar text, componente text, nivel text,
               soma_acertos bigint, soma_total bigint, alunos bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET statement_timeout = '60s'
AS $$
  SELECT t.ano_prova, t.unidade, t.ano_escolar, t.componente, t.nivel_aprendizagem,
         COALESCE(SUM(t.acertos),0)::bigint, COALESCE(SUM(t.total),0)::bigint, COUNT(DISTINCT t.nome_aluno)::bigint
  FROM prova_resultados t
  WHERE t.avaliado AND t.ano_prova IS NOT NULL AND t.ano_prova <> ''
    AND t.unidade IS NOT NULL AND t.ano_escolar IS NOT NULL AND t.componente IS NOT NULL AND t.nome_aluno IS NOT NULL
    AND t.nivel_aprendizagem IS NOT NULL AND t.nivel_aprendizagem <> ''
    AND (p_semestre IS NULL OR t.semestre = p_semestre)
  GROUP BY t.ano_prova, t.unidade, t.ano_escolar, t.componente, t.nivel_aprendizagem;
$$;

CREATE OR REPLACE FUNCTION rpc_comparacao_anual_niveis_parceiro(p_semestre text DEFAULT NULL)
RETURNS TABLE (ano_prova text, unidade text, ano_escolar text, componente text, nivel text,
               soma_acertos bigint, soma_total bigint, alunos bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET statement_timeout = '60s'
AS $$
  SELECT t.ano_prova, t.unidade, t.ano_escolar, t.componente, t.padrao_desempenho,
         COALESCE(SUM(t.acertos),0)::bigint, COALESCE(SUM(t.total),0)::bigint, COUNT(DISTINCT t.nome_aluno)::bigint
  FROM prova_resultados_parceiro t
  WHERE t.avaliado AND t.ano_prova IS NOT NULL AND t.ano_prova <> ''
    AND t.unidade IS NOT NULL AND t.ano_escolar IS NOT NULL AND t.componente IS NOT NULL AND t.nome_aluno IS NOT NULL
    AND t.padrao_desempenho IS NOT NULL AND t.padrao_desempenho <> ''
    AND (p_semestre IS NULL OR t.semestre = p_semestre)
  GROUP BY t.ano_prova, t.unidade, t.ano_escolar, t.componente, t.padrao_desempenho;
$$;

CREATE OR REPLACE FUNCTION rpc_comparacao_anual_niveis_mais(p_semestre text DEFAULT NULL)
RETURNS TABLE (ano_prova text, unidade text, ano_escolar text, componente text, nivel text,
               soma_acertos bigint, soma_total bigint, alunos bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp SET statement_timeout = '60s'
AS $$
  SELECT t.ano_prova, t.unidade, t.ano_escolar, t.componente, t.nivel_aprendizagem,
         COALESCE(SUM(t.acertos),0)::bigint, COALESCE(SUM(t.total),0)::bigint, COUNT(DISTINCT t.nome_aluno)::bigint
  FROM prova_resultados_mais t
  WHERE t.avaliado AND t.ano_prova IS NOT NULL AND t.ano_prova <> ''
    AND t.unidade IS NOT NULL AND t.ano_escolar IS NOT NULL AND t.componente IS NOT NULL AND t.nome_aluno IS NOT NULL
    AND t.nivel_aprendizagem IS NOT NULL AND t.nivel_aprendizagem <> ''
    AND (p_semestre IS NULL OR t.semestre = p_semestre)
  GROUP BY t.ano_prova, t.unidade, t.ano_escolar, t.componente, t.nivel_aprendizagem;
$$;

GRANT EXECUTE ON FUNCTION rpc_comparacao_anual_prova(text)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rpc_comparacao_anual_parceiro(text)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rpc_comparacao_anual_mais(text)          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rpc_comparacao_anual_niveis_prova(text)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rpc_comparacao_anual_niveis_parceiro(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rpc_comparacao_anual_niveis_mais(text)     TO anon, authenticated;
