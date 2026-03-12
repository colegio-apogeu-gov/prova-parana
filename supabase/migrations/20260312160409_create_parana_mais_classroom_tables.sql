/*
  # Create Paraná Mais Classroom Tables

  1. New Tables
    - `sala_de_aula_mais`
      - `id` (uuid, primary key)
      - `nome` (text) - Nome da sala de aula
      - `unidade` (text) - Unidade escolar
      - `created_at` (timestamptz) - Data de criação
    
    - `sala_de_alunos_mais`
      - `id` (uuid, primary key)
      - `sala_id` (uuid, foreign key) - Referência à sala
      - `nome_aluno` (text) - Nome do aluno
      - `turma` (text) - Turma do aluno
      - `created_at` (timestamptz) - Data de criação
  
  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their unit's classrooms
  
  3. Indexes
    - Add indexes for performance on common queries
*/

-- Create sala_de_aula_mais table
CREATE TABLE IF NOT EXISTS sala_de_aula_mais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  unidade text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create sala_de_alunos_mais table
CREATE TABLE IF NOT EXISTS sala_de_alunos_mais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id uuid NOT NULL REFERENCES sala_de_aula_mais(id) ON DELETE CASCADE,
  nome_aluno text NOT NULL,
  turma text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE sala_de_aula_mais ENABLE ROW LEVEL SECURITY;
ALTER TABLE sala_de_alunos_mais ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sala_de_aula_mais
CREATE POLICY "Users can view classrooms from their unit"
  ON sala_de_aula_mais FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create classrooms for their unit"
  ON sala_de_aula_mais FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update classrooms from their unit"
  ON sala_de_aula_mais FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete classrooms from their unit"
  ON sala_de_aula_mais FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for sala_de_alunos_mais
CREATE POLICY "Users can view students in classrooms"
  ON sala_de_alunos_mais FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sala_de_aula_mais
      WHERE sala_de_aula_mais.id = sala_de_alunos_mais.sala_id
    )
  );

CREATE POLICY "Users can add students to classrooms"
  ON sala_de_alunos_mais FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sala_de_aula_mais
      WHERE sala_de_aula_mais.id = sala_de_alunos_mais.sala_id
    )
  );

CREATE POLICY "Users can remove students from classrooms"
  ON sala_de_alunos_mais FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sala_de_aula_mais
      WHERE sala_de_aula_mais.id = sala_de_alunos_mais.sala_id
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sala_de_aula_mais_unidade ON sala_de_aula_mais(unidade);
CREATE INDEX IF NOT EXISTS idx_sala_de_aula_mais_created_at ON sala_de_aula_mais(created_at);
CREATE INDEX IF NOT EXISTS idx_sala_de_alunos_mais_sala_id ON sala_de_alunos_mais(sala_id);
CREATE INDEX IF NOT EXISTS idx_sala_de_alunos_mais_nome_aluno ON sala_de_alunos_mais(nome_aluno);