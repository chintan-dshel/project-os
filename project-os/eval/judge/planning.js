// LLM-as-judge rubric for planning agent

export function buildJudgePrompt(fixture, plan) {
  const allTasks = (plan?.phases ?? [])
    .flatMap(p => (p.milestones ?? []).flatMap(m => m.tasks ?? []))

  return {
    system: `You are an expert evaluator of AI planning agents for solo founders.
You assess whether a generated execution plan is realistic, specific, and aligned with the project brief.
Be rigorous. A score of 5 means genuinely excellent. Respond ONLY with JSON matching the schema below.`,

    userMessage: `## PROJECT BRIEF
Title: ${fixture.project.title}
Type: ${fixture.project.project_type}
Hours/week: ${fixture.project.hours_per_week}
Success criteria: ${(fixture.project.success_criteria ?? []).map(c => typeof c === 'string' ? c : c.criterion).join('; ')}
In-scope: ${(fixture.project.scope_items ?? []).filter(s => s.in_scope).map(s => s.description).join(', ')}

## GENERATED PLAN SUMMARY
Methodology: ${plan?.methodology}
Total hours: ${plan?.total_estimated_hours}h over ${plan?.planned_weeks} weeks
Task count: ${allTasks.length}
Task hour range: ${Math.min(...allTasks.map(t => t.estimated_hours))}h – ${Math.max(...allTasks.map(t => t.estimated_hours))}h
Sample tasks: ${allTasks.slice(0, 5).map(t => `"${t.title}" (${t.estimated_hours}h)`).join(', ')}

## FULL PLAN JSON
${JSON.stringify(plan, null, 2)}

## EVALUATION TASK
\`\`\`json
{
  "task_specificity": {
    "score": null,
    "reason": "Are tasks concrete, solo-founder-executable actions? Or vague activities like 'work on marketing'?"
  },
  "hour_realism": {
    "score": null,
    "reason": "Are 1-3h estimates plausible for a solo founder? Any obvious over/underestimates?"
  },
  "plan_coherence": {
    "score": null,
    "reason": "Does the plan flow logically from the brief's success criteria? Every milestone traceable to a criterion?"
  },
  "scope_fit": {
    "score": null,
    "reason": "Does total_estimated_hours fit comfortably within hours_per_week × planned_weeks? Is scope_warning appropriate?"
  },
  "overall": {
    "score": null,
    "summary": "One sentence on the plan's biggest weakness."
  }
}
\`\`\``,
  }
}

export const dimensions = ['task_specificity', 'hour_realism', 'plan_coherence', 'scope_fit', 'overall']
