export { query } from '../../src/db/pool.js';
import pool from '../../src/db/pool.js';

export async function cleanupUsers(emailLike) {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [emailLike]);
}

export async function cleanupProject(projectId) {
  await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
}
