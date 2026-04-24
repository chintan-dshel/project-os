// LLM-as-judge rubric for intake agent

export function buildJudgePrompt(fixture, brief) {
  return {
    system: `You are an expert evaluator of AI product management agents.
You are assessing the output of an Intake Agent that turns rough project ideas into structured briefs.
Be rigorous. A score of 5 means genuinely excellent — not just acceptable.
Respond ONLY with a JSON object matching the schema below. No prose.`,

    userMessage: `## ORIGINAL USER INPUT
"${fixture.userMessage}"

## PRIOR CONVERSATION (for context)
${fixture.history.map(m => `[${m.role}]: ${m.content.slice(0, 300)}`).join('\n\n')}

## GENERATED PROJECT BRIEF
${JSON.stringify(brief, null, 2)}

## EVALUATION TASK
Rate each dimension 1–5. Be honest. Penalise generic or vague outputs.

\`\`\`json
{
  "inference_quality": {
    "score": null,
    "reason": "Did the agent make specific, reasonable inferences from the input? Or did it produce generic placeholders?"
  },
  "assumption_transparency": {
    "score": null,
    "reason": "Are assumptions explicitly called out, logged as ASSUMPTION: risks, and clearly communicated?"
  },
  "success_criteria_quality": {
    "score": null,
    "reason": "Are criteria specific, measurable, and traceable to the stated problem? Or generic vanity metrics?"
  },
  "scope_discipline": {
    "score": null,
    "reason": "Is v1 scope appropriately constrained? Are obvious scope creeps parked in out_of_scope?"
  },
  "overall": {
    "score": null,
    "summary": "One sentence on what would make this brief notably better."
  }
}
\`\`\``,
  }
}

export const dimensions = ['inference_quality', 'assumption_transparency', 'success_criteria_quality', 'scope_discipline', 'overall']
