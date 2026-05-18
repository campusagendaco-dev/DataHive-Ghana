-- ================================================================
-- UPDATE TRIGGER FUNCTION FOR ATTACHMENT URL PASSING
-- Passes the attachment_url securely to the AI resolver
-- ================================================================

CREATE OR REPLACE FUNCTION public.on_support_ticket_inserted_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_service_role TEXT;
BEGIN
  -- Fetch secure service role key from vault
  SELECT decrypted_secret INTO v_service_role 
  FROM vault.decrypted_secrets 
  WHERE name = 'supabase_service_role' 
  LIMIT 1;

  -- Fire-and-forget HTTP POST to auto-ticket-resolver Deno Function
  IF v_service_role IS NOT NULL AND v_service_role != '' THEN
    PERFORM net.http_post(
      url     := 'https://lsocdjpflecduumopijn.supabase.co/functions/v1/auto-ticket-resolver',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role
      ),
      body    := jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'user_id', NEW.user_id,
          'subject', NEW.subject,
          'description', NEW.description,
          'status', NEW.status,
          'attachment_url', NEW.attachment_url
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$$;
