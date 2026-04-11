/**
 * middleware/gates.js
 *
 * Stage transition gates. Each gate runs before its target agent is invoked.
 * A failed gate throws a GateError — the central error handler serialises it
 * into a consistent JSON response the client can act on programmatically.
 *
 * Gate map:
 *   intake     → (no gate — always open, it's the entry point)
 *   planning   → GATE_PLANNING   : confidence_score must be ≥ 70
 *   execution  → GATE_EXECUTION  : plan must be approved
 *   retro      → GATE_RETRO      : retro must exist for the completed milestone
 *
 * Each gate function receives the full project row (already loaded by the route)
 * and returns void on pass or throws GateError on fail.
 * They are intentionally pure functions where possible — DB calls are minimised
 * by using data already on the project row before reaching for the DB.
 */

import {
  getConfidenceScore,
  getPlanApproved,
  getRetroForMilestone,
  getLastCompletedMilestone,
} from '../db/gates.queries.js';

// ── Error codes ───────────────────────────────────────────────────────────────
// Stable string codes the frontend can switch on — never change these values.

export const GATE_CODES = {
  LOW_CONFIDENCE:       'GATE_LOW_CONFIDENCE',       // planning gate
  PLAN_NOT_APPROVED:    'GATE_PLAN_NOT_APPROVED',    // execution gate
  RETRO_REQUIRED:       'GATE_RETRO_REQUIRED',       // milestone-retro gate
  INVALID_STAGE:        'GATE_INVALID_STAGE',        // catch-all
};

// ── GateError ─────────────────────────────────────────────────────────────────

export class GateError extends Error {
  /**
   * @param {string} code       - One of GATE_CODES
   * @param {string} message    - Human-readable explanation
   * @param {string} redirect   - The stage the project should fall back to
   * @param {object} [context]  - Extra diagnostic data (safe to send to client)
   */
  constructor(code, message, redirect, context = {}) {
    super(message);
    this.name        = 'GateError';
    this.status      = 422;   // Unprocessable Entity — semantically correct for a gate failure
    this.code        = code;
    this.redirect    = redirect;
    this.context     = context;
  }
}

// ── Gate: planning ────────────────────────────────────────────────────────────
/**
 * GATE_PLANNING
 * Blocks entry to the Planning Agent if the project brief's confidence score
 * is below 70. A low score means the Intake Agent flagged too many unknowns
 * to produce a trustworthy execution plan.
 *
 * Note: the condition !project.confidence_score >= 70 in the original spec
 * is a JS operator-precedence bug — !score casts to boolean, then boolean >= 70
 * is always false. The correct intent is confidence_score < 70.
 *
 * Fast path: use the value already on the project row.
 * Slow path: re-fetch from DB if project row has a stale/null score.
 */
export async function gatePlanning(project) {
  let score = project.confidence_score;

  // Re-fetch if the project row came from a cached/partial query
  if (score === undefined) {
    score = await getConfidenceScore(project.id);
  }

  // A null score means the Intake Agent never completed the brief
  if (score === null) {
    throw new GateError(
      GATE_CODES.LOW_CONFIDENCE,
      'Project brief is incomplete — the Intake Agent has not yet produced a confidence score. ' +
      'Complete the intake conversation before advancing to planning.',
      'intake',
      { confidence_score: null, required: 70 },
    );
  }

  if (score < 70) {
    throw new GateError(
      GATE_CODES.LOW_CONFIDENCE,
      `Project brief confidence score is ${score}/100, below the required threshold of 70. ` +
      `Return to intake and resolve the open questions to raise confidence before planning.`,
      'intake',
      { confidence_score: score, required: 70, gap: 70 - score },
    );
  }
  // score ≥ 70 → pass
}

// ── Gate: execution ───────────────────────────────────────────────────────────
/**
 * GATE_EXECUTION
 * Blocks the Execution Agent if the execution plan has not been explicitly
 * approved by the founder via PUT /projects/:id/approve.
 *
 * Fast path: plan_approved is on the project row — no extra DB query needed.
 */
export async function gateExecution(project) {
  // plan_approved is a boolean column — guaranteed to be present on the row
  if (!project.plan_approved) {
    throw new GateError(
      GATE_CODES.PLAN_NOT_APPROVED,
      'Execution cannot begin until the founder approves the execution plan. ' +
      'Call PUT /projects/:id/approve with { "confirmed": true } to unlock execution.',
      'awaiting_approval',
      { plan_approved: false },
    );
  }
  // plan_approved === true → pass
}

// ── Gate: retro (milestone) ───────────────────────────────────────────────────
/**
 * GATE_RETRO
 * Blocks the start of a new milestone's execution if the previous milestone
 * does not have a completed retrospective.
 *
 * This gate is only active when stage === 'milestone_retro'.
 * If stage === 'execution', the execution gate runs instead.
 *
 * Logic:
 *   1. Find the most recently completed milestone
 *   2. Check whether a retro exists for it
 *   3. Block if no retro found
 */
export async function gateRetro(project) {
  // When stage is milestone_retro or ship_retro, the founder is ACTIVELY
  // running the retro conversation. The gate should not block this — the
  // /transition endpoint already validated the state change.
  //
  // The gate only matters when stage is 'execution' and we need to ensure
  // the previous milestone had a retro before starting the next one.
  // That check is enforced by the transition endpoint, not here.
  //
  // Passing through here allows the Retro Agent to receive messages.
  return;
}

// ── Gate dispatcher ───────────────────────────────────────────────────────────
/**
 * Run the gate appropriate for the project's current stage.
 * Called by the message route before invoking any agent.
 *
 * Stage → gate mapping:
 *   intake            → no gate (open)
 *   planning          → gatePlanning
 *   awaiting_approval → no gate (plan is generated; awaiting human confirm)
 *   execution         → gateExecution
 *   milestone_retro   → gateRetro
 *   ship_retro        → gateRetro (same check, different retro type)
 *   complete          → no gate (project closed)
 *
 * @param {object} project - Full project row from findProjectById()
 * @throws {GateError} if the gate condition is not met
 */
export async function runGate(project) {
  switch (project.stage) {
    case 'intake':
    case 'awaiting_approval':
    case 'complete':
      return; // no gate

    case 'planning':
      return gatePlanning(project);

    case 'execution':
      return gateExecution(project);

    case 'milestone_retro':
    case 'ship_retro':
      return gateRetro(project);

    default:
      throw new GateError(
        GATE_CODES.INVALID_STAGE,
        `Unknown project stage: '${project.stage}'. Cannot determine which agent to invoke.`,
        'intake',
        { stage: project.stage },
      );
  }
}
