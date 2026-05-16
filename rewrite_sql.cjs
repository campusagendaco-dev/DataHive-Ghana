const fs = require('fs');

const content = fs.readFileSync('supabase/migrations/final_restoration_pure.sql', 'utf8');

const newContent = content.replace(/UPDATE public\.wallets SET balance = balance \+ ([\d.]+) WHERE agent_id = '([^']+)';/g, (match, amount, agent_id) => {
    return `INSERT INTO public.wallets (agent_id, balance) VALUES ('${agent_id}', ${amount}) ON CONFLICT (agent_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance;`;
});

fs.writeFileSync('supabase/migrations/final_restoration_pure_upsert.sql', newContent);
console.log('Done');
