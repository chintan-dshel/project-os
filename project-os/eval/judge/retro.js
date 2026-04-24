// LLM-as-judge rubric for retro agent

export function buildJudgePrompt(fixture, retro) {
  return {
    system: `You are an expert evaluator of AI retrospective agents for solo founders.
You assess whether the retro output contains genuine insight or generic platitudes.
Be rigorous. A score of 5 means genuinely excellent. Respond ONLY with JSON matching the schema below.`,

    userMessage: `## PROJECT CONTEXT
Title: ${fixture.project.title}
Milestone: ${fixture.milestoneName ?? 'ship'}

## CONVERSATION THAT LED TO THIS RETRO
${fixture.history.map(m => `[${m.role}]: ${m.content}`).join('\n\n')}
[user]: ${fixture.userMessage}

## GENERATED RETRO OUTPUT
${JSON.stringify(retro, null, 2)}

## EVALUATION TASK
\`\`\`json
{
  "pattern_insight": {
    "score": null,
    "reason": "Are patterns_detected genuinely specific to this project/milestone? Or generic like 'underestimated complexity'?"
  },
  "friction_specificity": {
    "score": null,
    "reason": "Does what_created_friction reference actual details from the conversation? Or restate the question?"
  },
  "forward_feed_quality": {
    "score": null,
    "reason": "Are forward_feed items actionable and specific to this founder's situation? Or generic advice?"
  },
  "honest_accounting": {
    "score": null,
    "reason": "Does the retro acknowledge real gaps (hours over, tasks incomplete) or gloss over them?"
  },
  "overall": {
    "score": null,
    "summary": "One sentence on whether this retro would actually make the next milestone better."
  }
}
\`\`\``,
  }
}

export const dimensions = ['pattern_insight', 'friction_specificity', 'forward_feed_quality', 'honest_accounting', 'overall']
