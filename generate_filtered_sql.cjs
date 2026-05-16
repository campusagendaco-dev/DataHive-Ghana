const fs = require('fs');

const content = fs.readFileSync('supabase/migrations/final_restoration_pure.sql', 'utf8');
const values = [];
const regex = /UPDATE public\.wallets SET balance = balance \+ ([\d.]+) WHERE agent_id = '([^']+)';/g;
let match;
while ((match = regex.exec(content)) !== null) {
    const amount = match[1];
    const agent_id = match[2];
    values.push(`('${agent_id}'::uuid, ${amount})`);
}

const sql = `BEGIN;
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT * FROM (VALUES
            ${values.join(',\n            ')}
        ) AS t(agent_id, balance)
    )
    LOOP
        IF EXISTS (SELECT 1 FROM public.profiles WHERE id = r.agent_id) THEN
            INSERT INTO public.wallets (agent_id, balance) VALUES (r.agent_id, r.balance)
            ON CONFLICT (agent_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance;
        END IF;
    END LOOP;
END;
$$;
COMMIT;
`;

fs.writeFileSync('supabase/migrations/final_restoration_pure_upsert_filtered.sql', sql);
console.log('Done writing filtered sql');
