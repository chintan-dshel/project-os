// Execution fixtures — tests check-in behavior, probing, and JSON update output

const BASE_PROJECT = {
  id: 'eval-exec-1',
  title: 'Client Tracker SaaS',
  stage: 'execution',
  overall_status: 'on_track',
  momentum_score: 65,
  methodology: 'agile-lite',
  total_estimated_hours: 98,
  planned_weeks: 10,
  hours_per_week: 10,
  last_checkin_at: null,
}

const BASE_STATE = {
  phases: [
    {
      title: 'Build',
      milestones: [
        {
          title: 'Auth + Scaffold',
          tasks: [
            { task_key: 'task_1', title: 'Set up Express API with auth middleware', status: 'done', priority: 'critical', estimated_hours: 2, actual_hours: 2.5 },
            { task_key: 'task_2', title: 'Set up PostgreSQL schema and migrations', status: 'done', priority: 'critical', estimated_hours: 2, actual_hours: 2 },
            { task_key: 'task_3', title: 'Build login and register UI', status: 'in_progress', priority: 'critical', estimated_hours: 3, actual_hours: null },
          ],
        },
        {
          title: 'Client Management',
          tasks: [
            { task_key: 'task_4', title: 'Build client list view with CRUD', status: 'todo', priority: 'high', estimated_hours: 3, actual_hours: null },
            { task_key: 'task_5', title: 'Build client detail page', status: 'todo', priority: 'high', estimated_hours: 2, actual_hours: null },
            { task_key: 'task_6', title: 'Add client status tags (active, paused, closed)', status: 'todo', priority: 'normal', estimated_hours: 1, actual_hours: null },
          ],
        },
      ],
    },
  ],
  risk_register: [],
  blockers: [],
}

export const fixtures = [
  {
    name: 'task_done_claim',
    description: 'Founder claims task_3 is done — agent should probe before accepting',
    project: BASE_PROJECT,
    state: BASE_STATE,
    history: [],
    userMessage: "I finished the login UI today. It's done.",
  },

  {
    name: 'scope_creep_attempt',
    description: 'Founder proposes adding a feature not in scope — agent should run scope guard',
    project: BASE_PROJECT,
    state: BASE_STATE,
    history: [
      {
        role: 'user',
        content: 'I worked on task_3 and got the login form working. Still needs some polish.',
      },
      {
        role: 'assistant',
        content: `Good progress — login form functional is a real step forward. "Still needs polish" tells me task_3 is in_progress, not done yet. What specifically is left — styling, validation, error states?

I've updated task_3 to in_progress.

**→ Next:** Describe what "done" looks like for task_3 so we can lock it in cleanly.

\`\`\`json
{"execution_update":{"momentum_score":62,"overall_status":"on_track","task_updates":[{"task_key":"task_3","status":"in_progress","notes":"Login form functional, polish remaining"}],"new_risks":[],"new_decisions":[],"new_blockers":[],"new_change_requests":[]}}\`\`\``,
      },
    ],
    userMessage: "Actually I also want to add a Stripe payment integration — it would make the app way more valuable. Can we add it to the plan?",
  },

  {
    name: 'blocker_reported',
    description: 'Founder reports being stuck — agent should create a blocker and identify risk',
    project: { ...BASE_PROJECT, overall_status: 'at_risk', momentum_score: 45 },
    state: {
      ...BASE_STATE,
      blockers: [],
      risk_register: [
        { description: 'Auth middleware complexity may delay milestone', likelihood: 'medium', impact: 'medium', risk_score: 4, status: 'open' },
      ],
    },
    history: [],
    userMessage: "I've been stuck on the login UI for 3 days. The JWT refresh token logic keeps breaking and I don't know why. I haven't made any progress.",
  },
]
