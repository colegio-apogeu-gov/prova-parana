/*
  # RPC: descritores orfaos (linhas de prova sem componente_habilidade_id)

  Usada pela aba "Descritores" para listar, de forma agregada e eficiente (DISTINCT no
  servidor), as combinacoes (ano_escolar, componente, habilidade_id, habilidade_codigo,
  descricao_habilidade) das tabelas de prova cujo componente_habilidade_id ainda e NULL,
  para que o usuario possa vincula-las a um descritor.

  p_tipo: 'prova-parana' | 'mais' | 'parceiro'
  p_unidade: opcional; se informado, restringe a uma escola (o app sempre passa a unidade
             do usuario). IMPORTANTE: implementado em plpgsql com IF/ELSIF para varrer
             APENAS a tabela do tipo pedido (uma versao anterior em SQL/UNION ALL varria as
             3 tabelas em toda chamada e estourava o statement_timeout).
*/
CREATE OR REPLACE FUNCTION rpc_descritores_orfaos(p_tipo text, p_unidade text DEFAULT NULL)
RETURNS TABLE (
  ano_escolar text,
  componente text,
  habilidade_id text,
  habilidade_codigo text,
  descricao_habilidade text,
  qtd bigint
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF p_tipo = 'prova-parana' THEN
    RETURN QUERY
      SELECT pr.ano_escolar, pr.componente, pr.habilidade_id, pr.habilidade_codigo,
             pr.descricao_habilidade, count(*)::bigint
      FROM prova_resultados pr
      WHERE pr.componente_habilidade_id IS NULL
        AND (p_unidade IS NULL OR pr.unidade = p_unidade)
      GROUP BY 1,2,3,4,5
      ORDER BY 1,2,3,4;
  ELSIF p_tipo = 'mais' THEN
    RETURN QUERY
      SELECT pr.ano_escolar, pr.componente, pr.habilidade_id, pr.habilidade_codigo,
             pr.descricao_habilidade, count(*)::bigint
      FROM prova_resultados_mais pr
      WHERE pr.componente_habilidade_id IS NULL
        AND (p_unidade IS NULL OR pr.unidade = p_unidade)
      GROUP BY 1,2,3,4,5
      ORDER BY 1,2,3,4;
  ELSIF p_tipo = 'parceiro' THEN
    RETURN QUERY
      SELECT pr.ano_escolar, pr.componente, pr.habilidade_id, pr.habilidade_codigo,
             pr.descricao_habilidade, count(*)::bigint
      FROM prova_resultados_parceiro pr
      WHERE pr.componente_habilidade_id IS NULL
        AND (p_unidade IS NULL OR pr.unidade = p_unidade)
      GROUP BY 1,2,3,4,5
      ORDER BY 1,2,3,4;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_descritores_orfaos(text, text) TO anon, authenticated;

-- Indices parciais para acelerar a varredura de orfaos (poucas linhas indexadas).
-- (a) por unidade -> acelera a RPC filtrada por escola.
CREATE INDEX IF NOT EXISTS idx_prova_resultados_orfaos
  ON prova_resultados (unidade) WHERE componente_habilidade_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_prova_resultados_mais_orfaos
  ON prova_resultados_mais (unidade) WHERE componente_habilidade_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_prova_resultados_parceiro_orfaos
  ON prova_resultados_parceiro (unidade) WHERE componente_habilidade_id IS NULL;

-- (b) pela combinacao (ano, componente, habilidade_id, habilidade_codigo) -> acelera o
--     UPDATE de vinculo (vincularDescritorAResultados) e o GROUP BY da RPC.
CREATE INDEX IF NOT EXISTS idx_prova_resultados_orfaos_hab
  ON prova_resultados (ano_escolar, componente, habilidade_id, habilidade_codigo)
  WHERE componente_habilidade_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_prova_resultados_mais_orfaos_hab
  ON prova_resultados_mais (ano_escolar, componente, habilidade_id, habilidade_codigo)
  WHERE componente_habilidade_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_prova_resultados_parceiro_orfaos_hab
  ON prova_resultados_parceiro (ano_escolar, componente, habilidade_id, habilidade_codigo)
  WHERE componente_habilidade_id IS NULL;
