/*
  # Create Sala de Aula Management System

  1. New Tables
    - `sala_de_aula`
      - `id` (uuid, primary key)
      - `nome` (text)
      - `unidade` (text)
      - `created_at` (timestamp)
    - `sala_de_aula_alunos`
      - `id` (uuid, primary key)
      - `sala_id` (uuid, references sala_de_aula)
      - `nome_aluno` (text)
      - `turma` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their school unit classrooms
*/

-- Create sala_de_aula table
CREATE TABLE IF NOT EXISTS sala_de_aula (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  unidade text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create sala_de_aula_alunos table
CREATE TABLE IF NOT EXISTS sala_de_aula_alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id uuid NOT NULL REFERENCES sala_de_aula(id) ON DELETE CASCADE,
  nome_aluno text NOT NULL,
  turma text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE sala_de_aula ENABLE ROW LEVEL SECURITY;
ALTER TABLE sala_de_aula_alunos ENABLE ROW LEVEL SECURITY;

-- Create policies for sala_de_aula
CREATE POLICY "Users can read own school unit classrooms"
  ON sala_de_aula
  FOR SELECT
  TO authenticated
  USING (
    unidade IN (
      SELECT user_profiles.unidade 
      FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own school unit classrooms"
  ON sala_de_aula
  FOR INSERT
  TO authenticated
  WITH CHECK (
    unidade IN (
      SELECT user_profiles.unidade 
      FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can update own school unit classrooms"
  ON sala_de_aula
  FOR UPDATE
  TO authenticated
  USING (
    unidade IN (
      SELECT user_profiles.unidade 
      FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own school unit classrooms"
  ON sala_de_aula
  FOR DELETE
  TO authenticated
  USING (
    unidade IN (
      SELECT user_profiles.unidade 
      FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
    )
  );

-- Create policies for sala_de_aula_alunos
CREATE POLICY "Users can read classroom students"
  ON sala_de_aula_alunos
  FOR SELECT
  TO authenticated
  USING (
    sala_id IN (
      SELECT sala_de_aula.id 
      FROM sala_de_aula 
      JOIN user_profiles ON sala_de_aula.unidade = user_profiles.unidade
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert classroom students"
  ON sala_de_aula_alunos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sala_id IN (
      SELECT sala_de_aula.id 
      FROM sala_de_aula 
      JOIN user_profiles ON sala_de_aula.unidade = user_profiles.unidade
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can update classroom students"
  ON sala_de_aula_alunos
  FOR UPDATE
  TO authenticated
  USING (
    sala_id IN (
      SELECT sala_de_aula.id 
      FROM sala_de_aula 
      JOIN user_profiles ON sala_de_aula.unidade = user_profiles.unidade
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete classroom students"
  ON sala_de_aula_alunos
  FOR DELETE
  TO authenticated
  USING (
    sala_id IN (
      SELECT sala_de_aula.id 
      FROM sala_de_aula 
      JOIN user_profiles ON sala_de_aula.unidade = user_profiles.unidade
      WHERE user_profiles.id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sala_de_aula_unidade ON sala_de_aula(unidade);
CREATE INDEX IF NOT EXISTS idx_sala_de_aula_alunos_sala_id ON sala_de_aula_alunos(sala_id);
CREATE INDEX IF NOT EXISTS idx_sala_de_aula_alunos_nome ON sala_de_aula_alunos(nome_aluno);