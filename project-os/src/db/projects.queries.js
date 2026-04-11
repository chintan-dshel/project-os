/**
 * projects.queries.js
 * Every SQL statement that touches the projects domain lives here.
 * Routes call these functions; they never write raw SQL themselves.
 */

import { query, transaction } from './pool.js';

// ─── READ ────────────────────────────────────────────────────────────────────

export async function findProjectById(id) {
  const { rows } = await query(
    `SELECT
       p.*,
       -- Aggregate intake arrays in one round-trip
       COALESCE(
         json_agg(DISTINCT jsonb_build_object(
           'id', sc.id, 'criterion', sc.criterion, 'sort_order', sc.sort_order
         )) FILTER (WHERE sc.id IS NOT NULL), '[]'
       ) AS success_criteria,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object(
           'id', si.id, 'description', si.description, 'in_scope', si.in_scope
         )) FILTER (WHERE si.id IS NOT NULL), '[]'
       ) AS scope_items,
       COALESCE(
         json_agg(DISTINCT jsonb_build_object(
           'id', oq.id, 'question', oq.question, 'resolved', oq.resolved
         )) FILTER (WHERE oq.id IS NOT NULL), '[]'
       ) AS open_questions
     FROM projects p
     LEFT JOIN success_criteria sc ON sc.project_id = p.id
     LEFT JOIN scope_items      si ON si.project_id = p.id
     LEFT JOIN open_questions   oq ON oq.project_id = p.id
     WHERE p.id = $1
     GROUP BY p.id`,
    [id],
  );
  return rows[0] ?? null;
}

export async function findProjectState(id) {
  // Run all 5 queries in parallel — each hits an indexed project_id column.
  // Tasks/milestones/phases are fetched as flat rows then assembled into a
  // tree in JS — avoids the correlated subquery N+1 that was causing 185ms+ times.
  const [phasesRes, milestonesRes, tasksRes, risks, decisions, blockers, assignmentsRes] = await Promise.all([
    query(
      `SELECT id, phase_key, title, goal, sort_order
       FROM phases WHERE project_id = $1 ORDER BY sort_order`,
      [id],
    ),
    query(
      `SELECT id, phase_id, milestone_key, title, success_condition,
              estimated_hours, completed_at, sort_order
       FROM milestones WHERE project_id = $1 ORDER BY sort_order`,
      [id],
    ),
    query(
      `SELECT id, milestone_id, task_key, title, description,
              estimated_hours, actual_hours, status, priority,
              notes, completed_at
       FROM tasks WHERE project_id = $1 ORDER BY created_at`,
      [id],
    ),
    query(
      `SELECT * FROM risk_register
       WHERE project_id = $1 ORDER BY risk_score DESC, created_at`,
      [id],
    ),
    query(
      `SELECT * FROM decision_log
       WHERE project_id = $1 ORDER BY decided_at`,
      [id],
    ),
    query(
      `SELECT b.*, t.task_key, t.title AS task_title
       FROM blockers b
       LEFT JOIN tasks t ON t.id = b.task_id
       WHERE b.project_id = $1 AND b.resolved = false
       ORDER BY b.created_at`,
      [id],
    ),
    query(
      `SELECT COUNT(*)::int AS n FROM agent_assignments
       WHERE project_id = $1 AND status = 'pending_review'`,
      [id],
    ).catch(() => ({ rows: [{ n: 0 }] })),
  ]);

  // Assemble tree in JS — O(n) with Maps, no extra DB round-trips
  const tasksByMilestone = new Map();
  for (const task of tasksRes.rows) {
    if (!tasksByMilestone.has(task.milestone_id)) {
      tasksByMilestone.set(task.milestone_id, []);
    }
    tasksByMilestone.get(task.milestone_id).push(task);
  }

  const milestonesByPhase = new Map();
  for (const ms of milestonesRes.rows) {
    if (!milestonesByPhase.has(ms.phase_id)) {
      milestonesByPhase.set(ms.phase_id, []);
    }
    milestonesByPhase.get(ms.phase_id).push({
      ...ms,
      tasks: tasksByMilestone.get(ms.id) ?? [],
    });
  }

  const phases = phasesRes.rows.map(ph => ({
    ...ph,
    milestones: milestonesByPhase.get(ph.id) ?? [],
  }));

  return {
    phases,
    risk_register:       risks.rows,
    decision_log:        decisions.rows,
    blockers:            blockers.rows,
    pending_assignments: assignmentsRes.rows[0]?.n ?? 0,
  };
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

export async function createProject({ title, one_liner, project_type, target_user, core_problem, hours_per_week, budget, confidence_score }) {
  const { rows } = await query(
    `INSERT INTO projects
       (title, one_liner, project_type, target_user, core_problem,
        hours_per_week, budget, confidence_score, stage, overall_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'intake','on_track')
     RETURNING *`,
    [title, one_liner, project_type, target_user, core_problem,
     hours_per_week, budget, confidence_score],
  );
  return rows[0];
}

export async function insertSuccessCriteria(client, projectId, criteria) {
  for (let i = 0; i < criteria.length; i++) {
    await client.query(
      `INSERT INTO success_criteria (project_id, criterion, sort_order)
       VALUES ($1, $2, $3)`,
      [projectId, criteria[i], i],
    );
  }
}

export async function insertScopeItems(client, projectId, inScope, outScope) {
  for (const desc of inScope ?? []) {
    await client.query(
      `INSERT INTO scope_items (project_id, description, in_scope) VALUES ($1,$2,true)`,
      [projectId, desc],
    );
  }
  for (const desc of outScope ?? []) {
    await client.query(
      `INSERT INTO scope_items (project_id, description, in_scope) VALUES ($1,$2,false)`,
      [projectId, desc],
    );
  }
}

export async function insertSkills(client, projectId, available, needed) {
  for (const skill of available ?? []) {
    await client.query(
      `INSERT INTO project_skills (project_id, skill, available) VALUES ($1,$2,true)`,
      [projectId, skill],
    );
  }
  for (const skill of needed ?? []) {
    await client.query(
      `INSERT INTO project_skills (project_id, skill, available) VALUES ($1,$2,false)`,
      [projectId, skill],
    );
  }
}

export async function insertOpenQuestions(client, projectId, questions) {
  for (const q of questions ?? []) {
    await client.query(
      `INSERT INTO open_questions (project_id, question) VALUES ($1,$2)`,
      [projectId, q],
    );
  }
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────

export async function updateProjectStage(id, stage, extraFields = {}) {
  const setClauses = ['stage = $2', 'updated_at = now()'];
  const values = [id, stage];
  let paramIdx = 3;

  for (const [key, val] of Object.entries(extraFields)) {
    setClauses.push(`${key} = $${paramIdx++}`);
    values.push(val);
  }

  const { rows } = await query(
    `UPDATE projects SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    values,
  );
  return rows[0] ?? null;
}

export async function approveProject(id) {
  const { rows } = await query(
    `UPDATE projects
     SET plan_approved = true, stage = 'execution', updated_at = now()
     WHERE id = $1 AND stage = 'awaiting_approval'
     RETURNING *`,
    [id],
  );
  return rows[0] ?? null;
}

// ─── EXECUTION STATE WRITES ──────────────────────────────────────────────────

export async function upsertTask(projectId, milestoneId, taskData) {
  const { task_key, title, description, estimated_hours, actual_hours, priority, status, notes, completed_at } = taskData;
  const { rows } = await query(
    `INSERT INTO tasks
       (project_id, milestone_id, task_key, title, description,
        estimated_hours, actual_hours, priority, status, notes, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (project_id, task_key)
     DO UPDATE SET
       status = EXCLUDED.status,
       actual_hours = COALESCE(EXCLUDED.actual_hours, tasks.actual_hours),
       notes = COALESCE(EXCLUDED.notes, tasks.notes),
       completed_at = EXCLUDED.completed_at,
       updated_at = now()
     RETURNING *`,
    [projectId, milestoneId, task_key, title, description,
     estimated_hours, actual_hours, priority ?? 'normal', status ?? 'todo', notes, completed_at],
  );
  return rows[0];
}

export async function insertRisk(projectId, risk) {
  const { description, likelihood, impact, risk_score, early_signals, mitigation, contingency, owner, status, source_agent } = risk;
  const { rows } = await query(
    `INSERT INTO risk_register
       (project_id, description, likelihood, impact, risk_score,
        early_signals, mitigation, contingency, owner, status, source_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [projectId, description, likelihood, impact, risk_score,
     early_signals, mitigation, contingency, owner ?? 'founder', status ?? 'open', source_agent],
  );
  return rows[0];
}

export async function insertDecision(projectId, decision) {
  const { decision: text, rationale, risk_evaluation, outcome, decided_at } = decision;
  const { rows } = await query(
    `INSERT INTO decision_log
       (project_id, decision, rationale, risk_evaluation, outcome, decided_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [projectId, text, rationale, risk_evaluation, outcome, decided_at ?? new Date()],
  );
  return rows[0];
}

export async function updateMomentumScore(id, score) {
  await query(
    `UPDATE projects SET momentum_score=$2, last_checkin_at=now(), updated_at=now() WHERE id=$1`,
    [id, score],
  );
}

// ─── RETRO ───────────────────────────────────────────────────────────────────

export async function findRetrosByProject(id) {
  const { rows: retros } = await query(
    `SELECT r.*,
       COALESCE(json_agg(DISTINCT jsonb_build_object(
         'id', rsc.id, 'criterion_text', rsc.criterion_text,
         'outcome', rsc.outcome, 'contributing_factors', rsc.contributing_factors,
         'what_would_change_it', rsc.what_would_change_it
       )) FILTER (WHERE rsc.id IS NOT NULL), '[]') AS scorecard,
       COALESCE(json_agg(DISTINCT jsonb_build_object(
         'id', rff.id, 'feed_type', rff.feed_type, 'content', rff.content
       )) FILTER (WHERE rff.id IS NOT NULL), '[]') AS forward_feed,
       COALESCE(json_agg(DISTINCT jsonb_build_object(
         'id', rrc.id, 'description', rrc.description, 'risk_score', rrc.risk_score
       )) FILTER (WHERE rrc.id IS NOT NULL), '[]') AS risk_cards
     FROM retrospectives r
     LEFT JOIN retro_scorecard    rsc ON rsc.retro_id = r.id
     LEFT JOIN retro_forward_feed rff ON rff.retro_id = r.id
     LEFT JOIN retro_risk_cards   rrc ON rrc.retro_id = r.id
     WHERE r.project_id = $1
     GROUP BY r.id
     ORDER BY r.triggered_at DESC`,
    [id],
  );

  const { rows: backlog } = await query(
    `SELECT * FROM v2_backlog WHERE project_id = $1 ORDER BY retro_id, id`,
    [id],
  );

  return { retros, backlog };
}
