/**
 * lib/api.js
 * All HTTP calls to the Express backend.
 * Components import from here â€” never fetch() directly.
 */

const BASE = '/projects'

function getAuthHeader() {
  const token = localStorage.getItem('project-os:token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: { ...getAuthHeader(), ...(options.headers ?? {}) },
  })
}

async function handle(res) {
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(json.error ?? `HTTP ${res.status}`)
    err.status   = res.status
    err.code     = json.code     ?? null
    err.redirect = json.redirect ?? null
    err.context  = json.context  ?? null
    throw err
  }
  return json
}

export async function fetchProject(id) {
  return handle(await apiFetch(`${BASE}/${id}`))
}

export async function sendMessage(id, message) {
  return handle(await apiFetch(`${BASE}/${id}/message`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ message }),
  }))
}

export async function approveProject(id, confirmed, notes) {
  return handle(await apiFetch(`${BASE}/${id}/approve`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ confirmed, notes }),
  }))
}

export async function fetchRetro(id) {
  return handle(await apiFetch(`${BASE}/${id}/retro`))
}

export async function createProject(brief) {
  return handle(await apiFetch(BASE, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(brief),
  }))
}

export async function updateTask(projectId, taskKey, updates) {
  return handle(await apiFetch(`${BASE}/${projectId}/tasks/${taskKey}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(updates),
  }))
}

export async function addTaskComment(projectId, taskKey, comment) {
  return handle(await apiFetch(`${BASE}/${projectId}/tasks/${taskKey}/comments`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ comment }),
  }))
}

export async function listProjects() {
  return handle(await apiFetch(BASE))
}

export async function transitionStage(projectId, toStage) {
  return handle(await apiFetch(`${BASE}/${projectId}/transition`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ to_stage: toStage }),
  }))
}

export async function listDocuments(projectId) {
  return handle(await apiFetch(`${BASE}/${projectId}/documents`))
}

export async function fetchDocument(projectId, type) {
  return handle(await apiFetch(`${BASE}/${projectId}/documents/${type}`))
}

// â”€â”€ RAID log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function updateRisk(projectId, riskId, updates) {
  return handle(await apiFetch(`${BASE}/${projectId}/raid/risks/${riskId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates),
  }))
}

export async function materialiseRisk(projectId, riskId, issueDescription) {
  return handle(await apiFetch(`${BASE}/${projectId}/raid/risks/${riskId}/materialise`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issue_description: issueDescription }),
  }))
}

export async function createDecisionFromIssue(projectId, riskId, payload) {
  return handle(await apiFetch(`${BASE}/${projectId}/raid/issues/${riskId}/decide`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }))
}

export async function createActionFromIssue(projectId, riskId, payload) {
  return handle(await apiFetch(`${BASE}/${projectId}/raid/issues/${riskId}/action`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }))
}

export async function createRisk(projectId, payload) {
  return handle(await apiFetch(`${BASE}/${projectId}/raid/risks`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }))
}

export async function createDecision(projectId, payload) {
  return handle(await apiFetch(`${BASE}/${projectId}/raid/decisions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }))
}

// â”€â”€ Specialist Agents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function delegateTask(projectId, taskKey, specialistType, brief) {
  return handle(await apiFetch(`${BASE}/${projectId}/specialists/delegate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ task_key: taskKey, specialist_type: specialistType, brief }),
  }))
}

export async function approveOutput(projectId, outputId) {
  return handle(await apiFetch(`${BASE}/${projectId}/specialists/${outputId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }))
}

export async function rejectOutput(projectId, outputId, feedback) {
  return handle(await apiFetch(`${BASE}/${projectId}/specialists/${outputId}/reject`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ feedback }),
  }))
}

export async function reviseOutput(projectId, outputId, additionalBrief) {
  return handle(await apiFetch(`${BASE}/${projectId}/specialists/${outputId}/revise`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ additional_brief: additionalBrief }),
  }))
}

export async function listSpecialistOutputs(projectId) {
  return handle(await apiFetch(`${BASE}/${projectId}/specialists`))
}

// â”€â”€ Agent Assignments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function analyzeAssignments(projectId) {
  return handle(await apiFetch(`${BASE}/${projectId}/assignments/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }))
}

export async function listAssignments(projectId, status) {
  const qs = status ? `?status=${status}` : ''
  return handle(await apiFetch(`${BASE}/${projectId}/assignments${qs}`))
}

export async function updateAssignment(projectId, assignmentId, updates) {
  return handle(await apiFetch(`${BASE}/${projectId}/assignments/${assignmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  }))
}

export async function runAssignment(projectId, assignmentId) {
  return handle(await apiFetch(`${BASE}/${projectId}/assignments/${assignmentId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }))
}

// â”€â”€ Agent Registry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listRegistry(activeOnly = false) {
  const qs = activeOnly ? '?active=true' : ''
  return handle(await apiFetch(`/registry${qs}`))
}

export async function updateRegistryAgent(agentId, updates) {
  return handle(await apiFetch(`/registry/${agentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  }))
}

export async function createRegistryAgent(payload) {
  return handle(await apiFetch('/registry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }))
}

// â”€â”€ Projects â€” archive â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function archiveProject(id) {
  return handle(await apiFetch(`${BASE}/${id}/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }))
}

export async function unarchiveProject(id) {
  return handle(await apiFetch(`${BASE}/${id}/unarchive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }))
}

export async function deleteProject(id) {
  return handle(await apiFetch(`${BASE}/${id}`, { method: 'DELETE' }))
}

export async function listProjectsAll(includeArchived = false) {
  const qs = includeArchived ? '?archived=true' : ''
  return handle(await apiFetch(`${BASE}${qs}`))
}

// â”€â”€ Generated Documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function generateDocument(projectId, type) {
  return handle(await apiFetch(`${BASE}/${projectId}/documents/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type }),
  }))
}

export async function listGeneratedDocuments(projectId) {
  return handle(await apiFetch(`${BASE}/${projectId}/documents/generated`))
}

export async function getV2Backlog(projectId) {
  return handle(await apiFetch(`${BASE}/${projectId}/retro/v2-backlog`))
}

// â”€â”€ Workspace â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listWorkspaceDocs(projectId, params = {}) {
  const qs = Object.keys(params).length > 0 ? '?' + new URLSearchParams(params).toString() : ''
  return handle(await apiFetch(`${BASE}/${projectId}/workspace${qs}`))
}

export async function createWorkspaceDoc(projectId, payload) {
  return handle(await apiFetch(`${BASE}/${projectId}/workspace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }))
}

export async function updateWorkspaceDoc(projectId, docId, updates) {
  return handle(await apiFetch(`${BASE}/${projectId}/workspace/${docId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  }))
}

export async function deleteWorkspaceDoc(projectId, docId) {
  return handle(await apiFetch(`${BASE}/${projectId}/workspace/${docId}`, {
    method: 'DELETE',
  }))
}

export async function promoteToKnowledge(projectId, docId, knowledgeType) {
  return handle(await apiFetch(`${BASE}/${projectId}/workspace/${docId}/to-knowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(knowledgeType ? { type: knowledgeType } : {}),
  }))
}

// â”€â”€ Knowledge Hub â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listKnowledge(params = {}) {
  const qs = Object.keys(params).length > 0 ? '?' + new URLSearchParams(params).toString() : ''
  return handle(await apiFetch(`/knowledge${qs}`))
}

export async function createKnowledgeEntry(payload) {
  return handle(await apiFetch('/knowledge', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  }))
}

// ── Telemetry ─────────────────────────────────────────────────────────────────

function telemetryQs(params = {}) {
  const qs = new URLSearchParams()
  if (params.projectId)   qs.set('project_id',   params.projectId)
  if (params.from)        qs.set('from',          params.from)
  if (params.to)          qs.set('to',            params.to)
  if (params.granularity) qs.set('granularity',   params.granularity)
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export async function fetchTelemetrySummary(params = {}) {
  return handle(await apiFetch(`/telemetry/summary${telemetryQs(params)}`))
}

export async function fetchTelemetryByAgent(params = {}) {
  return handle(await apiFetch(`/telemetry/by-agent${telemetryQs(params)}`))
}

export async function fetchTelemetryTimeseries(params = {}) {
  return handle(await apiFetch(`/telemetry/timeseries${telemetryQs(params)}`))
}

export async function fetchTelemetryLatency(params = {}) {
  return handle(await apiFetch(`/telemetry/latency${telemetryQs(params)}`))
}

// ── Brief versioning ──────────────────────────────────────────────────────────

export async function fetchBrief(projectId) {
  return handle(await apiFetch(`${BASE}/${projectId}/brief`))
}

export async function saveBriefVersion(projectId, payload) {
  return handle(await apiFetch(`${BASE}/${projectId}/brief/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }))
}

export async function approveBriefVersion(projectId, versionId) {
  return handle(await apiFetch(`${BASE}/${projectId}/brief/versions/${versionId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }))
}

// ── Workroom ──────────────────────────────────────────────────────────────────

export async function fetchWorkroomLog(projectId, params = {}) {
  const qs = new URLSearchParams(params).toString()
  return handle(await apiFetch(`${BASE}/${projectId}/workroom/log${qs ? '?' + qs : ''}`))
}

export async function postLogEntry(projectId, payload) {
  return handle(await apiFetch(`${BASE}/${projectId}/workroom/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }))
}

export async function fetchChatThread(projectId, agent) {
  return handle(await apiFetch(`${BASE}/${projectId}/workroom/chat/${encodeURIComponent(agent)}`))
}

export async function postChatMessage(projectId, agent, message) {
  return handle(await apiFetch(`${BASE}/${projectId}/workroom/chat/${encodeURIComponent(agent)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  }))
}

// ── Agent Budgets ─────────────────────────────────────────────────────────────

export async function fetchBudgets(projectId) {
  return handle(await apiFetch(`${BASE}/${projectId}/budgets`))
}

export async function upsertBudget(projectId, slug, payload) {
  return handle(await apiFetch(`${BASE}/${projectId}/budgets/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }))
}

export async function pauseAgents(projectId, reason) {
  return handle(await apiFetch(`${BASE}/${projectId}/budgets/kill-switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  }))
}

export async function resumeAgents(projectId) {
  return handle(await apiFetch(`${BASE}/${projectId}/budgets/kill-switch`, {
    method: 'DELETE',
  }))
}

// ── Integrations ──────────────────────────────────────────────────────────────

export async function listIntegrations() {
  return handle(await apiFetch('/integrations'))
}

export async function updateIntegration(key, payload) {
  return handle(await apiFetch(`/integrations/${key}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }))
}

export async function disconnectIntegration(key) {
  return handle(await apiFetch(`/integrations/${key}`, { method: 'DELETE' }))
}

// ── A/B Testing ───────────────────────────────────────────────────────────────

export async function listVariants() {
  return handle(await apiFetch('/ab/variants'))
}

export async function createVariant(payload) {
  return handle(await apiFetch('/ab/variants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }))
}

export async function toggleVariant(id, active) {
  return handle(await apiFetch(`/ab/variants/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  }))
}

export async function fetchExperimentResults(experimentKey) {
  return handle(await apiFetch(`/ab/results?experiment_key=${encodeURIComponent(experimentKey)}`))
}
