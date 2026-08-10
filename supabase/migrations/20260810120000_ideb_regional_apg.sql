/*
  # Regionais das escolas do grupo APG na base do IDEB

  A coluna `regional` de `ideb_resultados` está vazia. Esta migration preenche a
  regional (SJP / GUA / CWT) das 20 escolas do grupo APG, usada como filtro na
  aba IDEB → Histórico.

  ## Por que casar por INEP (e não por nome)
  Nomes como "CARNEIRO", "PAULO FREIRE" e "SANTO AGOSTINHO" são comuns e um
  `WHERE escola ILIKE '%...%'` acertaria escolas de todo o PR. O código INEP é
  único por escola, então o UPDATE atinge exatamente as 20 escolas do grupo
  (todas as edições de cada uma).

  ## Observação
  18 das 20 escolas têm parceiro='apg'; GODOFREDO MACHADO (41137809) e
  HOMERO B DE BARROS (41129806) estão na base SEM a tag de parceiro. Ainda assim
  recebem a regional aqui, e o Histórico foi ajustado para carregá-las quando um
  filtro de regional estiver ativo.

  Não é preciso rodar refresh_ideb_agregado(): o agregado do PR não usa regional.
*/

UPDATE ideb_resultados AS t
SET regional = m.regional
FROM (VALUES
  ('41137329', 'SJP'),  -- ANITA CANET
  ('41137558', 'SJP'),  -- COSTA VIANA
  ('41137809', 'SJP'),  -- GODOFREDO MACHADO
  ('41396030', 'SJP'),  -- PAULO FREIRE
  ('41600894', 'SJP'),  -- TARSILA DO AMARAL
  ('41140060', 'SJP'),  -- TEREZA DA S RAMOS
  ('41134273', 'SJP'),  -- VICTOR DO AMARAL

  ('41099591', 'GUA'),  -- ANTONIO TUPY PINHEIRO
  ('41018206', 'GUA'),  -- CARNEIRO
  ('41100042', 'GUA'),  -- CRISTO REI
  ('41100379', 'GUA'),  -- FRANCISCO C MARTINS
  ('41102363', 'GUA'),  -- GILDO A SCHUCK
  ('41100719', 'GUA'),  -- LIANE MARTA DA COSTA

  ('41134516', 'CWT'),  -- DECIO DOSSI
  ('41129806', 'CWT'),  -- HOMERO B DE BARROS
  ('41129920', 'CWT'),  -- ISABEL L S SOUZA
  ('41129970', 'CWT'),  -- IVO LEAO
  ('41130138', 'CWT'),  -- JOAO DE OLIVEIRA FRANCO
  ('41130162', 'CWT'),  -- JOAO MAZZAROTTO
  ('41133188', 'CWT')   -- SANTO AGOSTINHO
) AS m(inep, regional)
WHERE t.inep_codigo = m.inep;

-- Conferência rápida (esperado: SJP=7, GUA=6, CWT=7 escolas distintas):
-- SELECT regional, count(DISTINCT inep_codigo) FROM ideb_resultados
--  WHERE regional IS NOT NULL GROUP BY regional ORDER BY regional;
