/**
 * lib/execution.agent.js
 *
 * Execution Agent — the daily partner for a solo founder.
 *
 * Responsibilities:
 *   - Structured daily check-ins (conversational, never a form)
 *   - Task status inference from narrative (doesn't just accept "done")
 *   - Risk identification and RISK CARD creation
 *   - Scope guard on any proposed changes
 *   - Momentum scoring (0–100)
 *   - Inactivity detection and response
 *
 * Outputs JSON that the route handler writes to:
 *   - tasks (status updates)
 *   - risk_register (new risks)
 *   - decision_log (scope decisions)
 *   - projects (momentum_score, overall_status)
 */

import { callClaude, extractJSON } from './anthropic.js';
import { transaction }             from '../db/pool.js';
import { query }                   from '../db/pool.js';
import { getRelevantKnowledge }    from './knowledge.js';

// ── System prompt ─────────────────────────────────────────────────────────────

const EXECUTION_SYSTEM_PROMPT = `You are the Execution Agent for a solo founder's AI Project OS.
You are their daily check-in partner, accountability coach, and risk officer.

## YOUR ROLE
You keep the project moving, honest, and on track.
You surface problems early. You protect scope. You never suppress a real risk.

## CHECK-IN APPROACH
Be conversational, warm, and direct. You are NOT filling in a form.

When the founder messages you:
1. Ask what they worked on (if they haven't told you already)
2. Infer task status from their narrative — don't just accept "done". Ask: "What does done look like? Can you describe the output?"
3. Identify blockers they may not have named
4. Update tasks based on what you learn
5. Flag any risks you see
6. Confirm what they're working on next

## TASK STATUS INFERENCE
- "I finished X" → probe: "Walk me through what you built. Is it testable?"
- "I worked on X" → likely in_progress
- "I'm stuck on X" → blocked — create a blocker entry
- "X is done but needs polish" → in_progress, not done
- Only mark done when the founder can describe a concrete output

## RISK PROTOCOL
Flag risks when you see:
- A task taking longer than estimated
- Scope creep (adding things not in the plan)
- A dependency that could block progress
- The founder expressing doubt or fatigue
- A deadline being missed

Risk score = likelihood × impact (1–9):
- 7–9: HIGH — surface immediately, address before moving on
- 4–6: MEDIUM — flag and agree on mitigation
- 1–3: LOW — log and monitor

## SCOPE GUARD
If the founder proposes ANY change to the plan, run a formal impact assessment BEFORE presenting options:
1. **Validation check** — is this change on the project's success criteria? If not, flag it explicitly:
   "This feature is not on your success criteria — do you have evidence it's needed, or is this a nice-to-have?"
2. **Timeline impact** — hours/days added or saved
3. **Effort impact** — hours of work, component breakdown
4. **Risk impact** — what breaks or gets riskier

Then present:
"Adding [X] would cost ~[N] hours and push your ship date by [D]. You have three options:
A) Accept + extend the timeline by [D]
B) Accept + cut [specific existing item] to stay on schedule
C) Park it in the backlog for v2"

Log the outcome as a formal change_request — whether approved, rejected, or parked.
NEVER accept or reject a scope change without completing the impact assessment first.

## MOMENTUM SCORE
Calculate 0–100 based on:
- Tasks completed vs planned (40%)
- Recency of activity (30%)
- Open blockers (negative, -10 each)
- High risks open (negative, -5 each)
- Founder energy/attitude from message (10%)

## OUTPUT FORMAT

Always respond conversationally first, then output a JSON block with state updates.
If nothing changed, output an empty updates object.

\`\`\`json
{
  "execution_update": {
    "momentum_score": 72,
    "overall_status": "on_track",
    "task_updates": [
      {
        "task_key": "task_1",
        "status": "done",
        "actual_hours": 3.5,
        "notes": "Implemented JWT with refresh rotation"
      }
    ],
    "new_risks": [
      {
        "description": "Stripe Connect approval may take 5+ days",
        "likelihood": "high",
        "impact": "high",
        "risk_score": 9,
        "early_signals": "Application submitted 2 days ago, no response yet",
        "mitigation": "Build UI flow with test mode to avoid blocking",
        "contingency": "Switch to Stripe Checkout if Connect approval is denied",
        "owner": "external",
        "status": "open"
      }
    ],
    "new_decisions": [
      {
        "decision": "Deferred dark mode to v2",
        "rationale": "Scope guard triggered — adds 8h with no impact on core validation",
        "risk_evaluation": "Low risk — cosmetic feature, not on success criteria"
      }
    ],
    "new_blockers": [
      {
        "description": "Waiting for Stripe Connect approval before webhook testing",
        "task_key": "task_4"
      }
    ],
    "new_change_requests": [
      {
        "description": "Add dark mode to the dashboard",
        "change_type": "add_scope",
        "timeline_impact": "+8 hours, pushes ship date by ~1 week",
        "effort_impact": "8 hours",
        "risk_impact": "Low — cosmetic feature, no core dependency",
        "decision": "parked",
        "decision_rationale": "Founder chose option C — park for v2. Not on success criteria."
      }
    ]
  }
}
\`\`\`

overall_status options: on_track | at_risk | blocked
change_type options: add_scope | remove_scope | modify_scope | extend_timeline | cut_scope
decision options: approved | rejected | parked

## SPECIALIST SUGGESTION (optional)
If a task is clearly suited for a specialist agent to do the work, include this in your JSON.
Only suggest when it would genuinely save the founder significant time.

- coding: Implementation tasks — "build the auth middleware", "write the Stripe webhook handler"
- research: "research competitors", "find the best approach for X", "what are the tradeoffs of Y"
- content: "write the onboarding email", "create the API docs", "draft the landing page copy"
- qa: After a task is complete — "review the login flow", "check this code for issues"

Include it in the same JSON block as execution_update:

\`\`\`json
{
  "execution_update": { "momentum_score": 72, "task_updates": [], "new_risks": [], "new_decisions": [], "new_blockers": [], "new_change_requests": [] },
  "specialist_suggestion": {
    "task_key": "task_3",
    "specialist_type": "coding",
    "brief": "Write an Express middleware for JWT authentication with refresh token rotation.",
    "reason": "This is a well-defined implementation task I can produce a working draft for."
  }
}
\`\`\`

Only include specialist_suggestion when the task is clear and bounded.
Never suggest for vague or highly context-dependent tasks.
Never suggest more than once per conversation turn.

## IMPORTANT
- NEVER mark a task done unless the founder describes a concrete output
- NEVER suppress a risk score 7+ to keep momentum going
- NEVER accept scope changes without running the scope guard AND logging a change_request
- If no tasks changed, set task_updates to []
- If no new risks, set new_risks to []
- If no scope changes, set new_change_requests to []
- Always output the JSON block even if nothing changed (for momentum_score update)

## ALWAYS TELL THE FOUNDER WHAT TO DO NEXT
End every conversational response with a **→ Next:** line. Be specific — name the task.

Examples:
- "**→ Next:** Pick up task_3 (Stripe webhook handler) — it's on the critical path for this milestone."
- "**→ Next:** Unblock the API rate-limit issue before starting anything else — what's your plan for it?"
- "**→ Next:** You're on track. Check back in tomorrow with what you finish on the auth flow."

One sentence, specific, actionable. Never skip it.

## MEMORY RULE
Read the full conversation history. Refer to previous check-ins.
Notice patterns: tasks stuck for multiple sessions, same blockers recurring, scope creep.
Name patterns explicitly: "I notice this is the second session X has been blocked."

## CURRENT PROJECT STATE`;

// ── Context builder ───────────────────────────────────────────────────────────

export function buildSystemPrompt(project, state, knowledgeEntries = []) {
  // Give the execution agent full project state so it knows what's on the board
  const allTasks = (state?.phases ?? [])
    .flatMap(p => (p.milestones ?? []).flatMap(m =>
      (m.tasks ?? []).map(t => ({
        task_key: t.task_key,
        title:    t.title,
        status:   t.status,
        priority: t.priority,
        estimated_hours: t.estimated_hours,
        actual_hours:    t.actual_hours,
        milestone: m.title,
        phase:     p.title,
      }))
    ))

  const context = {
    id:             project.id,
    title:          project.title,
    stage:          project.stage,
    overall_status: project.overall_status,
    momentum_score: project.momentum_score,
    plan: {
      methodology:           project.methodology,
      total_estimated_hours: project.total_estimated_hours,
      planned_weeks:         project.planned_weeks,
    },
    tasks:         allTasks,
    open_risks:    (state?.risk_register ?? []).filter(r => r.status === 'open'),
    open_blockers: (state?.blockers ?? []).filter(b => !b.resolved),
    last_checkin:  project.last_checkin_at,
  }

  const knowledgeSection = knowledgeEntries.length > 0
    ? `\n\n## PAST LEARNINGS FROM THIS ORG\nReference these when coaching the founder or spotting patterns:\n\n${
        knowledgeEntries.map(e =>
          `**${e.title}** (${e.type.replace(/_/g, ' ')}${e.project_name ? ` · ${e.project_name}` : ''})\n${e.content}`
        ).join('\n\n')
      }`
    : ''

  return `${EXECUTION_SYSTEM_PROMPT}${knowledgeSection}\n\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``
}

// ── DB writer ─────────────────────────────────────────────────────────────────

async function writeExecutionUpdate(projectId, update) {
  if (!update) return

  const {
    momentum_score,
    overall_status,
    task_updates        = [],
    new_risks           = [],
    new_decisions       = [],
    new_blockers        = [],
    new_change_requests = [],
  } = update

  // Update project-level fields
  if (momentum_score != null || overall_status) {
    const sets = ['updated_at = now()', 'last_checkin_at = now()']
    const vals = [projectId]
    if (momentum_score  != null) { sets.push(`momentum_score = $${vals.length + 1}`)  ; vals.push(momentum_score)  }
    if (overall_status)           { sets.push(`overall_status = $${vals.length + 1}::project_status`) ; vals.push(overall_status) }
    await query(`UPDATE projects SET ${sets.join(', ')} WHERE id = $1`, vals)
  }

  // Task status updates — find task by task_key and update
  for (const tu of task_updates) {
    if (!tu.task_key) continue
    const setClauses = ['updated_at = now()']
    const vals       = [projectId, tu.task_key]
    if (tu.status)       { setClauses.push(`status = $${vals.length + 1}::task_status`) ; vals.push(tu.status) }
    if (tu.actual_hours != null) { setClauses.push(`actual_hours = $${vals.length + 1}`) ; vals.push(tu.actual_hours) }
    if (tu.notes)        { setClauses.push(`notes = $${vals.length + 1}`)   ; vals.push(tu.notes) }
    if (tu.status === 'done') { setClauses.push('completed_at = now()') }
    if (setClauses.length > 1) {
      await query(
        `UPDATE tasks SET ${setClauses.join(', ')} WHERE project_id = $1 AND task_key = $2`,
        vals,
      ).catch(e => console.warn(`[execution] task update failed for ${tu.task_key}:`, e.message))
    }
  }

  // New risks
  for (const r of new_risks) {
    if (!r.description) continue
    await query(
      `INSERT INTO risk_register
         (project_id, description, likelihood, impact, risk_score,
          early_signals, mitigation, contingency, owner, status, source_agent)
       VALUES (
         $1, $2,
         $3::risk_likelihood,
         $4::risk_impact,
         $5,
         $6, $7, $8,
         $9::risk_owner,
         $10::risk_status,
         'execution'::agent_name
       )`,
      [
        projectId,
        r.description,
        ['low','medium','high'].includes(r.likelihood) ? r.likelihood : 'medium',
        ['low','medium','high'].includes(r.impact)     ? r.impact     : 'medium',
        Math.min(Math.max(parseInt(r.risk_score) || 4, 1), 9),
        r.early_signals ?? null,
        r.mitigation    ?? null,
        r.contingency   ?? null,
        ['founder','agent','external'].includes(r.owner) ? r.owner : 'founder',
        ['open','mitigated','accepted','closed'].includes(r.status) ? r.status : 'open',
      ],
    ).catch(e => console.warn('[execution] risk insert failed:', e.message))
  }

  // New decisions
  for (const d of new_decisions) {
    if (!d.decision) continue
    await query(
      `INSERT INTO decision_log (project_id, decision, rationale, risk_evaluation, decided_at)
       VALUES ($1,$2,$3,$4, now())`,
      [projectId, d.decision, d.rationale ?? null, d.risk_evaluation ?? null],
    ).catch(e => console.warn('[execution] decision insert failed:', e.message))
  }

  // New blockers
  for (const b of new_blockers) {
    if (!b.description) continue
    // Find task id if task_key provided
    let taskId = null
    if (b.task_key) {
      const { rows } = await query(
        `SELECT id FROM tasks WHERE project_id = $1 AND task_key = $2 LIMIT 1`,
        [projectId, b.task_key],
      ).catch(() => ({ rows: [] }))
      taskId = rows[0]?.id ?? null
    }
    await query(
      `INSERT INTO blockers (project_id, task_id, description)
       VALUES ($1,$2,$3)`,
      [projectId, taskId, b.description],
    ).catch(e => console.warn('[execution] blocker insert failed:', e.message))
  }

  // New change requests — formal scope change log
  const validChangeTypes = ['add_scope','remove_scope','modify_scope','extend_timeline','cut_scope']
  const validDecisions   = ['approved','rejected','parked']
  for (const cr of new_change_requests) {
    if (!cr.description) continue
    await query(
      `INSERT INTO change_requests
         (project_id, description, change_type,
          timeline_impact, effort_impact, risk_impact,
          decision, decision_rationale, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        projectId,
        cr.description,
        validChangeTypes.includes(cr.change_type) ? cr.change_type : 'add_scope',
        cr.timeline_impact    ?? null,
        cr.effort_impact      ?? null,
        cr.risk_impact        ?? null,
        validDecisions.includes(cr.decision) ? cr.decision : null,
        cr.decision_rationale ?? null,
        cr.decision ? new Date() : null,
      ],
    ).catch(e => console.warn('[execution] change_request insert failed:', e.message))
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runExecutionAgent({ project, state, history, userMessage, meta = null }) {
  // Inject relevant past learnings — only on first message of a session to avoid prompt bloat
  const knowledgeEntries = history.length === 0
    ? await getRelevantKnowledge(`${project.title} ${project.project_type ?? ''}`, 4).catch(() => [])
    : []

  const system   = buildSystemPrompt(project, state, knowledgeEntries)
  const messages = [...history, { role: 'user', content: userMessage }]

  const { text, inputTokens, outputTokens } = await callClaude({
    system,
    messages,
    max_tokens: 4096,
    meta,
  })

  // Extract execution update JSON
  const parsed = extractJSON(text)
  const update = parsed?.execution_update ?? null

  // Write updates to DB (non-blocking — errors are logged, not thrown)
  if (update) {
    await writeExecutionUpdate(project.id, update).catch(e =>
      console.error('[execution] writeExecutionUpdate failed:', e.message)
    )

    // Fire-and-forget assignment analysis after tasks are updated
    import('../lib/assignment.analysis.js').then(({ triggerAssignmentAnalysis }) => {
      triggerAssignmentAnalysis(project.id).catch(e =>
        console.warn('[execution] assignment analysis failed:', e.message)
      )
    }).catch(() => {})
  }

  return {
    reply:               text,
    execution_update:    update,
    advance_stage:       null, // execution doesn't advance stage automatically
    inputTokens,
    outputTokens,
  }
}
