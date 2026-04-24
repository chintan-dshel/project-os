// Layer 1 assertions for planning agent output (execution_plan)

export function assertPlanning(plan, fixture) {
  const results = []

  function check(pass, name, detail = '') {
    results.push({ name, pass, detail })
  }

  check(!!plan, 'plan_extracted', 'extractJSON returned null — no JSON block found')
  if (!plan) return results

  check(typeof plan.methodology === 'string' && plan.methodology.length > 0, 'has_methodology')
  check(typeof plan.total_estimated_hours === 'number' && plan.total_estimated_hours > 0, 'has_total_hours')
  check(typeof plan.planned_weeks === 'number' && plan.planned_weeks > 0, 'has_planned_weeks')

  const phases = plan.phases ?? []
  check(Array.isArray(phases) && phases.length >= 2 && phases.length <= 4, 'phases_2_to_4', `got ${phases.length}`)

  let allTasksValid = true
  let allHoursValid = true
  let totalTaskCount = 0

  for (const phase of phases) {
    if (!phase.id || !phase.title) { allTasksValid = false; break }

    const milestones = phase.milestones ?? []
    if (milestones.length === 0) { allTasksValid = false; break }

    for (const ms of milestones) {
      if (!ms.id || !ms.title) { allTasksValid = false; break }

      const tasks = ms.tasks ?? []
      if (tasks.length < 3) { allTasksValid = false; break }

      for (const task of tasks) {
        totalTaskCount++
        if (!task.id || !task.title) { allTasksValid = false; break }
        const h = task.estimated_hours
        if (typeof h !== 'number' || h < 0.5 || h > 3) {
          allHoursValid = false
        }
      }
    }
  }

  check(allTasksValid, 'all_phases_milestones_tasks_have_ids')
  check(totalTaskCount >= 6, 'min_6_tasks_total', `got ${totalTaskCount}`)
  check(allHoursValid, 'task_hours_05_to_3h', 'One or more tasks have estimated_hours outside 0.5–3h')

  // Scope warning check: if hours_per_week defined and plan is too big, scope_warning should exist
  const hoursPerWeek = fixture.project.hours_per_week
  if (hoursPerWeek) {
    const available = hoursPerWeek * plan.planned_weeks
    if (plan.total_estimated_hours > available * 0.8) {
      check(!!plan.scope_warning, 'scope_warning_present_when_over_budget',
        `Plan needs ${plan.total_estimated_hours}h but only ~${available}h available — scope_warning expected`)
    }
  }

  return results
}
