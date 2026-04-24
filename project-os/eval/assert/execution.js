// Layer 1 assertions for execution agent output (execution_update)

const VALID_STATUSES  = ['on_track', 'at_risk', 'blocked']
const VALID_TASK_STATUSES = ['todo', 'in_progress', 'done', 'blocked']

export function assertExecution(update, fixture) {
  const results = []

  function check(pass, name, detail = '') {
    results.push({ name, pass, detail })
  }

  check(!!update, 'update_extracted', 'extractJSON returned null — no JSON block found')
  if (!update) return results

  const score = update.momentum_score
  check(typeof score === 'number' && score >= 0 && score <= 100, 'momentum_score_range', `got: ${score}`)

  check(VALID_STATUSES.includes(update.overall_status), 'valid_overall_status', `got: ${update.overall_status}`)

  check(Array.isArray(update.task_updates), 'task_updates_is_array')
  check(Array.isArray(update.new_risks), 'new_risks_is_array')
  check(Array.isArray(update.new_decisions), 'new_decisions_is_array')
  check(Array.isArray(update.new_blockers), 'new_blockers_is_array')
  check(Array.isArray(update.new_change_requests), 'new_change_requests_is_array')

  // Task update validity
  for (const tu of update.task_updates ?? []) {
    if (tu.status) {
      check(VALID_TASK_STATUSES.includes(tu.status), `task_${tu.task_key}_valid_status`, `got: ${tu.status}`)
    }
  }

  // Fixture-specific: scope creep fixture should produce a change request
  if (fixture.name === 'scope_creep_attempt') {
    check(
      update.new_change_requests.length > 0,
      'scope_creep_logged_as_change_request',
      'Founder proposed Stripe integration — expected a change_request entry',
    )
  }

  // Fixture-specific: blocker fixture should produce a blocker or risk
  if (fixture.name === 'blocker_reported') {
    const hasBlockerOrRisk = update.new_blockers.length > 0 || update.new_risks.length > 0
    check(hasBlockerOrRisk, 'blocker_or_risk_created_for_stuck_founder',
      'Founder reported being stuck for 3 days — expected new_blockers or new_risks')
  }

  return results
}
