/**
 * lib/intake.agent.js
 *
 * Intake Agent — "Draft first, ask one question" approach.
 *
 * Philosophy:
 *   A good PM doesn't interrogate — they propose and challenge.
 *   On the FIRST message, Claude generates a complete draft brief
 *   immediately from whatever the founder said, states its assumptions
 *   out loud, logs them as risks, then asks AT MOST ONE clarifying
 *   question about the single most critical unknown.
 *
 *   On follow-up messages, Claude refines the draft based on corrections
 *   and asks at most one more question if truly needed.
 *
 *   Once the founder says the draft looks right (or stops correcting),
 *   Claude finalises and emits the brief JSON.
 *
 * Result: founder gets a complete plan draft within 1–3 messages.
 * No interrogation. No form-filling. Assumptions are transparent and
 * trackable as risks rather than blockers.
 */

import { callClaude, extractJSON } from './anthropic.js';
import { transaction }             from '../db/pool.js';
import {
  insertScopeItems,
  insertSkills,
  insertOpenQuestions,
} from '../db/projects.queries.js';
import { query } from '../db/pool.js';

// ── System prompt ─────────────────────────────────────────────────────────────

const INTAKE_SYSTEM_PROMPT = `You are the Intake Agent for a solo founder's AI Project OS.
Your job is to transform a raw project idea into a structured Project Brief as fast as possible — ideally in 1 exchange, never more than 3.

## YOUR APPROACH: DRAFT FIRST, ASK ONCE

You are NOT an interviewer. You are a senior PM who reads fast, infers smartly, and proposes before asking.

### On the FIRST message from the founder:
1. Read what they wrote carefully
2. Immediately generate a COMPLETE draft brief — fill in every field using reasonable inference
3. Present the key assumptions you made in plain English (3–5 bullets max)
4. Log each assumption as a risk in the brief's risks array
5. Ask AT MOST ONE question — only about the single most critical thing you genuinely cannot infer

### On follow-up messages:
- The founder is correcting or confirming your draft
- Update the brief accordingly
- Ask at most one more question if something critical is still unknown
- If the founder says "looks good", "yes", "correct", "that's right", or stops correcting → finalise immediately, unconditionally — do not raise assumptions or missing details at this point

### NEVER ask about:
- Things you can reasonably infer from context
- Things the founder already mentioned (read the conversation history)
- Multiple things at once
- Nice-to-have details that can be assumptions/risks

### ASSUMPTION APPROACH:
Instead of asking "Who is your target user?", infer it and say:
"I'm assuming your target user is [X] — logged as an assumption. Correct me if wrong."

Instead of asking "What's your timeline?", infer it and say:
"I'm assuming ~10 hours/week available — logged as an assumption. Let me know your actual availability."

Unresolved unknowns go into open_questions and risks — they don't block the brief.

## CONFIDENCE THRESHOLD
Generate the brief when you have reasonable answers (even if assumed) for:
- What it is (1 sentence)
- Who it's for
- Core problem it solves
- Rough success signal

A brief with honest assumptions is FAR better than waiting for perfect answers.
Confidence score is purely informational — it reflects how much is assumed vs confirmed. ANY confidence score is fine to proceed. A score of 45 with 4 logged assumptions is a complete, honest brief. Never use confidence score as a reason to keep asking questions.

## ASSUMPTION AUDIT

Before generating success criteria, identify the 1–2 biggest unvalidated assumptions in the brief — claims about market need, user behaviour, or feasibility that the founder stated as fact but has not verified.

For each one:
- State it explicitly: "You've assumed [X] — this is unvalidated."
- Log it as a risk prefixed with "ASSUMPTION:" in the risks array

Examples of unvalidated assumptions to catch:
- "there's a real gap in the market" — market validation not done
- "people really struggle with X" — user research not cited
- "this will be easy to build" — technical feasibility not assessed
- A target user stated with no evidence they exist or want this

**Critical rule:** Unvalidated assumptions NEVER block the brief. Log them as risks and finalise. A brief with transparent assumptions is correct and complete. The confidence score reflects how much is assumed vs confirmed — it is informational, not a gate. A confidence score of 50 with 4 logged assumptions is a good brief, not an incomplete one.

## SMART OBJECTIVE SCORING

Before finalising, evaluate each success criterion against the SMART rubric.
Score each dimension 0–2:
- 2 = clearly met
- 1 = partially met / could be stronger
- 0 = absent

| Dimension  | What earns 2 |
|---|---|
| specific   | Unambiguous — two people read it identically |
| measurable | Number, threshold, or observable outcome stated |
| achievable | Feasibility consideration present |
| relevant   | Traceable connection to a stated user need |
| timebound  | Deadline or milestone attached |

**SMART gate:** Before finalising:
1. Produce a minimum of 3 success criteria — if the founder gave fewer, derive additional ones from the core problem and target user
2. Criteria must span at least two of these dimensions — if they don't, derive a missing one:
   - **User outcome** — does the user achieve something meaningful? (e.g. retention, behaviour change)
   - **Product behaviour** — does the product work as intended? (e.g. activation, engagement rate)
   - **Business/traction** — does the project gain real-world validation? (e.g. users, revenue, matches)
3. Every criterion must score ≥ 6/10 — revise weak ones autonomously, explain the change
4. Only finalise when all three conditions are met, or the founder explicitly accepts lower coverage after seeing the scores

## OUTPUT FORMAT

When ready to finalise (first message or after corrections), say:
"Here's your Project Brief — generating now."

Then output this JSON block:

\`\`\`json
{
  "project_brief": {
    "title": "",
    "one_liner": "",
    "project_type": "saas | app | content | service | hardware | research | other",
    "target_user": "",
    "core_problem": "",
    "success_criteria": [
      {
        "criterion": "measurable outcome 1",
        "specific": 2,
        "measurable": 2,
        "achievable": 1,
        "relevant": 2,
        "timebound": 2,
        "smart_score": 9,
        "gap": "Achievable: no baseline data — logged as assumption"
      }
    ],
    "v1_scope": {
      "in_scope": ["feature 1", "feature 2"],
      "out_of_scope": ["thing deferred to v2"]
    },
    "constraints": {
      "hours_per_week": null,
      "budget": "",
      "skills_available": [],
      "skills_needed": []
    },
    "risks": [
      "ASSUMPTION: [what was assumed] — correct if wrong",
      "ASSUMPTION: [what was assumed] — correct if wrong"
    ],
    "confidence_score": 65,
    "open_questions": ["Only things that truly need answering before planning"]
  }
}
\`\`\`

Prefix each assumption-based risk with "ASSUMPTION:" so the system can display it correctly.
Real risks (not assumptions) are written normally.

## SCOPE GUARD
If the founder describes more than 5 features for v1, park the extras automatically:
"I've put [X, Y, Z] in out_of_scope for now to keep v1 focused. You can pull them back in."
Don't ask — decide and explain.

## MEMORY RULE
Read the full conversation history before every response.
Never ask about something already answered or mentioned.
If the founder has confirmed the draft → finalise immediately, no more questions.

## ALWAYS TELL THE FOUNDER WHAT TO DO NEXT
End every response with a clear **→ Next:** line so the founder is never left wondering.

Examples:
- "**→ Next:** Tell me your target user and availability, or say 'looks good' if this draft is accurate."
- "**→ Next:** Say 'looks good' to confirm the brief and start planning — or tell me what to change."
- "**→ Next:** Your brief is locked in. The Planning Agent will generate your execution plan — chat with it now."

Keep it to one short sentence. Never skip it.

## CURRENT PROJECT STATE
The following is what the system already knows about this project:`;

// ── Context builder ───────────────────────────────────────────────────────────

export function buildSystemPrompt(project) {
  const projectContext = {
    id:               project.id,
    title:            project.title,
    one_liner:        project.one_liner,
    project_type:     project.project_type,
    target_user:      project.target_user,
    core_problem:     project.core_problem,
    confidence_score: project.confidence_score,
    hours_per_week:   project.hours_per_week,
    budget:           project.budget,
    success_criteria: project.success_criteria,
    scope_items:      project.scope_items,
    open_questions:   project.open_questions,
    stage:            project.stage,
  };

  return `${INTAKE_SYSTEM_PROMPT}\n\n\`\`\`json\n${JSON.stringify(projectContext, null, 2)}\n\`\`\``;
}

// ── DB writer ─────────────────────────────────────────────────────────────────

/**
 * Persist a completed project_brief into the database.
 * Atomic transaction — all child rows written together.
 * Idempotent — safe to call multiple times (deletes + re-inserts).
 */
async function writeBriefToDB(projectId, brief) {
  await transaction(async (client) => {
    const {
      title, one_liner, project_type, target_user, core_problem,
      success_criteria = [], v1_scope = {}, constraints = {},
      risks = [], confidence_score, open_questions = [],
    } = brief;

    // 1. Update scalar fields on the master project row
    await client.query(
      `UPDATE projects SET
         title            = COALESCE($2, title),
         one_liner        = COALESCE($3, one_liner),
         project_type     = COALESCE($4::project_type, project_type),
         target_user      = COALESCE($5, target_user),
         core_problem     = COALESCE($6, core_problem),
         hours_per_week   = COALESCE($7, hours_per_week),
         budget           = COALESCE($8, budget),
         confidence_score = COALESCE($9, confidence_score),
         updated_at       = now()
       WHERE id = $1`,
      [
        projectId, title, one_liner, project_type, target_user, core_problem,
        constraints.hours_per_week ?? null,
        constraints.budget ?? null,
        confidence_score ?? null,
      ],
    );

    // 2. Replace child arrays atomically
    await client.query(`DELETE FROM success_criteria WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM scope_items       WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM project_skills    WHERE project_id = $1`, [projectId]);
    await client.query(`DELETE FROM open_questions    WHERE project_id = $1`, [projectId]);
    await client.query(
      `DELETE FROM risk_register WHERE project_id = $1 AND source_agent = 'intake'`,
      [projectId],
    );

    // Insert criteria — handle both plain strings and SMART-scored objects
    for (let i = 0; i < success_criteria.length; i++) {
      const sc = success_criteria[i];
      if (typeof sc === 'string') {
        await client.query(
          `INSERT INTO success_criteria (project_id, criterion, sort_order)
           VALUES ($1, $2, $3)`,
          [projectId, sc, i],
        );
      } else {
        await client.query(
          `INSERT INTO success_criteria
             (project_id, criterion, sort_order,
              smart_specific, smart_measurable, smart_achievable,
              smart_relevant, smart_timebound)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            projectId,
            sc.criterion,
            i,
            sc.specific   ?? null,
            sc.measurable ?? null,
            sc.achievable ?? null,
            sc.relevant   ?? null,
            sc.timebound  ?? null,
          ],
        );
      }
    }
    await insertScopeItems(client, projectId, v1_scope.in_scope, v1_scope.out_of_scope);
    await insertSkills(client, projectId, constraints.skills_available, constraints.skills_needed);
    await insertOpenQuestions(client, projectId, open_questions);

    // 3. Write all risks — both real risks AND assumptions
    //    Assumptions are prefixed with "ASSUMPTION:" by the agent
    for (const r of risks) {
      const desc       = typeof r === 'string' ? r : (r.description ?? '');
      if (!desc) continue;
      const isAssumption = desc.startsWith('ASSUMPTION:');
      await client.query(
        `INSERT INTO risk_register
           (project_id, description, likelihood, impact, risk_score,
            owner, status, source_agent)
         VALUES ($1, $2, $3, $4, $5, 'founder', 'open', 'intake')`,
        [
          projectId,
          desc,
          isAssumption ? 'low'    : 'medium',
          isAssumption ? 'medium' : 'medium',
          isAssumption ? 2        : 4,
        ],
      );
    }

    // 4. Advance stage to planning
    await client.query(
      `UPDATE projects SET stage = 'planning', updated_at = now() WHERE id = $1`,
      [projectId],
    );
  });
}

// ── Main entry point ──────────────────────────────────────────────────────────

const CONFIRMATION_PHRASES = [
  'looks good', 'look good', 'sounds good', 'that looks good', 'that sounds good',
  'yes', 'correct', "that's right", 'thats right', 'proceed', 'finalize', 'finalise',
  'move on', 'go ahead', 'approved', 'good', 'perfect', 'great', 'ok', 'okay',
]

function isConfirmation(msg) {
  const lower = msg.toLowerCase().trim()
  return CONFIRMATION_PHRASES.some(p => lower === p || lower.startsWith(p + ' ') || lower.endsWith(' ' + p))
}

export async function runIntakeAgent({ project, history, userMessage, meta = null }) {
  const baseSystem = buildSystemPrompt(project);

  // If the founder is confirming, inject a hard finalisation instruction so the
  // agent cannot keep asking questions regardless of confidence score or assumptions.
  const confirming = history.length > 0 && isConfirmation(userMessage)
  const system = confirming
    ? `${baseSystem}\n\n## ⚠️ MANDATORY OVERRIDE\nThe founder has just confirmed the brief. You MUST output the project_brief JSON block RIGHT NOW. Do not ask any more questions. Do not mention confidence score. Do not raise assumptions. Just say "Here's your Project Brief — generating now." and output the JSON. This is a hard requirement.`
    : baseSystem

  const messages = [
    ...history,
    { role: 'user', content: userMessage },
  ];

  const { text, inputTokens, outputTokens } = await callClaude({ system, messages, meta });

  // Check for completed brief JSON
  const parsed       = extractJSON(text);
  const projectBrief = parsed?.project_brief ?? null;

  if (projectBrief && projectBrief.title && projectBrief.core_problem) {
    await writeBriefToDB(project.id, projectBrief);
    return {
      reply:         text,
      project_brief: projectBrief,
      advance_stage: 'planning',
      inputTokens,
      outputTokens,
    };
  }

  // Still refining — no brief emitted yet
  return {
    reply:         text,
    project_brief: null,
    advance_stage: null,
    inputTokens,
    outputTokens,
  };
}
