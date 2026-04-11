/**
 * lib/specialist.agent.js — v0.9
 *
 * Specialist agents recruited during execution to do actual work.
 * Each specialist has a focused role and produces concrete output
 * the founder can review, approve, reject, or copy directly.
 *
 * Types:
 *   coding    — writes implementation code for a task
 *   research  — gathers and synthesises information
 *   content   — writes copy, documentation, blog posts
 *   qa        — reviews code or content for issues
 *
 * Called by: POST /projects/:id/tasks/:taskKey/delegate
 * Stores output in: specialist_outputs table
 */

import { callClaude } from './anthropic.js';
import { query }      from '../db/pool.js';

// ── Workspace integration ─────────────────────────────────────────────────────
// Save agent output to the project workspace (fire-and-forget, non-critical)
async function saveToWorkspace(projectId, task, agentSlug, title, content) {
  try {
    await query(
      `INSERT INTO workspace_docs
         (project_id, type, title, content, task_key, task_title,
          created_by, agent_slug)
       VALUES ($1, 'agent_output', $2, $3, $4, $5, 'agent', $6)`,
      [projectId, title, content, task.task_key ?? null, task.title ?? null, agentSlug]
    )
  } catch (e) {
    console.warn('[workspace] saveToWorkspace failed:', e.message)
  }
}

// ── System prompts for each specialist ───────────────────────────────────────

function codingPrompt(task, project, brief) {
  return `You are a specialist Coding Agent working on "${project.title}".

## YOUR ROLE
You write clean, production-ready code. You don't over-engineer. You don't pad.
You write exactly what the task requires and nothing more.

## PROJECT CONTEXT
Project: ${project.title}
Type: ${project.project_type ?? 'software'}
Description: ${project.one_liner ?? 'not provided'}

## TASK
Task: ${task.title}
Description: ${task.description ?? 'not provided'}

## SPECIFIC BRIEF
${brief}

## OUTPUT RULES
1. Start with a 2-sentence summary of what you're implementing and why.
2. Write the complete, working code. No placeholders. No "TODO" comments unless absolutely unavoidable.
3. Add a brief "Usage" section showing how to use it.
4. If you make any assumptions, list them clearly at the end.
5. Format all code in proper markdown code blocks with language specified.

Be direct. A senior engineer should be able to copy this and use it immediately.`
}

function researchPrompt(task, project, brief) {
  return `You are a specialist Research Agent working on "${project.title}".

## YOUR ROLE
You gather, synthesise, and present information clearly. You cite where things come from.
You distinguish between established facts and your analysis.

## PROJECT CONTEXT
Project: ${project.title}
Problem being solved: ${project.core_problem ?? 'not provided'}
Target user: ${project.target_user ?? 'not provided'}

## TASK
Task: ${task.title}
Description: ${task.description ?? 'not provided'}

## SPECIFIC BRIEF
${brief}

## OUTPUT FORMAT
Structure your response as:
1. **Key Findings** — the 3-5 most important things the founder needs to know
2. **Detail** — expanded analysis with specifics
3. **Recommendations** — concrete next steps based on findings
4. **Caveats** — what you're uncertain about or what needs verification

Be specific. Vague generalisations are useless. If you don't know something, say so.`
}

function contentPrompt(task, project, brief) {
  return `You are a specialist Content Agent working on "${project.title}".

## YOUR ROLE
You write clear, purposeful content that serves the project's goals.
You match the tone of the project and the audience.

## PROJECT CONTEXT
Project: ${project.title}
Target user: ${project.target_user ?? 'not provided'}
Problem solved: ${project.core_problem ?? 'not provided'}

## TASK
Task: ${task.title}
Description: ${task.description ?? 'not provided'}

## SPECIFIC BRIEF
${brief}

## OUTPUT RULES
Write the complete, ready-to-use content. No "[insert X here]" placeholders.
If you need to make assumptions about tone or detail, note them at the start.
Format appropriately for the content type (headers for docs, paragraphs for copy, etc.)`
}

function qaPrompt(task, project, brief, contentToReview) {
  return `You are a specialist QA Agent working on "${project.title}".

## YOUR ROLE
You review output critically and honestly. You find real problems, not nitpicks.
You provide actionable feedback, not vague observations.

## PROJECT CONTEXT
Project: ${project.title}
Type: ${project.project_type ?? 'software'}

## TASK BEING REVIEWED
Task: ${task.title}
Original description: ${task.description ?? 'not provided'}

## WHAT TO REVIEW
${brief}

${contentToReview ? `## CONTENT TO REVIEW\n${contentToReview}` : ''}

## OUTPUT FORMAT
Structure as:
1. **Summary verdict** — pass / needs changes / fail, in one sentence
2. **Issues found** — numbered list, each with severity (critical/major/minor) and description
3. **What's good** — acknowledge what works
4. **Recommended fixes** — specific, actionable
5. **Open questions** — things you'd need to verify to give a complete review`
}

// ── Registry-based agent lookup ───────────────────────────────────────────────

async function getRegistryAgent(slug) {
  const { rows } = await query(
    'SELECT * FROM agent_registry WHERE slug = $1 AND is_active = TRUE LIMIT 1',
    [slug]
  )
  return rows[0] ?? null
}

function interpolatePrompt(template, vars) {
  return template
    .replace(/\{\{task_title\}\}/g,       vars.task_title       ?? '')
    .replace(/\{\{task_description\}\}/g, vars.task_description ?? '')
    .replace(/\{\{project_brief\}\}/g,    vars.project_brief    ?? '')
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function getTaskByKey(projectId, taskKey) {
  const { rows } = await query(
    `SELECT t.*, m.title AS milestone_title
     FROM tasks t JOIN milestones m ON m.id = t.milestone_id
     WHERE t.project_id = $1 AND t.task_key = $2 LIMIT 1`,
    [projectId, taskKey]
  )
  return rows[0] ?? null
}

async function createSpecialistRecord(projectId, taskId, taskKey, specialistType, brief, registrySlug = null) {
  // Map registry slugs to the enum values for the legacy column
  const VALID_LEGACY = ['coding', 'research', 'content', 'qa']
  const legacyType   = VALID_LEGACY.includes(specialistType) ? specialistType : 'coding'

  const { rows } = await query(
    `INSERT INTO specialist_outputs
       (project_id, task_id, task_key, specialist_type, brief, status, registry_agent_slug)
     VALUES ($1, $2, $3, $4::specialist_type, $5, 'pending'::specialist_status, $6)
     RETURNING id`,
    [projectId, taskId, taskKey, legacyType, brief, registrySlug ?? specialistType]
  )
  return rows[0].id
}

async function completeSpecialistRecord(outputId, output, format, language, inputTokens, outputTokens) {
  await query(
    `UPDATE specialist_outputs
     SET output = $2, output_format = $3, language = $4,
         status = 'complete'::specialist_status, completed_at = now(),
         input_tokens = $5, output_tokens = $6
     WHERE id = $1`,
    [outputId, output, format, language, inputTokens, outputTokens]
  )
}

async function failSpecialistRecord(outputId, errorMsg) {
  await query(
    `UPDATE specialist_outputs SET status = 'rejected'::specialist_status, review_notes = $2 WHERE id = $1`,
    [outputId, `Generation failed: ${errorMsg}`]
  )
}

// ── Detect output format from specialist type and brief ───────────────────────

function detectFormat(specialistType, output) {
  if (specialistType !== 'coding') return { format: 'markdown', language: null }
  // Try to detect the primary code language
  const codeBlock = output.match(/```(\w+)/)
  const lang = codeBlock ? codeBlock[1] : 'code'
  return { format: 'code', language: lang }
}

// ── Main entry point (legacy hardcoded types) ─────────────────────────────────

export async function runSpecialistAgent({ projectId, project, taskKey, specialistType, brief, contentToReview }) {
  const task = await getTaskByKey(projectId, taskKey)
  if (!task) throw new Error(`Task '${taskKey}' not found`)

  // Try registry first for any slug that is not a hardcoded legacy type
  const LEGACY_TYPES = ['coding', 'research', 'content', 'qa']
  if (!LEGACY_TYPES.includes(specialistType)) {
    return runRegistryAgent({ projectId, project, taskKey, registrySlug: specialistType, userPrompt: brief })
  }

  // Create the pending record
  const outputId = await createSpecialistRecord(projectId, task.id, taskKey, specialistType, brief, specialistType)

  // Build the appropriate system prompt
  let system
  switch (specialistType) {
    case 'coding':   system = codingPrompt(task, project, brief);                         break
    case 'research': system = researchPrompt(task, project, brief);                        break
    case 'content':  system = contentPrompt(task, project, brief);                         break
    case 'qa':       system = qaPrompt(task, project, brief, contentToReview);             break
    default: throw new Error(`Unknown specialist type: ${specialistType}`)
  }

  try {
    const { text, inputTokens, outputTokens } = await callClaude({
      system,
      messages: [{ role: 'user', content: brief }],
      max_tokens: 4096,
    })
    const { format, language } = detectFormat(specialistType, text)
    await completeSpecialistRecord(outputId, text, format, language, inputTokens, outputTokens)

    // Save to project workspace (fire-and-forget)
    const wsTitle = `[${specialistType}] ${task.title}`
    saveToWorkspace(projectId, task, specialistType, wsTitle, text).catch(() => {})

    return { outputId, output: text, format, language, status: 'complete' }
  } catch (err) {
    await failSpecialistRecord(outputId, err.message).catch(() => {})
    throw err
  }
}

// ── Registry-based entry point ────────────────────────────────────────────────

export async function runRegistryAgent({ projectId, project, taskKey, registrySlug, userPrompt }) {
  const task  = await getTaskByKey(projectId, taskKey)
  if (!task) throw new Error(`Task '${taskKey}' not found`)

  const agent = await getRegistryAgent(registrySlug)
  if (!agent) throw new Error(`Registry agent '${registrySlug}' not found or inactive`)

  // Interpolate template variables
  const projectBrief = [
    project.title, project.one_liner, project.core_problem,
  ].filter(Boolean).join('\n')

  const system = interpolatePrompt(agent.system_prompt_template, {
    task_title:       task.title,
    task_description: task.description ?? '',
    project_brief:    projectBrief,
  })

  const outputId = await createSpecialistRecord(
    projectId, task.id, taskKey, registrySlug, userPrompt, registrySlug
  )

  try {
    const { text, inputTokens, outputTokens } = await callClaude({
      system,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 4096,
    })

    const format   = agent.output_format === 'code' ? 'code' : 'markdown'
    const language = format === 'code' ? (text.match(/```(\w+)/) ?? [])[1] ?? 'code' : null

    await completeSpecialistRecord(outputId, text, format, language, inputTokens, outputTokens)

    // Save to project workspace (fire-and-forget)
    const wsTitle = `[${agent.name ?? registrySlug}] ${task.title}`
    saveToWorkspace(projectId, task, registrySlug, wsTitle, text).catch(() => {})

    return { outputId, output: text, format, language, status: 'complete' }
  } catch (err) {
    await failSpecialistRecord(outputId, err.message).catch(() => {})
    throw err
  }
}

// ── Review actions ────────────────────────────────────────────────────────────

export async function approveSpecialistOutput(projectId, outputId) {
  const { rows } = await query(
    `UPDATE specialist_outputs
     SET status = 'approved'::specialist_status, reviewed_at = now()
     WHERE id = $1 AND project_id = $2
     RETURNING *`,
    [outputId, projectId]
  )
  if (!rows[0]) throw new Error('Specialist output not found')

  // Add an approved note to the task
  if (rows[0].task_key) {
    await query(
      `UPDATE tasks SET notes = COALESCE(notes || E'\\n', '') || $3, updated_at = now()
       WHERE project_id = $1 AND task_key = $2`,
      [projectId, rows[0].task_key, `[Specialist output approved at ${new Date().toISOString().slice(0,16)}]`]
    ).catch(() => {})
  }

  return rows[0]
}

export async function rejectSpecialistOutput(projectId, outputId, feedback) {
  const { rows } = await query(
    `UPDATE specialist_outputs
     SET status = 'rejected'::specialist_status, review_notes = $3, reviewed_at = now()
     WHERE id = $1 AND project_id = $2
     RETURNING *`,
    [outputId, projectId, feedback ?? 'No feedback provided']
  )
  if (!rows[0]) throw new Error('Specialist output not found')
  return rows[0]
}

export async function getSpecialistOutputsForProject(projectId) {
  const { rows } = await query(
    `SELECT so.*, t.title AS task_title
     FROM specialist_outputs so
     LEFT JOIN tasks t ON t.task_key = so.task_key AND t.project_id = so.project_id
     WHERE so.project_id = $1
     ORDER BY so.triggered_at DESC`,
    [projectId]
  )
  return rows
}
