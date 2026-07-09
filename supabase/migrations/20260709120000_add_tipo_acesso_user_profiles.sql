/*
  # Adiciona tipo de acesso ao perfil de usuário

  1. Alterações
    - `user_profiles` → nova coluna `tipo_acesso` (text)

  2. Valores
    - 'admin'  (padrão): comportamento atual — os dados ficam restritos à
      unidade (escola) do próprio usuário.
    - 'gestao': igual ao admin em todo o sistema, EXCETO na tela
      "Comparação Anual", onde enxerga todas as escolas e pode restringir
      a visão por meio de um filtro de multi-seleção de unidades.

  3. Como promover um usuário a gestão
      UPDATE user_profiles
         SET tipo_acesso = 'gestao'
       WHERE email = 'fulano@apggov.com.br';

  4. Observações
    - Coluna com DEFAULT 'admin' e NOT NULL: perfis existentes continuam
      exatamente com o comportamento atual, sem necessidade de backfill manual.
    - O CHECK impede valores inesperados chegarem ao front-end.
    - Atenção (segurança): hoje o isolamento por unidade é aplicado no
      cliente (a app autentica via Firebase e acessa o Supabase com a anon
      key, portanto auth.uid() é nulo e as policies "TO authenticated" não
      se aplicam). Esta coluna é, portanto, um controle de INTERFACE, não uma
      barreira de banco. Se for necessário isolamento real, as policies de
      prova_resultados* precisam ser revistas junto com o modelo de auth.
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS tipo_acesso text NOT NULL DEFAULT 'admin';

-- Garante que apenas valores conhecidos sejam gravados.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_tipo_acesso_check'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_tipo_acesso_check
      CHECK (tipo_acesso IN ('admin', 'gestao'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_tipo_acesso ON user_profiles(tipo_acesso);
