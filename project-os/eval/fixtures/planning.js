// Planning fixtures — approval turn guarantees execution_plan JSON output

const CLIENT_TRACKER_PROJECT = {
  id: 'eval-planning-1',
  title: 'Client Tracker SaaS',
  stage: 'planning',
  hours_per_week: 10,
  budget: 'bootstrapped',
  one_liner: 'A lightweight SaaS for freelancers to manage clients, projects, and invoices',
  project_type: 'saas',
  target_user: 'Freelance designers and developers',
  core_problem: 'Freelancers lose track of client status across email, spreadsheets, and memory',
  confidence_score: 72,
  success_criteria: [
    { criterion: '50 freelancers sign up within 30 days of launch' },
    { criterion: 'Users track at least 3 active clients within their first week' },
    { criterion: 'Invoice creation and send works end-to-end without manual workarounds' },
  ],
  scope_items: [
    { description: 'Client management dashboard', in_scope: true },
    { description: 'Invoice creation and tracking', in_scope: true },
    { description: 'Project status board (kanban-lite)', in_scope: true },
    { description: 'Email reminders for overdue invoices', in_scope: true },
    { description: 'Payment processing integration', in_scope: false },
    { description: 'Team/agency collaboration features', in_scope: false },
    { description: 'Time tracking', in_scope: false },
  ],
  open_questions: [],
}

export const fixtures = [
  {
    name: 'saas_10h_week',
    description: 'Full brief approved — tests plan structure and hour constraints',
    project: CLIENT_TRACKER_PROJECT,
    history: [
      {
        role: 'user',
        content: 'Generate the plan',
      },
      {
        role: 'assistant',
        content: `Here's your plan: 3 phases, 7 milestones, 24 tasks over ~10 weeks. Estimated 98 total hours.

**Phase 1 — Build** (Core product)
- Milestone 1.1: Auth + project scaffold (12h)
- Milestone 1.2: Client management (18h)
- Milestone 1.3: Invoice flow (20h)

**Phase 2 — Polish** (UX + reliability)
- Milestone 2.1: Email reminders (10h)
- Milestone 2.2: Dashboard + status board (16h)

**Phase 3 — Launch** (Ship)
- Milestone 3.1: Deploy + onboarding (12h)
- Milestone 3.2: Launch marketing (10h)

Biggest risks: invoice PDF generation complexity; email deliverability; auth edge cases.

Ready to lock this in? Say 'approve' to begin execution, or tell me what to change.

**→ Next:** Say 'approve' or click the Approve button to start execution.`,
      },
    ],
    userMessage: 'approve',
  },

  {
    name: 'research_project_tight_hours',
    description: 'Research project with tight hours — tests scope warning trigger',
    project: {
      id: 'eval-planning-2',
      title: 'Competitive Analysis: AI PM Tools',
      stage: 'planning',
      hours_per_week: 5,
      budget: 'none',
      one_liner: 'Deep research report on AI-powered project management tools for solo founders',
      project_type: 'research',
      target_user: 'Solo founders evaluating AI PM tools',
      core_problem: 'No comprehensive comparison exists of AI PM tools from a solo founder lens',
      confidence_score: 85,
      success_criteria: [
        { criterion: 'Report covers 10+ tools with structured comparison across 8 dimensions' },
        { criterion: 'Published on personal blog with 500+ views in first week' },
        { criterion: 'At least 3 founders share or reference the report' },
      ],
      scope_items: [
        { description: 'Tool research and feature mapping', in_scope: true },
        { description: 'Hands-on testing of top 5 tools', in_scope: true },
        { description: 'Written report with comparison tables', in_scope: true },
        { description: 'Video walkthrough', in_scope: false },
        { description: 'Paid tool subscriptions', in_scope: false },
      ],
      open_questions: [],
    },
    history: [
      {
        role: 'user',
        content: 'Generate the plan',
      },
      {
        role: 'assistant',
        content: `Here's your research plan: 2 phases, 4 milestones, 14 tasks over ~6 weeks. Estimated 26 total hours.

**Phase 1 — Research** (Weeks 1-4)
- Milestone 1.1: Tool discovery and initial mapping (8h)
- Milestone 1.2: Hands-on testing of top 5 tools (10h)

**Phase 2 — Write + Publish** (Weeks 5-6)
- Milestone 2.1: Draft report with comparison tables (6h)
- Milestone 2.2: Edit, publish, and promote (2h)

At 5h/week, this fits comfortably in 6 weeks.

**→ Next:** Say 'approve' to lock this in.`,
      },
    ],
    userMessage: 'looks good, approve',
  },
]
