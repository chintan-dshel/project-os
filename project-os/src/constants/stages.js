/**
 * Valid values for POST /projects/:id/transition — the stages a user can
 * explicitly request via the transition endpoint.
 *
 * Only three of the six project_stage enum values are valid here:
 *   - execution       user approves the plan and work begins (or resumes after retro)
 *   - milestone_retro user clicks "Run milestone retro" when all milestone tasks are done
 *   - ship_retro      user clicks "Ship retro" when all project tasks are done
 *
 * The other three (intake, planning, awaiting_approval) are agent-driven:
 * they are set via the advance_stage field in agent responses, not by user
 * action. Allowing them as transition targets would let users bypass the
 * agent flow and send a project backward or into a state it has not earned.
 */
export const TRANSITION_STAGES = ['execution', 'milestone_retro', 'ship_retro', 'complete']
