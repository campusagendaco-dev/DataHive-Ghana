
-- Update agents who have no name
UPDATE profiles
SET full_name = 'Unnamed Agent ' || UPPER(SUBSTRING(user_id::text FROM 1 FOR 4))
WHERE (full_name IS NULL OR TRIM(full_name) = '') 
AND (is_agent = true OR sub_agent_approved = true);

-- Update regular users who have no name
UPDATE profiles
SET full_name = 'Unnamed User ' || UPPER(SUBSTRING(user_id::text FROM 1 FOR 4))
WHERE (full_name IS NULL OR TRIM(full_name) = '') 
AND is_agent = false 
AND sub_agent_approved = false;

-- If there are any API keys belonging to users without a name, label them explicitly
UPDATE profiles
SET full_name = 'API User ' || UPPER(SUBSTRING(user_id::text FROM 1 FOR 4))
WHERE user_id IN (SELECT user_id FROM api_keys)
AND full_name LIKE 'Unnamed%';
