-- Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Ensure net schema is accessible (pg_net creates it)
-- Usually pg_net creates its own schema 'net' or puts it in 'extensions'
-- The trigger was looking for 'net.http_post'

-- If the trigger is calling net.http_post, we should make sure it works.
-- Let's check the function definition first if possible, but we can also just fix the search path.
ALTER DATABASE postgres SET search_path TO "$user", public, extensions, net;
