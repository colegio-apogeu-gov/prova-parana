/*
  # RPCs de agregação para a Comparação Anual (visão de rede / perfil "gestão")

  ## Problema
  O perfil 'gestao' compara TODAS as escolas. O caminho antigo baixava as linhas
  brutas de prova_resultados* (centenas de milhares de registros, paginados de
  1000 em 1000, com ORDER BY) apenas para somar acertos/total no navegador.
  Resultado: `57014 canceling statement due to statement timeout`.

  ## Solução
  Uma função por sistema que devolve o dado JÁ AGREGADO. O retorno tem a ordem
  de ~1.000 linhas (anos × escolas × séries × componentes), o que torna todos os
  filtros da tela (ano, unidade, série, componente) instantâneos e client-side.

  ## Grãos retornados (GROUPING SETS)
  1. (ano_prova, unidade, ano_escolar, componente) — `componente` preenchido.
     Usado para as médias por série × componente.
  2. (ano_prova, unidade, ano_escolar)             — `componente` IS NULL.
     Linha de rollup: `alunos` = alunos DISTINTOS da série somando os
     componentes. Sem ela, contar alunos com o filtro "Componente: Todos"
     contaria duas vezes quem fez LP e MT.

  Como o WHERE exige `componente IS NOT NULL`, um `componente` nulo no
  resultado identifica sem ambiguidade a linha de rollup.

  ## Observações
  - `SECURITY DEFINER`: a função roda com o dono, ignorando RLS. Isso não amplia
    exposição: a app já lê essas tabelas diretamente com a anon key.
  - `SET statement_timeout`: a agregação é uma varredura única (HashAggregate),
    mas o timeout curto padrão do PostgREST pode abortá-la em tabelas grandes.
  - `SET search_path`: obrigatório em SECURITY DEFINER para evitar
    sequestro de search_path.
  - As funções são idempotentes (CREATE OR REPLACE) e podem ser reexecutadas.
*/

-- ---------------------------------------------------------------------------
-- Pré-requisito: a coluna `ano_prova`.
--
-- Ela é usada pela aplicação (upload e filtros) desde sempre, mas NUNCA foi
-- criada por uma migration — só existe nos bancos onde foi adicionada à mão
-- pelo painel do Supabase. Sem isto, aplicar as migrations num banco limpo
-- (CI, staging, recriação) faria as funções e os índices abaixo falharem com
-- `column "ano_prova" does not exist`.
--
-- Idempotente: em bancos que já têm a coluna, é um no-op.
-- ---------------------------------------------------------------------------
ALTER TABLE prova_resultados
  ADD COLUMN IF NOT EXISTS ano_prova text;

ALTER TABLE prova_resultados_parceiro
  ADD COLUMN IF NOT EXISTS ano_prova text;

ALTER TABLE prova_resultados_mais
  ADD COLUMN IF NOT EXISTS ano_prova text;

-- ---------------------------------------------------------------------------
-- Prova Paraná
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_comparacao_anual_prova()
RETURNS TABLE (
  ano_prova    text,
  unidade      text,
  ano_escolar  text,
  componente   text,
  soma_acertos bigint,
  soma_total   bigint,
  alunos       bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '60s'
AS $$
  SELECT
    t.ano_prova,
    t.unidade,
    t.ano_escolar,
    t.componente,
    COALESCE(SUM(t.acertos), 0)::bigint,
    COALESCE(SUM(t.total), 0)::bigint,
    COUNT(DISTINCT t.nome_aluno)::bigint
  FROM prova_resultados t
  WHERE t.avaliado
    AND t.ano_prova   IS NOT NULL AND t.ano_prova <> ''
    AND t.unidade     IS NOT NULL
    AND t.ano_escolar IS NOT NULL
    AND t.componente  IS NOT NULL
    AND t.nome_aluno  IS NOT NULL
  GROUP BY GROUPING SETS (
    (t.ano_prova, t.unidade, t.ano_escolar, t.componente),
    (t.ano_prova, t.unidade, t.ano_escolar)
  );
$$;

-- ---------------------------------------------------------------------------
-- Avaliação Parceiro da Escola
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_comparacao_anual_parceiro()
RETURNS TABLE (
  ano_prova    text,
  unidade      text,
  ano_escolar  text,
  componente   text,
  soma_acertos bigint,
  soma_total   bigint,
  alunos       bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '60s'
AS $$
  SELECT
    t.ano_prova,
    t.unidade,
    t.ano_escolar,
    t.componente,
    COALESCE(SUM(t.acertos), 0)::bigint,
    COALESCE(SUM(t.total), 0)::bigint,
    COUNT(DISTINCT t.nome_aluno)::bigint
  FROM prova_resultados_parceiro t
  WHERE t.avaliado
    AND t.ano_prova   IS NOT NULL AND t.ano_prova <> ''
    AND t.unidade     IS NOT NULL
    AND t.ano_escolar IS NOT NULL
    AND t.componente  IS NOT NULL
    AND t.nome_aluno  IS NOT NULL
  GROUP BY GROUPING SETS (
    (t.ano_prova, t.unidade, t.ano_escolar, t.componente),
    (t.ano_prova, t.unidade, t.ano_escolar)
  );
$$;

-- ---------------------------------------------------------------------------
-- Paraná Mais
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_comparacao_anual_mais()
RETURNS TABLE (
  ano_prova    text,
  unidade      text,
  ano_escolar  text,
  componente   text,
  soma_acertos bigint,
  soma_total   bigint,
  alunos       bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '60s'
AS $$
  SELECT
    t.ano_prova,
    t.unidade,
    t.ano_escolar,
    t.componente,
    COALESCE(SUM(t.acertos), 0)::bigint,
    COALESCE(SUM(t.total), 0)::bigint,
    COUNT(DISTINCT t.nome_aluno)::bigint
  FROM prova_resultados_mais t
  WHERE t.avaliado
    AND t.ano_prova   IS NOT NULL AND t.ano_prova <> ''
    AND t.unidade     IS NOT NULL
    AND t.ano_escolar IS NOT NULL
    AND t.componente  IS NOT NULL
    AND t.nome_aluno  IS NOT NULL
  GROUP BY GROUPING SETS (
    (t.ano_prova, t.unidade, t.ano_escolar, t.componente),
    (t.ano_prova, t.unidade, t.ano_escolar)
  );
$$;

-- ---------------------------------------------------------------------------
-- Permissões: a app acessa o Supabase com a anon key (auth via Firebase).
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION rpc_comparacao_anual_prova()    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rpc_comparacao_anual_parceiro() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rpc_comparacao_anual_mais()     TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Índices de apoio.
--
-- IMPORTANTE: estes índices NÃO aceleram as RPCs acima. A agregação precisa de
-- acertos/total/nome_aluno (colunas não indexadas), então o planner faz uma
-- varredura sequencial + HashAggregate de qualquer forma — o que já é rápido,
-- por ser uma passada única sobre a tabela.
--
-- Eles existem para o caminho do perfil 'admin', que ainda busca linhas brutas
-- com WHERE ano_prova = $1 AND unidade = $2 (fetchAllProvaData*). Nenhum índice
-- atual cobre esse par; só havia um em (unidade).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_prova_resultados_ano_prova_unidade
  ON prova_resultados (ano_prova, unidade);

CREATE INDEX IF NOT EXISTS idx_prova_resultados_parceiro_ano_prova_unidade
  ON prova_resultados_parceiro (ano_prova, unidade);

CREATE INDEX IF NOT EXISTS idx_prova_resultados_mais_ano_prova_unidade
  ON prova_resultados_mais (ano_prova, unidade);
