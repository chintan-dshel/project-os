/**
 * lib/api.js
 * All HTTP calls to the Express backend.
 * Components import from here — never fetch() directly.
 */

const BASE = '/projects'

async function handle(res) {
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(json.error ?? `HTTP ${res.status}`)
    err.status  = res.status
    err.code    = json.code    ?? null
    err.redirect = json.redirect ?? null
    err.context  = json.context  ?? null
    throw err
  }
  return json
}

export async function fetchProject(id) {
  return handle(await fetch(`${BASE}/${id}`))
}

export async function sendMessage(id, message) {
  return handle(await fetch(`${BASE}/${id}/message`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ message }),
  }))
}

export async function approveProject(id, confirmed, notes) {
  return handle(await fetch(`${BASE}/${id}/approve`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ confirmed, notes }),
  }))
}

export async function fetchRetro(id) {
  return handle(await fetch(`${BASE}/${id}/retro`))
}

export async function createProject(brief) {
  return handle(await fetch(BASE, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(brief),
  }))
}

export async function updateTask(projectId, taskKey, updates) {
  return handle(await fetch(`${BASE}/${projectId}/tasks/${taskKey}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(updates),
  }))
}

export async function addTaskComment(projectId, taskKey, comment) {
  return handle(await fetch(`${BASE}/${projectId}/tasks/${taskKey}/comments`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ comment }),
  }))
}

export async function listProjects() {
  return handle(await fetch(BASE))
}

export async function transitionStage(projectId, toStage) {
  return handle(await fetch(`${BASE}/${projectId}/transition`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ to_stage: toStage }),
  }))
}

export async function listDocuments(projectId) {
  return handle(await fetch(`${BASE}/${projectId}/documents`))
}

export async function fetchDocument(projectId, type) {
  return handle(await fetch(`${BASE}/${projectId}/documents/${type}`))
}

// ── RAID log ──────────────────────────────────────────────────────────────────

export async function updateRisk(projectId, riskId, updates) {
  return handle(await fetch(`${BASE}/${projectId}/raid/risks/${riskId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates),
  }))
}

export async function materialiseRisk(projectId, riskId, issueDescription) {
  return handle(await fetch(`${BASE}/${projectId}/raid/risks/${riskId}/materialise`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issue_description: issueDescription }),
  }))
}

export async function createDecisionFromIssue(projectId, riskId, payload) {
  return handle(await fetch(`${BASE}/${projectId}/raid/issues/${riskId}/decide`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }))
}

export async function createActionFromIssue(projectId, riskId, payload) {
  return handle(await fetch(`${BASE}/${projectId}/raid/issues/${riskId}/action`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }))
}

export async function createRisk(projectId, payload) {
  return handle(await fetch(`${BASE}/${projectId}/raid/risks`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }))
}

export async function createDecision(projectId, payload) {
  return handle(await fetch(`${BASE}/${projectId}/raid/decisions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }))
}

// ── Specialist Agents ─────────────────────────────────────────────────────────

export async function delegateTask(projectId, taskKey, specialistType, brief) {
  return handle(await fetch(`${BASE}/${projectId}/specialists/delegate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ task_key: taskKey, specialist_type: specialistType, brief }),
  }))
}

export async function approveOutput(projectId, outputId) {
  return handle(await fetch(`${BASE}/${projectId}/specialists/${outputId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }))
}

export async function rejectOutput(projectId, outputId, feedback) {
  return handle(await fetch(`${BASE}/${projectId}/specialists/${outputId}/reject`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ feedback }),
  }))
}

export async function reviseOutput(projectId, outputId, additionalBrief) {
  return handle(await fetch(`${BASE}/${projectId}/specialists/${outputId}/revise`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ additional_brief: additionalBrief }),
  }))
}

export async function listSpecialistOutputs(projectId) {
  return handle(await fetch(`${BASE}/${projectId}/specialists`))
}

// ── Agent Assignments ─────────────────────────────────────────────────────────

export async function analyzeAssignments(projectId) {
  return handle(await fetch(`${BASE}/${projectId}/assignments/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }))
}

export async function listAssignments(projectId, status) {
  const qs = status ? `?status=${status}` : ''
  return handle(await fetch(`${BASE}/${projectId}/assignments${qs}`))
}

export async function updateAssignment(projectId, assignmentId, updates) {
  return handle(await fetch(`${BASE}/${projectId}/assignments/${assignmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  }))
}

export async function runAssignment(projectId, assignmentId) {
  return handle(await fetch(`${BASE}/${projectId}/assignments/${assignmentId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }))
}

// ── Agent Registry ────────────────────────────────────────────────────────────

export async function listRegistry(activeOnly = false) {
  const qs = activeOnly ? '?active=true' : ''
  return handle(await fetch(`/registry${qs}`))
}

export async function updateRegistryAgent(agentId, updates) {
  return handle(await fetch(`/registry/${agentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  }))
}

export async function createRegistryAgent(payload) {
  return handle(await fetch('/registry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }))
}

// ── Projects — archive ────────────────────────────────────────────────────────

export async function archiveProject(id) {
  return handle(await fetch(`${BASE}/${id}/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }))
}

export async function unarchiveProject(id) {
  return handle(await fetch(`${BASE}/${id}/unarchive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }))
}

export async function deleteProject(id) {
  return handle(await fetch(`${BASE}/${id}`, { method: 'DELETE' }))
}

export async function listProjectsAll(includeArchived = false) {
  const qs = includeArchived ? '?archived=true' : ''
  return handle(await fetch(`${BASE}${qs}`))
}

// ── Generated Documents ───────────────────────────────────────────────────────

export async function generateDocument(projectId, type) {
  return handle(await fetch(`${BASE}/${projectId}/documents/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  }))
}

export async function listGeneratedDocuments(projectId) {
  return handle(await fetch(`${BASE}/${projectId}/documents/generated`))
}

export async function getV2Backlog(projectId) {
  return handle(await fetch(`${BASE}/${projectId}/retro/v2-backlog`))
}

// ── Workspace ─────────────────────────────────────────────────────────────────

export async function listWorkspaceDocs(projectId, params = {}) {
  const qs = Object.keys(params).length > 0 ? '?' + new URLSearchParams(params).toString() : ''
  return handle(await fetch(`${BASE}/${projectId}/workspace${qs}`))
}

export async function createWorkspaceDoc(projectId, payload) {
  return handle(await fetch(`${BASE}/${projectId}/workspace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }))
}

export async function updateWorkspaceDoc(projectId, docId, updates) {
  return handle(await fetch(`${BASE}/${projectId}/workspace/${docId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  }))
}

export async function deleteWorkspaceDoc(projectId, docId) {
  return handle(await fetch(`${BASE}/${projectId}/workspace/${docId}`, {
    method: 'DELETE',
  }))
}

export async function promoteToKnowledge(projectId, docId, knowledgeType) {
  return handle(await fetch(`${BASE}/${projectId}/workspace/${docId}/to-knowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(knowledgeType ? { type: knowledgeType } : {}),
  }))
}

// ── Knowledge Hub ─────────────────────────────────────────────────────────────

export async function listKnowledge(params = {}) {
  const qs = Object.keys(params).length > 0 ? '?' + new URLSearchParams(params).toString() : ''
  return handle(await fetch(`/knowledge${qs}`))
}

export async function createKnowledgeEntry(payload) {
  return handle(await fetch('/knowledge', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  }))
}
