/*
  # Create links_questoes table

  1. New Tables
    - `links_questoes`
      - `id` (text, primary key)
      - `link` (text)
      - `habilidade_codigo` (text)
      - `componente` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on links_questoes table
    - Add policies for authenticated users to manage links
*/

CREATE TABLE IF NOT EXISTS links_questoes (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  link text NOT NULL,
  habilidade_codigo text NOT NULL,
  componente text NOT NULL CHECK (componente IN ('LP', 'MT')),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE links_questoes ENABLE ROW LEVEL SECURITY;

-- Create policies for links_questoes
CREATE POLICY "Users can read all links"
  ON links_questoes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert links"
  ON links_questoes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update links"
  ON links_questoes
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete links"
  ON links_questoes
  FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_links_questoes_habilidade_componente ON links_questoes(habilidade_codigo, componente);
CREATE INDEX IF NOT EXISTS idx_links_questoes_componente ON links_questoes(componente);