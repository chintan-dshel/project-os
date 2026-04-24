// Layer 1 assertions for intake agent output (project_brief)

const VALID_PROJECT_TYPES = ['saas', 'app', 'content', 'service', 'hardware', 'research', 'other']

export function assertIntake(brief) {
  const results = []

  function check(pass, name, detail = '') {
    results.push({ name, pass, detail })
  }

  check(!!brief, 'brief_extracted', 'extractJSON returned null — no JSON block found')

  if (!brief) return results

  check(typeof brief.title === 'string' && brief.title.length > 0, 'has_title')
  check(typeof brief.one_liner === 'string' && brief.one_liner.length > 10, 'has_one_liner')
  check(VALID_PROJECT_TYPES.includes(brief.project_type), 'valid_project_type', `got: ${brief.project_type}`)
  check(typeof brief.target_user === 'string' && brief.target_user.length > 0, 'has_target_user')
  check(typeof brief.core_problem === 'string' && brief.core_problem.length > 10, 'has_core_problem')

  const criteria = brief.success_criteria ?? []
  check(Array.isArray(criteria) && criteria.length >= 3, 'min_3_success_criteria', `got ${criteria.length}`)

  const allCriteria = criteria.map(c => typeof c === 'string' ? c : c.criterion ?? '')
  check(allCriteria.every(c => c.length > 10), 'criteria_not_empty')

  const inScope = brief.v1_scope?.in_scope ?? []
  check(Array.isArray(inScope) && inScope.length > 0, 'has_in_scope_items')

  const score = brief.confidence_score
  check(typeof score === 'number' && score >= 0 && score <= 100, 'confidence_score_range', `got: ${score}`)

  const risks = brief.risks ?? []
  check(Array.isArray(risks) && risks.length > 0, 'has_risks')

  const hasAssumption = risks.some(r => {
    const text = typeof r === 'string' ? r : (r.description ?? '')
    return text.startsWith('ASSUMPTION:')
  })
  check(hasAssumption, 'has_assumption_prefixed_risk', 'No risk starts with ASSUMPTION:')

  return results
}
