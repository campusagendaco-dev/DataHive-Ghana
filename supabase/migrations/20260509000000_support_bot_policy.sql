-- Support bot: allow a non-auth sender_id for bot messages.
-- The bot uses a fixed UUID (00000000-0000-0000-0000-000000000001) as sender_id,
-- which is not a real auth.users row. We need to drop the FK constraint on sender_id
-- so the service-role insert doesn't fail the foreign key check.

-- Drop FK on sender_id (we keep it as a plain UUID — validation is at app layer)
ALTER TABLE support_messages DROP CONSTRAINT IF EXISTS support_messages_sender_id_fkey;

-- Add is_bot column so the UI can identify bot messages without hardcoding a UUID
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT false;

-- Index for fast bot-message lookups
CREATE INDEX IF NOT EXISTS idx_support_messages_is_bot ON support_messages(is_bot) WHERE is_bot = true;
