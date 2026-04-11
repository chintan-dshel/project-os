import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Reasonable defaults for a solo-project workload
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

/**
 * Run a single query. Pass a tagged-template or {text, values}.
 *   await query('SELECT * FROM projects WHERE id = $1', [id])
 */
export async function query(text, values) {
  const start = Date.now();
  const result = await pool.query(text, values);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[db] ${duration}ms → ${text.slice(0, 80).replace(/\s+/g, ' ')}`);
  }
  return result;
}

/**
 * Run multiple statements inside a single transaction.
 *   await transaction(async (client) => {
 *     await client.query(...)
 *     await client.query(...)
 *   })
 */
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;
