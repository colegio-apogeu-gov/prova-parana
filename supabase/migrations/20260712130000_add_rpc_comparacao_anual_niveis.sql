/*
  # RPCs de agregacao por NIVEL DE APRENDIZAGEM para a Comparacao Anual

  Complementa as rpc_comparacao_anual_* (que agregam por serie x componente) com a
  quebra por nivel de aprendizagem, usada pela coluna e pelo filtro "Nivel Aprendizagem"
  da aba Comparacao Anual (perfil gestao / visao de rede).

  Grao: (ano_prova, unidade, ano_escolar, componente, nivel).
    - prova/mais: nivel = nivel_aprendizagem
    - parceiro  : nivel = padrao_desempenho
  Retorna soma de acertos/total (para recalcular a media do nivel) e alunos DISTINTOS
  do nivel. Somar entre unidades e seguro (conjuntos disjuntos por escola).

  Segue o mesmo padrao das rpc_comparacao_anual_* (SECURITY DEFINER, search_path,
  statement_timeout) e nao altera aquelas funcoes.
*/

CREATE OR REPLACE FUNCTION rpc_comparacao_anual_niveis_prova()
RETURNS TABLE (
  ano_prova    text,
  unidade      text,
  ano_escolar  text,
  componente   text,
  nivel        text,
  soma_acertos bigint,
  soma_total   bigint,
  alunos       bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '60s'
AS $$
  SELECT
    t.ano_prova, t.unidade, t.ano_escolar, t.componente, t.nivel_aprendizagem,
    COALESCE(SUM(t.acertos), 0)::bigint,
    COALESCE(SUM(t.total), 0)::bigint,
    COUNT(DISTINCT t.nome_aluno)::bigint
  FROM prova_resultados t
  WHERE t.avaliado
    AND t.ano_prova IS NOT NULL AND t.ano_prova <> ''
    AND t.unidade IS NOT NULL
    AND t.ano_escolar IS NOT NULL
    AND t.componente IS NOT NULL
    AND t.nome_aluno IS NOT NULL
    AND t.nivel_aprendizagem IS NOT NULL AND t.nivel_aprendizagem <> ''
  GROUP BY t.ano_prova, t.unidade, t.ano_escolar, t.componente, t.nivel_aprendizagem;
$$;

CREATE OR REPLACE FUNCTION rpc_comparacao_anual_niveis_parceiro()
RETURNS TABLE (
  ano_prova    text,
  unidade      text,
  ano_escolar  text,
  componente   text,
  nivel        text,
  soma_acertos bigint,
  soma_total   bigint,
  alunos       bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '60s'
AS $$
  SELECT
    t.ano_prova, t.unidade, t.ano_escolar, t.componente, t.padrao_desempenho,
    COALESCE(SUM(t.acertos), 0)::bigint,
    COALESCE(SUM(t.total), 0)::bigint,
    COUNT(DISTINCT t.nome_aluno)::bigint
  FROM prova_resultados_parceiro t
  WHERE t.avaliado
    AND t.ano_prova IS NOT NULL AND t.ano_prova <> ''
    AND t.unidade IS NOT NULL
    AND t.ano_escolar IS NOT NULL
    AND t.componente IS NOT NULL
    AND t.nome_aluno IS NOT NULL
    AND t.padrao_desempenho IS NOT NULL AND t.padrao_desempenho <> ''
  GROUP BY t.ano_prova, t.unidade, t.ano_escolar, t.componente, t.padrao_desempenho;
$$;

CREATE OR REPLACE FUNCTION rpc_comparacao_anual_niveis_mais()
RETURNS TABLE (
  ano_prova    text,
  unidade      text,
  ano_escolar  text,
  componente   text,
  nivel        text,
  soma_acertos bigint,
  soma_total   bigint,
  alunos       bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '60s'
AS $$
  SELECT
    t.ano_prova, t.unidade, t.ano_escolar, t.componente, t.nivel_aprendizagem,
    COALESCE(SUM(t.acertos), 0)::bigint,
    COALESCE(SUM(t.total), 0)::bigint,
    COUNT(DISTINCT t.nome_aluno)::bigint
  FROM prova_resultados_mais t
  WHERE t.avaliado
    AND t.ano_prova IS NOT NULL AND t.ano_prova <> ''
    AND t.unidade IS NOT NULL
    AND t.ano_escolar IS NOT NULL
    AND t.componente IS NOT NULL
    AND t.nome_aluno IS NOT NULL
    AND t.nivel_aprendizagem IS NOT NULL AND t.nivel_aprendizagem <> ''
  GROUP BY t.ano_prova, t.unidade, t.ano_escolar, t.componente, t.nivel_aprendizagem;
$$;

GRANT EXECUTE ON FUNCTION rpc_comparacao_anual_niveis_prova()    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rpc_comparacao_anual_niveis_parceiro() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rpc_comparacao_anual_niveis_mais()     TO anon, authenticated;
