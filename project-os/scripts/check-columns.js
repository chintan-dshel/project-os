import pg from 'pg';
import 'dotenv/config';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const tables = ['projects', 'risk_register', 'decision_log', 'success_criteria', 'blockers'];
for (const t of tables) {
  const r = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
    [t]
  );
  console.log(`${t}: ${r.rows.map(x => x.column_name).join(', ')}`);
}
await client.end();
