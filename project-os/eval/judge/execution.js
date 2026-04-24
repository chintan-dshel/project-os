// LLM-as-judge rubric for execution agent

export function buildJudgePrompt(fixture, update, agentReply) {
  return {
    system: `You are an expert evaluator of AI execution coaching agents for solo founders.
You assess whether the agent properly challenged assumptions, identified risks, and maintained scope discipline.
Be rigorous. A score of 5 means genuinely excellent. Respond ONLY with JSON matching the schema below.`,

    userMessage: `## SCENARIO
Fixture: ${fixture.name}
Founder message: "${fixture.userMessage}"

## AGENT CONVERSATIONAL REPLY
${agentReply?.slice(0, 800) ?? '(none)'}

## EXTRACTED JSON UPDATE
${JSON.stringify(update, null, 2)}

## TASK STATE
${JSON.stringify((fixture.state?.phases ?? []).flatMap(p => p.milestones.flatMap(m => m.tasks)), null, 2)}

## EVALUATION TASK
\`\`\`json
{
  "status_probing": {
    "score": null,
    "reason": "Did the agent probe 'done' claims by asking for concrete output? Or accept them at face value?"
  },
  "risk_awareness": {
    "score": null,
    "reason": "Did the agent surface any risks implied by the founder's update? Even if no new_risks were created?"
  },
  "scope_discipline": {
    "score": null,
    "reason": "If scope creep was present, did the agent flag it and run a formal impact assessment?"
  },
  "momentum_calibration": {
    "score": null,
    "reason": "Is the momentum_score reasonable given the situation described? Not just a default 70?"
  },
  "overall": {
    "score": null,
    "summary": "One sentence on the most important thing the agent missed or handled poorly."
  }
}
\`\`\``,
  }
}

export const dimensions = ['status_probing', 'risk_awareness', 'scope_discipline', 'momentum_calibration', 'overall']
