
-- Update agents who have no name
UPDATE profiles
SET full_name = 'Unnamed Agent ' || UPPER(SUBSTRING(user_id::text FROM 1 FOR 4))
WHERE (full_name IS NULL OR TRIM(full_name) = '') 
AND (is_agent = true OR sub_agent_approved = true);

-- Update regular users who have no name
UPDATE profiles
SET full_name = 'Unnamed User ' || UPPER(SUBSTRING(user_id::text FROM 1 FOR 4))
WHERE (full_name IS NULL OR TRIM(full_name) = '') 
AND (is_agent = false OR is_agent IS NULL)
AND (sub_agent_approved = false OR sub_agent_approved IS NULL);

-- If there are any API users without a name, label them explicitly
UPDATE profiles
SET full_name = 'API User ' || UPPER(SUBSTRING(user_id::text FROM 1 FOR 4))
WHERE api_key IS NOT NULL AND TRIM(api_key) != ''
AND full_name LIKE 'Unnamed%';
