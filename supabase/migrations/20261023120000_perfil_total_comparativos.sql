/*
  # Perfil de acesso 'total' (comparativos dos parceiros no ENEM e no IDEB)

  1. Alterações
    - `user_profiles.tipo_acesso` passa a aceitar 'total'.
    - As abas "Consolidado APG-Salta-Tom" do ENEM e do IDEB ficam restritas aos perfis
      'gestao' e 'total' (ver podeVerComparativos em src/types). O 'admin' deixa de vê-las.
    - 'total' é igual ao 'admin' em todo o resto do sistema; só acrescenta os comparativos.

  2. Usuários liberados
    - teste@gmail.com, andre.dutra, andreia.gruntowski e ana.bernardino -> 'total'.
    - bruna.luch e frederico.melo já são 'gestao' e mantêm o perfil (gestão inclui os
      comparativos), por isso o UPDATE não toca em quem é 'gestao'.

  3. Como liberar para outro usuário
      UPDATE user_profiles SET tipo_acesso = 'total' WHERE lower(email) = 'fulano@apggov.com.br';

  4. Atenção (mesma ressalva da migration 20260709120000): o app autentica pelo Firebase e
     lê o Supabase com a anon key, então o banco não sabe quem está consultando. A restrição
     é aplicada no app (abas, rotas internas e carga de dados), não por RLS.
*/

BEGIN;

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_tipo_acesso_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_tipo_acesso_check
  CHECK (tipo_acesso IN ('admin', 'gestao', 'total'));

UPDATE user_profiles
   SET tipo_acesso = 'total'
 WHERE lower(trim(email)) IN (
         'teste@gmail.com',
         'bruna.luch@apggov.com.br',
         'frederico.melo@apggov.com.br',
         'andreia.gruntowski@apggov.com.br',
         'andre.dutra@apggov.com.br',
         'ana.bernardino@apggov.com.br'
       )
   AND tipo_acesso <> 'gestao';

COMMIT;
