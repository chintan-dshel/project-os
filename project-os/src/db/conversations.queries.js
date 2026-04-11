import { query } from './pool.js';

export async function appendMessage({ project_id, agent, role, content, token_count }) {
  const { rows } = await query(
    `INSERT INTO conversation_history
       (project_id, agent, role, content, token_count)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [project_id, agent, role, content, token_count ?? null],
  );
  return rows[0];
}

export async function getHistory(projectId, agent, limit = 50) {
  const { rows } = await query(
    `SELECT id, agent, role, content, token_count, created_at
     FROM conversation_history
     WHERE project_id = $1
       AND ($2::agent_name IS NULL OR agent = $2)
     ORDER BY created_at ASC
     LIMIT $3`,
    [projectId, agent ?? null, limit],
  );
  return rows;
}

export async function getHistoryForContext(projectId, agent, limit = 20) {
  // Returns only role + content — ready to pass directly to an LLM messages array
  const rows = await getHistory(projectId, agent, limit);
  return rows.map(({ role, content }) => ({ role, content }));
}
