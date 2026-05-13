/*
  # Create Paraná Mais Database Schema

  Tables for Paraná Mais assessment system with same structure as Prova Paraná
*/

CREATE TABLE IF NOT EXISTS prova_resultados_mais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_escolar text NOT NULL CHECK (ano_escolar IN ('9º ano', '3º ano')),
  componente text NOT NULL CHECK (componente IN ('LP', 'MT')),
  semestre text NOT NULL CHECK (semestre IN ('1', '2')),
  unidade text NOT NULL,
  turma text NOT NULL DEFAULT '',
  nome_aluno text NOT NULL DEFAULT '',
  avaliado boolean NOT NULL DEFAULT false,
  nivel_aprendizagem text DEFAULT '',
  habilidade_id text NOT NULL DEFAULT '',
  habilidade_codigo text NOT NULL DEFAULT '',
  descricao_habilidade text DEFAULT '',
  acertos integer NOT NULL DEFAULT 0 CHECK (acertos >= 0),
  total integer NOT NULL DEFAULT 0 CHECK (total >= 0),
  percentual float NOT NULL DEFAULT 0 CHECK (percentual >= 0 AND percentual <= 100),
  ano_escolar_resultados text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS links_questoes_mais (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  link text NOT NULL,
  habilidade_codigo text NOT NULL,
  componente text NOT NULL CHECK (componente IN ('LP', 'MT')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sala_de_aula_mais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  unidade text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sala_de_aula_alunos_mais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id uuid NOT NULL REFERENCES sala_de_aula_mais(id) ON DELETE CASCADE,
  nome_aluno text NOT NULL,
  turma text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE prova_resultados_mais ENABLE ROW LEVEL SECURITY;
ALTER TABLE links_questoes_mais ENABLE ROW LEVEL SECURITY;
ALTER TABLE sala_de_aula_mais ENABLE ROW LEVEL SECURITY;
ALTER TABLE sala_de_aula_alunos_mais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own school unit data mais"
  ON prova_resultados_mais
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own school unit data mais"
  ON prova_resultados_mais
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own school unit data mais"
  ON prova_resultados_mais
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can read all links mais"
  ON links_questoes_mais
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert links mais"
  ON links_questoes_mais
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update links mais"
  ON links_questoes_mais
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete links mais"
  ON links_questoes_mais
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Users can read classroom data mais"
  ON sala_de_aula_mais
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert classroom data mais"
  ON sala_de_aula_mais
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update classroom data mais"
  ON sala_de_aula_mais
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete classroom data mais"
  ON sala_de_aula_mais
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Users can read classroom students mais"
  ON sala_de_aula_alunos_mais
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert classroom students mais"
  ON sala_de_aula_alunos_mais
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update classroom students mais"
  ON sala_de_aula_alunos_mais
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete classroom students mais"
  ON sala_de_aula_alunos_mais
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_prova_resultados_mais_unidade ON prova_resultados_mais(unidade);
CREATE INDEX IF NOT EXISTS idx_prova_resultados_mais_ano_componente ON prova_resultados_mais(ano_escolar, componente);
CREATE INDEX IF NOT EXISTS idx_prova_resultados_mais_habilidade ON prova_resultados_mais(habilidade_id);
CREATE INDEX IF NOT EXISTS idx_prova_resultados_mais_turma ON prova_resultados_mais(turma);
CREATE INDEX IF NOT EXISTS idx_links_questoes_mais_habilidade ON links_questoes_mais(habilidade_codigo);
CREATE INDEX IF NOT EXISTS idx_sala_de_aula_mais_unidade ON sala_de_aula_mais(unidade);
CREATE INDEX IF NOT EXISTS idx_sala_de_aula_alunos_mais_sala_id ON sala_de_aula_alunos_mais(sala_id);
