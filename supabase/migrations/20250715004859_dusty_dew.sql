/*
  # Create Prova Paraná Database Schema

  1. New Tables
    - `user_profiles`
      - `id` (uuid, references auth.users)
      - `email` (text)
      - `unidade` (text)
      - `created_at` (timestamp)
    - `prova_resultados`
      - `id` (uuid, primary key)
      - `ano_escolar` (text)
      - `componente` (text)
      - `semestre` (text)
      - `unidade` (text)
      - `turma` (text)
      - `nome_aluno` (text)
      - `avaliado` (boolean)
      - `nivel_aprendizagem` (text)
      - `habilidade_id` (text)
      - `habilidade_codigo` (text)
      - `descricao_habilidade` (text)
      - `acertos` (integer)
      - `total` (integer)
      - `percentual` (float)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to access their school unit data
    - Users can only see data from their assigned unidade
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  unidade text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create prova_resultados table
CREATE TABLE IF NOT EXISTS prova_resultados (
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
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE prova_resultados ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create policies for prova_resultados
CREATE POLICY "Users can read own school unit data"
  ON prova_resultados
  FOR SELECT
  TO authenticated
  USING (
    unidade IN (
      SELECT user_profiles.unidade 
      FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own school unit data"
  ON prova_resultados
  FOR INSERT
  TO authenticated
  WITH CHECK (
    unidade IN (
      SELECT user_profiles.unidade 
      FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
    )
  );

CREATE POLICY "Users can update own school unit data"
  ON prova_resultados
  FOR UPDATE
  TO authenticated
  USING (
    unidade IN (
      SELECT user_profiles.unidade 
      FROM user_profiles 
      WHERE user_profiles.id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prova_resultados_unidade ON prova_resultados(unidade);
CREATE INDEX IF NOT EXISTS idx_prova_resultados_ano_componente ON prova_resultados(ano_escolar, componente);
CREATE INDEX IF NOT EXISTS idx_prova_resultados_habilidade ON prova_resultados(habilidade_id);
CREATE INDEX IF NOT EXISTS idx_prova_resultados_turma ON prova_resultados(turma);
CREATE INDEX IF NOT EXISTS idx_user_profiles_unidade ON user_profiles(unidade);