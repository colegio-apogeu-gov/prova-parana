/*
  # FK surrogada das tabelas de prova -> componentes_habilidades

  Contexto:
    As tabelas prova_resultados / prova_resultados_mais / prova_resultados_parceiro guardam os
    descritores de forma DESNORMALIZADA (habilidade_id, habilidade_codigo, descricao_habilidade).
    Esta migration adiciona uma FK surrogada `componente_habilidade_id` apontando para a linha
    correspondente em componentes_habilidades, mantendo as colunas desnormalizadas intactas
    (a exibicao no app continua igual).

  Chave de match (mais confiavel que habilidade_id, cujo formato varia: "H 10" vs "H04"):
    - prova_resultados          (tipo 'prova-parana'): (ano_escolar, componente, posicao=habilidade_codigo)
    - prova_resultados_parceiro (tipo 'parceiro')     : (ano_escolar, componente, posicao=habilidade_codigo)
    - prova_resultados_mais     (tipo 'mais')         : (componente, posicao=habilidade_codigo)
        A tabela mais guarda ano_escolar='EM' para todas as linhas (sem serie), mas cada par
        (componente, posicao) e UNICO dentro de tipo 'mais' (0 ambiguidades verificadas), entao
        o match dispensa o ano_escolar.

  IMPORTANTE: rode DEPOIS da migration 20260712120000 (que recarrega componentes_habilidades).
  Linhas sem descritor correspondente na planilha ficam com componente_habilidade_id = NULL
  (podem ser vinculadas manualmente pela aba "Descritores").
*/

-- 1) Colunas FK ---------------------------------------------------------------
ALTER TABLE prova_resultados
  ADD COLUMN IF NOT EXISTS componente_habilidade_id uuid;
ALTER TABLE prova_resultados_mais
  ADD COLUMN IF NOT EXISTS componente_habilidade_id uuid;
ALTER TABLE prova_resultados_parceiro
  ADD COLUMN IF NOT EXISTS componente_habilidade_id uuid;

ALTER TABLE prova_resultados
  DROP CONSTRAINT IF EXISTS prova_resultados_componente_habilidade_fk;
ALTER TABLE prova_resultados
  ADD CONSTRAINT prova_resultados_componente_habilidade_fk
  FOREIGN KEY (componente_habilidade_id)
  REFERENCES componentes_habilidades(id) ON DELETE SET NULL;

ALTER TABLE prova_resultados_mais
  DROP CONSTRAINT IF EXISTS prova_resultados_mais_componente_habilidade_fk;
ALTER TABLE prova_resultados_mais
  ADD CONSTRAINT prova_resultados_mais_componente_habilidade_fk
  FOREIGN KEY (componente_habilidade_id)
  REFERENCES componentes_habilidades(id) ON DELETE SET NULL;

ALTER TABLE prova_resultados_parceiro
  DROP CONSTRAINT IF EXISTS prova_resultados_parceiro_componente_habilidade_fk;
ALTER TABLE prova_resultados_parceiro
  ADD CONSTRAINT prova_resultados_parceiro_componente_habilidade_fk
  FOREIGN KEY (componente_habilidade_id)
  REFERENCES componentes_habilidades(id) ON DELETE SET NULL;

-- 2) Backfill -----------------------------------------------------------------
-- prova-parana
UPDATE prova_resultados pr
SET componente_habilidade_id = ch.id
FROM componentes_habilidades ch
WHERE ch.tipo_prova = 'prova-parana'
  AND ch.ano_escolar = pr.ano_escolar
  AND ch.componente  = pr.componente
  AND ch.posicao     = pr.habilidade_codigo
  AND pr.componente_habilidade_id IS NULL;

-- parceiro
UPDATE prova_resultados_parceiro pr
SET componente_habilidade_id = ch.id
FROM componentes_habilidades ch
WHERE ch.tipo_prova = 'parceiro'
  AND ch.ano_escolar = pr.ano_escolar
  AND ch.componente  = pr.componente
  AND ch.posicao     = pr.habilidade_codigo
  AND pr.componente_habilidade_id IS NULL;

-- parceiro (fallback): muitas linhas (ex.: 2o e 8o ano) guardam um habilidade_codigo
-- placeholder (ex.: 'H01_LP') que nao casa por posicao. O 'parceiro' tem EDICAO UNICA,
-- entao a POSICAO da habilidade (H01, H02, ...) e estavel e identifica o descritor sem
-- ambiguidade -> casa por (tipo, ano_escolar, componente, habilidade).
UPDATE prova_resultados_parceiro pr
SET componente_habilidade_id = ch.id
FROM componentes_habilidades ch
WHERE ch.tipo_prova = 'parceiro'
  AND ch.ano_escolar = pr.ano_escolar
  AND ch.componente  = pr.componente
  AND ch.habilidade  = 'H' || lpad(regexp_replace(pr.habilidade_id, '\D', '', 'g'), 2, '0')
  AND pr.componente_habilidade_id IS NULL;

-- mais (match por componente + posicao; ano_escolar='EM' nao e usado)
UPDATE prova_resultados_mais pr
SET componente_habilidade_id = ch.id
FROM componentes_habilidades ch
WHERE ch.tipo_prova = 'mais'
  AND ch.componente = pr.componente
  AND ch.posicao    = pr.habilidade_codigo
  AND pr.componente_habilidade_id IS NULL;

-- 3) Indices ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_prova_resultados_comp_hab
  ON prova_resultados(componente_habilidade_id);
CREATE INDEX IF NOT EXISTS idx_prova_resultados_mais_comp_hab
  ON prova_resultados_mais(componente_habilidade_id);
CREATE INDEX IF NOT EXISTS idx_prova_resultados_parceiro_comp_hab
  ON prova_resultados_parceiro(componente_habilidade_id);
