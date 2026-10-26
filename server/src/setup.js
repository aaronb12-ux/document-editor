import fs from 'fs';
import { pool, query } from './db.js';

const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
await query(schema);

const users = [
  ['alice@test.com', 'Alice Johnson'],
  ['bob@test.com', 'Bob Smith'],
  ['carol@test.com', 'Carol Lee'],
];
for (const [email, name] of users) {
  await query(
    'INSERT INTO users (email, name) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING',
    [email, name]
  );
}
console.log('Schema applied and users seeded.');
await pool.end();