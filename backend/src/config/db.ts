import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// A pooled client can emit 'error' on an idle connection (e.g. the backend
// restarts, a network blip) — without this handler that throws and kills
// the process. Log and let the pool recycle the connection instead.
pool.on('error', (err) => {
  console.error('Unexpected error on idle PG client', err);
});

export async function pingDb(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    console.error('Database ping failed', err);
    return false;
  }
}
