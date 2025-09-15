/*
  # Create Avaliação Parceiro da Escola Database Schema

  1. New Tables
    - `prova_resultados_parceiro`
      - Similar to prova_resultados but with specific fields for Parceiro system
      - `proficiencia` (new field)
      - `padrao_desempenho` (replaces nivel_aprendizagem)
      - Years: 8º ano, 2º ano
    - `links_questoes_parceiro`
      - Links for Parceiro system questions
    - `sala_de_aula_parceiro`
      - Classrooms for Parceiro system
    - `sala_de_aula_alunos_parceiros`
      - Students in Parceiro classrooms

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to access their school unit data
*/

-- Create prova_resultados_parceiro table
CREATE TABLE IF NOT EXISTS prova_resultados_parceiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_escolar text NOT NULL CHECK (ano_escolar IN ('8º ano', '2º ano')),
  componente text NOT NULL CHECK (componente IN ('LP', 'MT')),
  semestre text NOT NULL CHECK (semestre IN ('1', '2')),
  unidade text NOT NULL,
  turma text NOT NULL DEFAULT '',
  nome_aluno text NOT NULL DEFAULT '',
  avaliado boolean NOT NULL DEFAULT false,
  proficiencia text DEFAULT '',
  padrao_desempenho text DEFAULT '',
  habilidade_id text NOT NULL DEFAULT '',
  habilidade_codigo text NOT NULL DEFAULT '',
  descricao_habilidade text DEFAULT '',
  acertos integer NOT NULL DEFAULT 0 CHECK (acertos >= 0),
  total integer NOT NULL DEFAULT 0 CHECK (total >= 0),
  percentual float NOT NULL DEFAULT 0 CHECK (percentual >= 0 AND percentual <= 100),
  ano_escolar_resultados text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create links_questoes_parceiro table
CREATE TABLE IF NOT EXISTS links_questoes_parceiro (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  link text NOT NULL,
  habilidade_codigo text NOT NULL,
  componente text NOT NULL CHECK (componente IN ('LP', 'MT')),
  created_at timestamptz DEFAULT now()
);

-- Create sala_de_aula_parceiro table
CREATE TABLE IF NOT EXISTS sala_de_aula_parceiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  unidade text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create sala_de_aula_alunos_parceiros table
CREATE TABLE IF NOT EXISTS sala_de_aula_alunos_parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id uuid NOT NULL REFERENCES sala_de_aula_parceiro(id) ON DELETE CASCADE,
  nome_aluno text NOT NULL,
  turma text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE prova_resultados_parceiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE links_questoes_parceiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE sala_de_aula_parceiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE sala_de_aula_alunos_parceiros ENABLE ROW LEVEL SECURITY;

-- Create policies for prova_resultados_parceiro
CREATE POLICY "Users can read own school unit data parceiro"
  ON prova_resultados_parceiro
  FOR SELECT
  TO authenticated
  USING (
    unidade IN (
      SELECT user_profiles.unidade 
      FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own school unit data parceiro"
  ON prova_resultados_parceiro
  FOR INSERT
  TO authenticated
  WITH CHECK (
    unidade IN (
      SELECT user_profiles.unidade 
      FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can update own school unit data parceiro"
  ON prova_resultados_parceiro
  FOR UPDATE
  TO authenticated
  USING (
    unidade IN (
      SELECT user_profiles.unidade 
      FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
    )
  );

-- Create policies for links_questoes_parceiro
CREATE POLICY "Users can read all links parceiro"
  ON links_questoes_parceiro
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert links parceiro"
  ON links_questoes_parceiro
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update links parceiro"
  ON links_questoes_parceiro
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete links parceiro"
  ON links_questoes_parceiro
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for sala_de_aula_parceiro
CREATE POLICY "Users can read own school unit classrooms parceiro"
  ON sala_de_aula_parceiro
  FOR SELECT
  TO authenticated
  USING (
    unidade IN (
      SELECT user_profiles.unidade 
      FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own school unit classrooms parceiro"
  ON sala_de_aula_parceiro
  FOR INSERT
  TO authenticated
  WITH CHECK (
    unidade IN (
      SELECT user_profiles.unidade 
      FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can update own school unit classrooms parceiro"
  ON sala_de_aula_parceiro
  FOR UPDATE
  TO authenticated
  USING (
    unidade IN (
      SELECT user_profiles.unidade 
      FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own school unit classrooms parceiro"
  ON sala_de_aula_parceiro
  FOR DELETE
  TO authenticated
  USING (
    unidade IN (
      SELECT user_profiles.unidade 
      FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
    )
  );

-- Create policies for sala_de_aula_alunos_parceiros
CREATE POLICY "Users can read classroom students parceiro"
  ON sala_de_aula_alunos_parceiros
  FOR SELECT
  TO authenticated
  USING (
    sala_id IN (
      SELECT sala_de_aula_parceiro.id 
      FROM sala_de_aula_parceiro 
      JOIN user_profiles ON sala_de_aula_parceiro.unidade = user_profiles.unidade
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert classroom students parceiro"
  ON sala_de_aula_alunos_parceiros
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sala_id IN (
      SELECT sala_de_aula_parceiro.id 
      FROM sala_de_aula_parceiro 
      JOIN user_profiles ON sala_de_aula_parceiro.unidade = user_profiles.unidade
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can update classroom students parceiro"
  ON sala_de_aula_alunos_parceiros
  FOR UPDATE
  TO authenticated
  USING (
    sala_id IN (
      SELECT sala_de_aula_parceiro.id 
      FROM sala_de_aula_parceiro 
      JOIN user_profiles ON sala_de_aula_parceiro.unidade = user_profiles.unidade
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete classroom students parceiro"
  ON sala_de_aula_alunos_parceiros
  FOR DELETE
  TO authenticated
  USING (
    sala_id IN (
      SELECT sala_de_aula_parceiro.id 
      FROM sala_de_aula_parceiro 
      JOIN user_profiles ON sala_de_aula_parceiro.unidade = user_profiles.unidade
      WHERE user_profiles.id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prova_resultados_parceiro_unidade ON prova_resultados_parceiro(unidade);
CREATE INDEX IF NOT EXISTS idx_prova_resultados_parceiro_ano_componente ON prova_resultados_parceiro(ano_escolar, componente);
CREATE INDEX IF NOT EXISTS idx_prova_resultados_parceiro_habilidade ON prova_resultados_parceiro(habilidade_id);
CREATE INDEX IF NOT EXISTS idx_prova_resultados_parceiro_turma ON prova_resultados_parceiro(turma);
CREATE INDEX IF NOT EXISTS idx_prova_resultados_parceiro_ano_escolar_resultados ON prova_resultados_parceiro(ano_escolar_resultados);

CREATE INDEX IF NOT EXISTS idx_links_questoes_parceiro_habilidade_componente ON links_questoes_parceiro(habilidade_codigo, componente);
CREATE INDEX IF NOT EXISTS idx_links_questoes_parceiro_componente ON links_questoes_parceiro(componente);

CREATE INDEX IF NOT EXISTS idx_sala_de_aula_parceiro_unidade ON sala_de_aula_parceiro(unidade);
CREATE INDEX IF NOT EXISTS idx_sala_de_aula_alunos_parceiros_sala_id ON sala_de_aula_alunos_parceiros(sala_id);
CREATE INDEX IF NOT EXISTS idx_sala_de_aula_alunos_parceiros_nome ON sala_de_aula_alunos_parceiros(nome_aluno);