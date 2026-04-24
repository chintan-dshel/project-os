// Layer 1 assertions for retro agent output (retro_complete)

const VALID_ADVANCE_STAGES = ['execution', 'complete']

export function assertRetro(retro) {
  const results = []

  function check(pass, name, detail = '') {
    results.push({ name, pass, detail })
  }

  check(!!retro, 'retro_extracted', 'extractJSON returned null — no JSON block found')
  if (!retro) return results

  check(typeof retro.what_worked === 'string' && retro.what_worked.length > 20, 'what_worked_has_substance')
  check(typeof retro.what_created_friction === 'string' && retro.what_created_friction.length > 20, 'friction_has_substance')
  check(typeof retro.what_would_you_change === 'string' && retro.what_would_you_change.length > 20, 'change_has_substance')

  check(Array.isArray(retro.patterns_detected), 'patterns_detected_is_array')

  const feed = retro.forward_feed ?? []
  check(Array.isArray(feed) && feed.length >= 1, 'has_forward_feed_items')
  check(feed.every(f => f.feed_type && f.content && f.content.length > 10), 'forward_feed_items_have_content')

  check(VALID_ADVANCE_STAGES.includes(retro.advance_stage), 'valid_advance_stage', `got: ${retro.advance_stage}`)

  // Milestone retro must have milestone_name
  if (retro.type === 'milestone_retro') {
    check(typeof retro.milestone_name === 'string' && retro.milestone_name.length > 0, 'milestone_name_present')
  }

  // Ship retro must have scorecard and founder_growth_read
  if (retro.type === 'ship_retro') {
    check(Array.isArray(retro.scorecard) && retro.scorecard.length > 0, 'scorecard_present_for_ship_retro')
    check(typeof retro.founder_growth_read === 'string' && retro.founder_growth_read.length > 20, 'founder_growth_read_present')
    check(Array.isArray(retro.v2_backlog), 'v2_backlog_is_array')
  }

  return results
}
