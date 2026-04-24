// Intake fixtures — confirmation turn guarantees JSON output

export const fixtures = [
  {
    name: 'vague_saas_idea',
    description: 'Minimal one-liner input, tests brief completeness on confirmation',
    project: {
      id: 'eval-intake-1',
      title: 'Untitled',
      stage: 'intake',
      hours_per_week: null,
      budget: null,
      one_liner: null,
      project_type: null,
      target_user: null,
      core_problem: null,
      confidence_score: null,
      success_criteria: [],
      scope_items: [],
      open_questions: [],
    },
    history: [
      {
        role: 'user',
        content: 'I want to build a SaaS for freelancers to track their clients and invoices',
      },
      {
        role: 'assistant',
        content: `Great — I can work with that. Here's my draft brief based on what you've described:

**Client Tracker** — A lightweight SaaS for freelancers to manage client relationships, project status, and invoices in one place.

**Assumptions I've made:**
- Target user: freelance designers or developers (not agencies)
- Core problem: losing track of client status across email, spreadsheets, and memory
- ~10 hrs/week available (logged as assumption)
- v1 is a solo-founder build, bootstrapped

**Success criteria (draft):**
1. 50 freelancers sign up within 30 days of launch
2. Users track at least 3 active clients within their first week
3. Invoice creation and send works end-to-end without manual workarounds

Assumptions logged as risks. Say "looks good" to lock this in, or tell me what to change.

**→ Next:** Say "looks good" to confirm the brief and start planning — or tell me what to change.`,
      },
    ],
    userMessage: 'looks good',
  },

  {
    name: 'detailed_app_idea',
    description: 'More specific input with user and problem already stated',
    project: {
      id: 'eval-intake-2',
      title: 'Untitled',
      stage: 'intake',
      hours_per_week: 15,
      budget: null,
      one_liner: null,
      project_type: null,
      target_user: null,
      core_problem: null,
      confidence_score: null,
      success_criteria: [],
      scope_items: [],
      open_questions: [],
    },
    history: [
      {
        role: 'user',
        content: `I'm building a habit tracking app for people who've tried and failed at habits before.
The idea is to make it extremely low-friction — just a single tap to log a habit, no streaks,
no guilt when you miss. Target users are adults 25-40 who are burnt out on gamified apps like Habitica.
I have 15 hours a week and want to ship in 8 weeks.`,
      },
      {
        role: 'assistant',
        content: `Good brief — you've given me a lot to work with. Here's my draft:

**No-Guilt Habit Tracker** — A low-friction mobile-first app for habit-burned adults who want simple logging without streaks or shame mechanics.

**Assumptions:**
- Mobile-first (not a web app) — logged as assumption
- "Single tap" means PWA or React Native, not native — logged as assumption
- Monetization deferred to v2 — logged as assumption

**Success criteria (draft):**
1. 100 users complete 7+ consecutive days of habit logging within 30 days of launch
2. Day-7 retention ≥ 40% (vs industry avg ~20% for habit apps)
3. Core logging flow completes in ≤2 taps from home screen

Logged 3 ASSUMPTION: risks. Say "looks good" to lock in.

**→ Next:** Say "looks good" to confirm or tell me what's off.`,
      },
    ],
    userMessage: 'yes proceed',
  },
]
