// Retro fixtures — all 3 questions answered in history, final message triggers JSON

const PROJECT = {
  id: 'eval-retro-1',
  title: 'Client Tracker SaaS',
  stage: 'milestone_retro',
  core_problem: 'Freelancers lose track of client status across email, spreadsheets, and memory',
  success_criteria: [
    { criterion: '50 freelancers sign up within 30 days of launch' },
    { criterion: 'Users track at least 3 active clients within their first week' },
  ],
  scope_items: [
    { description: 'Payment processing', in_scope: false },
    { description: 'Team collaboration', in_scope: false },
  ],
}

const MILESTONE_STATE = {
  phases: [
    {
      title: 'Build',
      milestones: [
        {
          title: 'Auth + Scaffold',
          completed_at: null,
          tasks: [
            { task_key: 'task_1', title: 'Set up Express API', status: 'done', estimated_hours: 2, actual_hours: 2.5 },
            { task_key: 'task_2', title: 'Set up PostgreSQL schema', status: 'done', estimated_hours: 2, actual_hours: 2 },
            { task_key: 'task_3', title: 'Build login and register UI', status: 'done', estimated_hours: 3, actual_hours: 4.5 },
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
    name: 'milestone_retro_complete',
    description: 'All 3 retro answers in history — final message triggers retro JSON',
    type: 'milestone',
    milestoneName: 'Auth + Scaffold',
    project: PROJECT,
    state: MILESTONE_STATE,
    history: [
      {
        role: 'assistant',
        content: 'What did you actually deliver in "Auth + Scaffold"? Walk me through it — what\'s working and testable right now?',
      },
      {
        role: 'user',
        content: 'I have a working Express API with JWT auth — login, register, refresh token rotation all work. The Postgres schema is set up with migrations. The login UI is functional but the styling is rough.',
      },
      {
        role: 'assistant',
        content: 'Good. You ran 9h actual vs 7.5h estimated — about 20% over. What created the most friction on this milestone? Be specific — was it the task, the estimate, a dependency, or how you worked?',
      },
      {
        role: 'user',
        content: 'The refresh token rotation took way longer than I expected. I underestimated how fiddly JWT edge cases are — token expiry race conditions, silent refresh logic. That one sub-task alone ate 2 extra hours.',
      },
      {
        role: 'assistant',
        content: 'Noted — JWT complexity is a classic estimation trap for solo builders. One thing you\'d do differently on the next milestone?',
      },
    ],
    userMessage: "I'd break auth into two tasks — 'basic auth' and 'refresh token logic' separately. That way I'd see the complexity earlier and not get surprised.",
  },
]
