import { query } from '../db/pool.js';
import { notFound } from '../middleware/errors.js';

export async function assertProjectOwner(projectId, userId) {
  const { rows } = await query(
    `SELECT id FROM projects WHERE id = $1 AND user_id = $2`,
    [projectId, userId],
  );
  if (!rows[0]) throw notFound('Project not found');
}
