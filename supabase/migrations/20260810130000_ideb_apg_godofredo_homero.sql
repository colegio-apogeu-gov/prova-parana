/*
  # Marca GODOFREDO MACHADO e HOMERO B DE BARROS como grupo APG na base do IDEB

  As duas escolas pertencem ao grupo APG (constam em UNIDADES_ESCOLARES e já
  receberam regional na migration 20260810120000), mas a carga do IDEB não as
  marcou com parceiro='apg' — por isso ficavam de fora do grupo APG nas telas.

  Isto as inclui no grupo. Como `is_apogeu` é coluna ARMAZENADA (não gerada),
  os dois campos são atualizados juntos.

  ## Escolas (casadas por INEP, todas as edições)
    - 41137809  GODOFREDO MACHADO E EEF  (São José dos Pinhais)
    - 41129806  HOMERO B DE BARROS C EEFM (Curitiba)

  Ambas têm apenas a etapa "anos_finais" na base; o grupo APG do ensino médio
  não muda. Efeito colateral esperado (todas as telas que usam is_apogeu):
    - Dashboard "Média parceiros APG", Consolidado e Histórico (Grupo Apogeu)
      passam a incluir as duas nos anos finais.
    - Aba "Desempenho": o grupo APG dos anos finais passa de 17 para 19 escolas
      (GODOFREDO tem IDEB 6,2 em 2025), o que reordena os rankings de acordo.

  A restrição ideb_parceiro_check permite 'apg'. Idempotente: reexecutar não muda
  o resultado.
*/

UPDATE ideb_resultados
SET parceiro = 'apg',
    is_apogeu = true
WHERE inep_codigo IN ('41137809', '41129806');

-- Conferência (esperado: 2 escolas distintas, ambas em anos_finais):
-- SELECT inep_codigo, escola, count(*) FROM ideb_resultados
--  WHERE inep_codigo IN ('41137809','41129806') GROUP BY inep_codigo, escola;
