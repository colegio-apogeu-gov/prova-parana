/*
  # Adiciona professores por turma/disciplina às salas de aula

  1. Alterações
    - `sala_de_aula`            → nova coluna `professores` (jsonb)
    - `sala_de_aula_parceiro`   → nova coluna `professores` (jsonb)
    - `sala_de_aula_mais`       → nova coluna `professores` (jsonb)

  2. Formato do JSON
    O objeto guarda o nome do professor responsável por cada combinação de
    turma + componente, usando a chave "<turma>||<componente>":

      {
        "9A||LP": "Maria Silva",
        "9A||MT": "João Souza",
        "9B||LP": "Ana Lima"
      }

  3. Observações
    - Coluna opcional, com default '{}'. Não quebra registros existentes.
    - As políticas de UPDATE já existentes nas tabelas de sala cobrem a escrita
      desta coluna (o professor é atualizado via UPDATE na própria linha da sala).
*/

ALTER TABLE sala_de_aula
  ADD COLUMN IF NOT EXISTS professores jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE sala_de_aula_parceiro
  ADD COLUMN IF NOT EXISTS professores jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE sala_de_aula_mais
  ADD COLUMN IF NOT EXISTS professores jsonb NOT NULL DEFAULT '{}'::jsonb;
