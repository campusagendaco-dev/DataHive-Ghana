-- WebAuthn / Biometric credentials table
CREATE TABLE IF NOT EXISTS public.user_credentials (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT        NOT NULL UNIQUE,
  public_key    TEXT        NOT NULL,   -- base64url-encoded COSE key
  counter       BIGINT      NOT NULL DEFAULT 0,
  device_name   TEXT        NOT NULL DEFAULT 'My Device',
  device_type   TEXT,                   -- 'singleDevice' | 'multiDevice'
  backed_up     BOOLEAN     NOT NULL DEFAULT FALSE,
  transports    TEXT[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ
);

ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select" ON public.user_credentials
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "owner_delete" ON public.user_credentials
  FOR DELETE USING (auth.uid() = user_id);

-- Short-lived challenges (managed only by service role via Edge Function)
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge  TEXT        NOT NULL,
  action     TEXT        NOT NULL DEFAULT 'register',  -- 'register' | 'authenticate'
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
-- No user-level access; Edge Function uses service role key exclusively.
