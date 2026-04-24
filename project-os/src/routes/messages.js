import { Router } from 'express';
import {
  findProjectById, findProjectState,
  updateProjectStage, updateMomentumScore,
} from '../db/projects.queries.js';
import { appendMessage, getHistory, getHistoryForContext } from '../db/conversations.queries.js';
import { activeAgent }            from '../lib/agents.js';
import { runWithOrchestration }  from '../lib/orchestrator.js';
import { runGate } from '../middleware/gates.js';
import { query }   from '../db/pool.js';
import { badRequest, notFound } from '../middleware/errors.js';

const router = Router({ mergeParams: true });

router.post('/', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      throw badRequest('message is required and must be a non-empty string');
    }

    // 1. Load project
    const project = await findProjectById(id);
    if (!project) throw notFound('Project not found');

    // 2. Gate check
    await runGate(project);

    const agent = activeAgent(project.stage);

    // 3. Persist user message — keep the row ID so we can link the agent trace to this conversation turn
    const userMsg = await appendMessage({ project_id: id, agent, role: 'user', content: message.trim() });

    // 4. Fetch conversation history for LLM context
    const history = await getHistoryForContext(id, agent, 40);

    // 5. Fetch project state (needed by Execution and Retro agents)
    let state = null;
    if (agent === 'execution' || agent === 'retro') {
      state = await findProjectState(id);
    }

    const meta = {
      projectId:      id,
      userId:         req.user?.id ?? null,
      conversationId: userMsg?.id  ?? null,
      agent,
    };

    // 6. Run the active agent via orchestrator (model routing + fallback)
    let agentResponse;
    try {
      agentResponse = await runWithOrchestration({ project, state, history, userMessage: message.trim(), meta });
    } catch (agentErr) {
      console.error('[agent] Error:', agentErr.message);
      throw agentErr;
    }

    // 7. Persist assistant reply
    await appendMessage({
      project_id:  id,
      agent,
      role:        'assistant',
      content:     agentResponse.reply,
      token_count: agentResponse.outputTokens ?? null,
    });

    // 8. Stage advance guard
    if (agentResponse.advance_stage) {
      const fresh = await findProjectById(id);
      if (fresh && fresh.stage !== agentResponse.advance_stage) {
        await updateProjectStage(id, agentResponse.advance_stage);
      }
    }

    // 9. Momentum score update (execution agent)
    if (agentResponse.execution_update?.momentum_score != null) {
      await updateMomentumScore(id, agentResponse.execution_update.momentum_score);
    }

    // 10. Handle specialist suggestion from execution agent
    // Wrapped in try/catch — a specialist suggestion failure must never crash the message
    let specialistSuggestion = null;
    try {
      if (agentResponse.specialist_suggestion && project.stage === 'execution') {
        const sug = agentResponse.specialist_suggestion;
        const validTypes = ['coding', 'research', 'content', 'qa'];
        if (sug.task_key && validTypes.includes(sug.specialist_type) && sug.brief) {
          // Only store if migration 004 has been run (specialist_outputs table exists)
          await query(
            `INSERT INTO specialist_outputs
               (project_id, task_key, specialist_type, brief, status)
             SELECT $1, $2, $3::specialist_type, $4, 'pending'::specialist_status
             WHERE EXISTS (
               SELECT 1 FROM tasks WHERE project_id = $1 AND task_key = $2
             )`,
            [id, sug.task_key, sug.specialist_type, sug.brief]
          );
          specialistSuggestion = sug;
        }
      }
    } catch (e) {
      // Don't crash — specialist table may not exist yet (migration 004 not run)
      console.warn('[messages] specialist suggestion skipped:', e.message);
    }

    // 11. Full conversation for client
    const conversation = await getHistory(id, agent, 500);

    // 11. Re-read final project state
    const finalProject = await findProjectById(id);

    return res.json({
      project_id:       id,
      agent,
      stage:            finalProject?.stage ?? project.stage,
      reply:            agentResponse.reply,
      project_brief:    agentResponse.project_brief    ?? null,
      execution_plan:   agentResponse.execution_plan   ?? null,
      execution_update: agentResponse.execution_update ?? null,
      retrospective:    agentResponse.retrospective    ?? null,
      advance_stage:    agentResponse.advance_stage    ?? null,
      conversation,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
