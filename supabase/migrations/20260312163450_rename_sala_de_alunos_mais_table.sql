/*
  # Rename sala_de_alunos_mais to sala_de_aula_alunos_mais

  1. Changes
    - Rename table `sala_de_alunos_mais` to `sala_de_aula_alunos_mais`
  
  2. Notes
    - This ensures consistency with the expected table name
    - All foreign key relationships are automatically updated
*/

ALTER TABLE IF EXISTS sala_de_alunos_mais 
RENAME TO sala_de_aula_alunos_mais;