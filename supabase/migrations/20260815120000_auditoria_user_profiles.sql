/*
  # Auditoria de acesso — rastreio de último login e última interação por usuário

  A tela "Auditoria" (visível só para gestão + allowlist) precisa mostrar, por
  usuário, o último login e a última interação com o sistema. Hoje NADA é
  registrado, então esta migration cria o rastreio.

  ## Colunas adicionadas em user_profiles
    - last_login_at            timestamptz  -- último sign-in (do Firebase)
    - login_count              integer      -- nº de logins desde o início do rastreio
    - last_interaction_at      timestamptz  -- última interação registrada (heartbeat)
    - last_interaction_system  text         -- rótulo do sistema/tela da última interação

  ## Como é gravado (sem afrouxar a escrita da tabela)
  O app usa a chave anônima do Supabase e autentica no Firebase (auth.uid() é
  nulo), então a escrita passa por duas funções SECURITY DEFINER que só mexem
  nas colunas de AUDITORIA — nunca em campos de identidade (email/unidade/
  tipo_acesso). Assim, mesmo sendo executáveis pela role anon, o pior que um
  chamador mal-intencionado consegue é adulterar metadados de auditoria de um
  id que ele já conheça — não há vazamento nem escalonamento de privilégio.
  Casamos por id::text para funcionar tanto se `id` for uuid quanto text.

    - auditoria_registrar_login(p_id, p_last_sign_in)
        Atualiza last_login_at; incrementa login_count só quando o horário de
        sign-in muda (novo login real, não recarregamento de página).
    - auditoria_registrar_interacao(p_id, p_system)
        Marca last_interaction_at = now() e o sistema atual.

  ## Leitura
  A lista da Auditoria faz SELECT em user_profiles usando o MESMO acesso anon
  que o app já usa hoje em getUserProfile (a tabela já é legível pela role anon
  neste modelo Firebase + chave anônima). Por isso NÃO criamos nenhuma policy de
  SELECT nova aqui — não ampliamos a exposição existente. O controle de quem
  abre a tela é feito no cliente (podeAuditar), coerente com todo o restante do
  app, cuja autorização é client-side (ver 20260709120000). Uma trava real
  exigiria validar o token do Firebase no servidor — mudança transversal a todo
  o projeto, fora do escopo desta feature.

  Idempotente: reexecutar não duplica nada.
*/

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS login_count integer NOT NULL DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_interaction_system text;

-- As funções só escrevem colunas de auditoria (nunca email/unidade/tipo_acesso).
-- DROP antes de criar porque a lista de parâmetros mudou (versões antigas com
-- p_email não podem ser substituídas por CREATE OR REPLACE).
DROP FUNCTION IF EXISTS auditoria_registrar_login(text, text, timestamptz);
DROP FUNCTION IF EXISTS auditoria_registrar_login(text, timestamptz);
DROP FUNCTION IF EXISTS auditoria_registrar_interacao(text, text, text);
DROP FUNCTION IF EXISTS auditoria_registrar_interacao(text, text);

-- Registro de login: só conta um novo login quando o horário de sign-in muda.
CREATE FUNCTION auditoria_registrar_login(
  p_id text,
  p_last_sign_in timestamptz
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE user_profiles
  SET login_count = CASE
                      WHEN last_login_at IS DISTINCT FROM p_last_sign_in THEN login_count + 1
                      ELSE login_count
                    END,
      last_login_at = COALESCE(p_last_sign_in, last_login_at)
  WHERE id::text = p_id;
$$;

-- Registro de interação (heartbeat): marca horário e sistema atual.
CREATE FUNCTION auditoria_registrar_interacao(
  p_id text,
  p_system text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE user_profiles
  SET last_interaction_at     = now(),
      last_interaction_system = p_system
  WHERE id::text = p_id;
$$;

GRANT EXECUTE ON FUNCTION auditoria_registrar_login(text, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auditoria_registrar_interacao(text, text) TO anon, authenticated;

-- Leitura: NÃO criamos policy de SELECT nova. A Auditoria lê user_profiles pelo
-- mesmo acesso anon que getUserProfile já usa hoje. Isso evita ampliar a
-- exposição da tabela. (Ver comentário do topo sobre a trava real depender de
-- validação do token do Firebase no servidor.)

-- Conferência:
-- SELECT email, last_login_at, login_count, last_interaction_at, last_interaction_system FROM user_profiles ORDER BY last_login_at DESC NULLS LAST;
