/*
  # IDEB / SAEB: tabela ideb_resultados + agregado do Paraná

  Fonte: planilhas do INEP "divulgacao_anos_finais_escolas_2025.xlsx" (6º ao 9º ano,
  edições 2005–2025) e "divulgacao_ensino_medio_escolas_2025.xlsx" (edições 2017–2025).
  Só entram as escolas do Paraná e só as edições em que a escola foi avaliada
  (tem IDEB ou nota SAEB).

  Cada linha é uma escola numa edição de uma etapa:
    - ideb        = IDEB observado (N x P)
    - meta        = projeção do 1º ciclo do IDEB (o INEP só publica até 2021)
    - saeb_mt/lp  = notas SAEB de Matemática e Língua Portuguesa
    - aprendizado = N (nota média padronizada, 0 a 10)
    - fluxo       = P (indicador de rendimento, 0 a 1)
    - aprovacao   = taxa de aprovação total da etapa (%)

  As escolas dos grupos parceiros são marcadas em `parceiro` pelo MESMO código INEP
  usado em enem_resultados ('apg' | 'salta' | 'tom'); is_apogeu = (parceiro = 'apg').

  A carga dos dados fica nas migrations 20260806120010..40_ideb_dados_N.sql e o
  agregado do PR é calculado em 20260806120050_ideb_agregado.sql.
*/

CREATE TABLE IF NOT EXISTS ideb_resultados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano text NOT NULL,                    -- edição do IDEB (2005, 2007, ..., 2025)
  etapa text NOT NULL,                  -- 'anos_finais' | 'ensino_medio'
  inep_codigo text NOT NULL,
  escola text NOT NULL,
  cidade text NOT NULL,
  uf text NOT NULL DEFAULT 'PR',
  regional text,
  rede text,                            -- 'Estadual' | 'Municipal' | 'Federal' | 'Privada'
  ideb numeric,
  meta numeric,
  saeb_mt numeric,
  saeb_lp numeric,
  aprendizado numeric,
  fluxo numeric,
  aprovacao numeric,
  parceiro text,
  is_apogeu boolean NOT NULL DEFAULT false,
  posicao_geral integer,                -- rank no PR por IDEB (dentro de etapa + ano)
  posicao integer,                      -- rank na cidade por IDEB (dentro de etapa + ano)
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ideb_resultados DROP CONSTRAINT IF EXISTS ideb_etapa_check;
ALTER TABLE ideb_resultados ADD CONSTRAINT ideb_etapa_check CHECK (etapa IN ('anos_finais', 'ensino_medio'));
ALTER TABLE ideb_resultados DROP CONSTRAINT IF EXISTS ideb_parceiro_check;
ALTER TABLE ideb_resultados ADD CONSTRAINT ideb_parceiro_check CHECK (parceiro IN ('apg', 'salta', 'tom'));

ALTER TABLE ideb_resultados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ideb_all_public" ON ideb_resultados;
CREATE POLICY "ideb_all_public" ON ideb_resultados FOR ALL TO public USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ideb_etapa_ano ON ideb_resultados (etapa, ano);
CREATE INDEX IF NOT EXISTS idx_ideb_parceiro ON ideb_resultados (parceiro);
CREATE INDEX IF NOT EXISTS idx_ideb_apogeu ON ideb_resultados (is_apogeu);
CREATE INDEX IF NOT EXISTS idx_ideb_inep ON ideb_resultados (inep_codigo);
CREATE INDEX IF NOT EXISTS idx_ideb_cidade ON ideb_resultados (cidade);

-- Recarga idempotente: as migrations de dados sempre reinserem tudo.
DELETE FROM ideb_resultados;

/*
  Agregado do Paraná por etapa/edição. É tabela (e não view) de propósito: a aba
  "Histórico" precisa da média do estado em todas as edições sem baixar as ~22 mil
  linhas da base para o navegador, e uma tabela simples é sempre exposta pelo
  PostgREST, sem depender de grants extras em views.
*/
CREATE TABLE IF NOT EXISTS ideb_pr_agregado (
  etapa text NOT NULL,
  ano text NOT NULL,
  escolas integer NOT NULL DEFAULT 0,
  ideb numeric,
  saeb_mt numeric,
  saeb_lp numeric,
  aprendizado numeric,
  fluxo numeric,
  aprovacao numeric,
  escolas_estadual integer NOT NULL DEFAULT 0,
  ideb_estadual numeric,
  saeb_mt_estadual numeric,
  saeb_lp_estadual numeric,
  atualizado_em timestamptz DEFAULT now(),
  PRIMARY KEY (etapa, ano)
);

ALTER TABLE ideb_pr_agregado ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ideb_agregado_all_public" ON ideb_pr_agregado;
CREATE POLICY "ideb_agregado_all_public" ON ideb_pr_agregado FOR ALL TO public USING (true) WITH CHECK (true);

-- Recalcula o agregado a partir de ideb_resultados. Rodar sempre depois de recarregar os dados.
CREATE OR REPLACE FUNCTION refresh_ideb_agregado()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM ideb_pr_agregado;

  INSERT INTO ideb_pr_agregado (
    etapa, ano, escolas, ideb, saeb_mt, saeb_lp, aprendizado, fluxo, aprovacao,
    escolas_estadual, ideb_estadual, saeb_mt_estadual, saeb_lp_estadual, atualizado_em
  )
  SELECT
    etapa,
    ano,
    count(*) FILTER (WHERE ideb IS NOT NULL),
    round(avg(ideb), 3),
    round(avg(saeb_mt), 2),
    round(avg(saeb_lp), 2),
    round(avg(aprendizado), 3),
    round(avg(fluxo), 4),
    round(avg(aprovacao), 2),
    count(*) FILTER (WHERE ideb IS NOT NULL AND rede = 'Estadual'),
    round(avg(ideb) FILTER (WHERE rede = 'Estadual'), 3),
    round(avg(saeb_mt) FILTER (WHERE rede = 'Estadual'), 2),
    round(avg(saeb_lp) FILTER (WHERE rede = 'Estadual'), 2),
    now()
  FROM ideb_resultados
  WHERE uf = 'PR'
  GROUP BY etapa, ano;
END;
$$;
