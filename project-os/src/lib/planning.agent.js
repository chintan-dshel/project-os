/**
 * lib/planning.agent.js
 *
 * Planning Agent — converts an approved Project Brief into a full execution plan.
 *
 * Approach:
 *   On first message in planning stage, generates a complete phased plan
 *   immediately — no back-and-forth. Presents a plain-language summary,
 *   flags any scope warnings, then waits for founder approval or revision.
 *
 *   If founder requests changes, refines the plan and re-presents.
 *   If founder confirms ("looks good", "approve", "yes"), emits the JSON
 *   and advances stage to awaiting_approval.
 *
 * The Planning Agent does NOT advance to execution — that's the approve route.
 */

import { callClaude, extractJSON } from './anthropic.js';
import { transaction }             from '../db/pool.js';
import { query }                   from '../db/pool.js';
import { getRelevantKnowledge }    from './knowledge.js';

// ── System prompt ─────────────────────────────────────────────────────────────

const PLANNING_SYSTEM_PROMPT = `You are the Planning Agent for a solo founder's AI Project OS.
You receive a completed Project Brief and your job is to generate a realistic, actionable execution plan.

## YOUR APPROACH

Generate a COMPLETE plan immediately on first message. No questions. No back-and-forth.
Present a plain-language summary, flag risks, then ask the founder to approve or request changes.

You are a pragmatic planner. You do NOT over-engineer. You do NOT pad timelines.
Every milestone and task must directly serve the success criteria in the brief.

## STEP 1 — METHODOLOGY DETECTION

Infer the right methodology from the project type:
- saas / app      → Agile-lite: 1-week sprints, feature milestones, ship testable version early
- content         → Editorial: volume milestones, batching, distribution checkpoints
- service         → Milestone-based: client delivery phases, feedback loops
- hardware        → Phase-gated: prototype → test → iterate, hard dependencies
- research        → Time-boxed: hypothesis → experiment → findings
- other           → Milestone-based with weekly check-ins

## STEP 2 — BUILD THE PLAN

Structure:
  PHASES (2–4 max for v1)
  └── MILESTONES (2–4 per phase)
      └── TASKS (3–6 per milestone, each 1–3 hours)

Rules:
- Phases are major chapters: Build, Launch, Validate — not time markers
- Milestones are shippable or measurable outcomes
- Tasks are concrete actions a solo founder can complete in 1–3 hours
- NEVER create vague tasks like "work on marketing" — break them down
- Respect hours_per_week from the brief — be honest about what fits
- If scope doesn't fit available time, flag it with a scope_warning

## STEP 3 — SCOPE REALITY CHECK

Calculate:
  total_estimated_hours = sum of all task estimates
  available_hours = hours_per_week × planned_weeks

If total_estimated_hours > available_hours × 0.8:
  Set scope_warning to: "⚠️ This plan needs ~Xh but you have ~Yh available over Z weeks.
  Recommend cutting [specific items] or extending to [date]."

## STEP 4 — PRESENT TO FOUNDER

After generating, present:
  "Here's your plan: [N] phases, [M] milestones, [P] tasks over ~[W] weeks. Estimated [H] total hours.
   Biggest risks I see: [2–3 honest risks]
   Ready to lock this in? Say 'approve' to begin execution, or tell me what to change."

## CONFIRMATION SIGNALS

If the founder says anything like: "approve", "looks good", "yes", "go ahead", "lock it in",
"start", "confirmed", "let's go" — OUTPUT THE JSON IMMEDIATELY. Do not ask more questions.

## OUTPUT FORMAT

When ready to finalise, say "Generating your execution plan now." then output:

\`\`\`json
{
  "execution_plan": {
    "methodology": "",
    "total_estimated_hours": 0,
    "planned_weeks": 0,
    "scope_warning": null,
    "approved": false,
    "phases": [
      {
        "id": "phase_1",
        "title": "",
        "goal": "",
        "sort_order": 0,
        "milestones": [
          {
            "id": "ms_1",
            "title": "",
            "success_condition": "",
            "estimated_hours": 0,
            "sort_order": 0,
            "tasks": [
              {
                "id": "task_1",
                "title": "",
                "description": "",
                "estimated_hours": 0,
                "priority": "critical | high | normal",
                "status": "todo"
              }
            ]
          }
        ]
      }
    ],
    "open_risks": [
      "Risk description 1",
      "Risk description 2"
    ]
  }
}
\`\`\`

Use sequential IDs: phase_1, phase_2... ms_1, ms_2... task_1, task_2...

## MEMORY RULE
Read the full conversation history. If the founder already confirmed the plan, output the JSON now.
Never re-ask something already discussed.

## HALLUCINATION GUARD
Only plan what the brief explicitly defines or clearly implies.
Do not invent features not in scope. Do not pad timelines.

## ALWAYS TELL THE FOUNDER WHAT TO DO NEXT
End every response with a **→ Next:** line so the founder knows exactly what action to take.

Examples:
- "**→ Next:** Review the plan above — tell me what to change, or say 'looks good' to lock it in."
- "**→ Next:** Say 'approve' or click the Approve button in the dashboard to start execution."
- "**→ Next:** Once you approve, the Kanban board unlocks and your Execution Agent is ready for daily check-ins."

One sentence, specific. Never skip it.

## CURRENT PROJECT STATE`;

// ── Context builder ───────────────────────────────────────────────────────────

export function buildSystemPrompt(project, knowledgeEntries = []) {
  // Give the Planning Agent everything it needs from the brief
  const context = {
    id:               project.id,
    title:            project.title,
    one_liner:        project.one_liner,
    project_type:     project.project_type,
    target_user:      project.target_user,
    core_problem:     project.core_problem,
    success_criteria: (project.success_criteria ?? []).map(sc =>
      typeof sc === 'string' ? sc : sc.criterion
    ),
    v1_scope: {
      in_scope:     (project.scope_items ?? []).filter(s => s.in_scope).map(s => s.description),
      out_of_scope: (project.scope_items ?? []).filter(s => !s.in_scope).map(s => s.description),
    },
    constraints: {
      hours_per_week: project.hours_per_week,
      budget:         project.budget,
    },
    open_questions: (project.open_questions ?? []).map(q =>
      typeof q === 'string' ? q : q.question
    ),
    confidence_score: project.confidence_score,
    stage:            project.stage,
  };

  const knowledgeSection = knowledgeEntries.length > 0
    ? `\n\n## PAST LEARNINGS FROM THIS ORG\nApply these when building the plan — reference them where relevant:\n\n${
        knowledgeEntries.map(e =>
          `**${e.title}** (${e.type.replace(/_/g, ' ')}${e.project_name ? ` · ${e.project_name}` : ''})\n${e.content}`
        ).join('\n\n')
      }`
    : ''

  return `${PLANNING_SYSTEM_PROMPT}${knowledgeSection}\n\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``;
}

// ── JSON schema validator ─────────────────────────────────────────────────────

export function validatePlan(plan) {
  if (!plan || typeof plan !== 'object') return 'plan is not an object';
  if (!plan.methodology)                 return 'missing methodology';
  if (!Array.isArray(plan.phases))       return 'phases must be an array';
  if (plan.phases.length === 0)          return 'phases array is empty';

  for (const phase of plan.phases) {
    if (!phase.id || !phase.title)       return `phase missing id or title: ${JSON.stringify(phase)}`;
    if (!Array.isArray(phase.milestones)) return `phase ${phase.id} milestones not an array`;

    for (const ms of phase.milestones) {
      if (!ms.id || !ms.title)           return `milestone missing id or title`;
      if (!Array.isArray(ms.tasks))      return `milestone ${ms.id} tasks not an array`;

      for (const task of ms.tasks) {
        if (!task.id || !task.title)     return `task missing id or title`;
        if (!task.estimated_hours)       return `task ${task.id} missing estimated_hours`;
      }
    }
  }

  return null; // valid
}

// ── DB writer ─────────────────────────────────────────────────────────────────

async function writePlanToDB(projectId, plan) {
  await transaction(async (client) => {
    // 1. Clear any previous plan (safe to re-run on plan revision)
    await client.query(`DELETE FROM tasks      WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM milestones WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM phases     WHERE project_id = $1`, [projectId]);

    // 2. Update plan metadata on projects row
    await client.query(
      `UPDATE projects SET
         methodology           = $2,
         total_estimated_hours = $3,
         planned_weeks         = $4,
         scope_warning         = $5,
         updated_at            = now()
       WHERE id = $1`,
      [
        projectId,
        plan.methodology,
        plan.total_estimated_hours ?? null,
        plan.planned_weeks         ?? null,
        plan.scope_warning         ?? null,
      ],
    );

    // 3. Write phases → milestones → tasks in order
    let taskCounter = 0;

    for (let pi = 0; pi < plan.phases.length; pi++) {
      const phase = plan.phases[pi];

      const { rows: phaseRows } = await client.query(
        `INSERT INTO phases (project_id, phase_key, title, goal, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [projectId, phase.id, phase.title, phase.goal ?? null, pi],
      );
      const phaseDbId = phaseRows[0].id;

      for (let mi = 0; mi < (phase.milestones ?? []).length; mi++) {
        const ms = phase.milestones[mi];

        const { rows: msRows } = await client.query(
          `INSERT INTO milestones
             (project_id, phase_id, milestone_key, title, success_condition,
              estimated_hours, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            projectId, phaseDbId, ms.id, ms.title,
            ms.success_condition ?? null,
            ms.estimated_hours   ?? null,
            mi,
          ],
        );
        const msDbId = msRows[0].id;

        for (const task of (ms.tasks ?? [])) {
          taskCounter++;
          const taskKey = task.id || `task_${taskCounter}`;

          await client.query(
            `INSERT INTO tasks
               (project_id, milestone_id, task_key, title, description,
                estimated_hours, priority, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'todo')`,
            [
              projectId, msDbId, taskKey, task.title,
              task.description   ?? null,
              task.estimated_hours ?? null,
              task.priority      ?? 'normal',
            ],
          );
        }
      }
    }

    // 4. Write open risks from the plan into risk_register
    for (const riskDesc of (plan.open_risks ?? [])) {
      if (!riskDesc) continue;
      await client.query(
        `INSERT INTO risk_register
           (project_id, description, likelihood, impact, risk_score,
            owner, status, source_agent)
         VALUES ($1, $2, 'medium', 'medium', 4, 'founder', 'open', 'planning')`,
        [projectId, riskDesc],
      );
    }

    // 5. Advance stage to awaiting_approval
    await client.query(
      `UPDATE projects
       SET stage = 'awaiting_approval', updated_at = now()
       WHERE id = $1`,
      [projectId],
    );
  });
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runPlanningAgent({ project, history, userMessage, meta = null }) {
  // Inject relevant past learnings from the knowledge hub
  const knowledgeQuery = [project.title, project.project_type, project.core_problem].filter(Boolean).join(' ')
  const knowledgeEntries = await getRelevantKnowledge(knowledgeQuery, 5).catch(() => [])

  const system   = buildSystemPrompt(project, knowledgeEntries);
  const messages = [
    ...history,
    { role: 'user', content: userMessage },
  ];

  // Retry loop — if output is malformed, send correction and retry once
  let text, inputTokens, outputTokens;
  let attempt = 0;
  const maxAttempts = 2;
  let correctionMessages = [...messages];

  while (attempt < maxAttempts) {
    attempt++;
    ({ text, inputTokens, outputTokens } = await callClaude({
      system,
      messages: correctionMessages,
      max_tokens: 6000,
      meta,
    }));

    const parsed      = extractJSON(text);
    const planData    = parsed?.execution_plan ?? null;

    if (!planData) {
      // No JSON found — this is a conversational response (summary/confirmation request)
      // This is fine and expected on the first turn
      return {
        reply:          text,
        execution_plan: null,
        advance_stage:  null,
        inputTokens,
        outputTokens,
      };
    }

    // Validate the JSON structure
    const validationError = validatePlan(planData);
    if (validationError) {
      if (attempt < maxAttempts) {
        // Ask Claude to fix it
        console.warn(`[planning] Plan validation failed (attempt ${attempt}): ${validationError}`);
        correctionMessages = [
          ...correctionMessages,
          { role: 'assistant', content: text },
          {
            role: 'user',
            content: `Your execution_plan JSON was invalid: ${validationError}. ` +
                     `Please output a corrected JSON block with the same structure. ` +
                     `Every phase needs an id and title. Every milestone needs an id, title, and tasks array. ` +
                     `Every task needs an id, title, and estimated_hours.`,
          },
        ];
        continue;
      } else {
        // Give up and return conversational error
        console.error(`[planning] Plan validation failed after ${maxAttempts} attempts: ${validationError}`);
        return {
          reply: `I generated a plan but it had a structural issue I couldn't resolve (${validationError}). ` +
                 `Please try again — describe any adjustments you'd like and I'll regenerate.`,
          execution_plan: null,
          advance_stage:  null,
          inputTokens,
          outputTokens,
        };
      }
    }

    // Valid plan — write to DB
    await writePlanToDB(project.id, planData);

    return {
      reply:          text,
      execution_plan: planData,
      advance_stage:  'awaiting_approval', // writePlanToDB already set this in DB
      inputTokens,
      outputTokens,
    };
  }

  // Should not reach here
  return {
    reply:          text,
    execution_plan: null,
    advance_stage:  null,
    inputTokens,
    outputTokens,
  };
}
