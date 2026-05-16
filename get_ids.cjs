const fs = require('fs');

const content = fs.readFileSync('supabase/migrations/final_restoration_pure.sql', 'utf8');
const ids = [];
const regex = /UPDATE public\.wallets SET balance = balance \+ [\d.]+ WHERE agent_id = '([^']+)';/g;
let match;
while ((match = regex.exec(content)) !== null) {
    ids.push(match[1]);
}

const idStr = ids.map(id => `'${id}'`).join(',');
console.log(idStr);
