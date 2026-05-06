/**
 * seed-test-user.js
 * Creates a test user and a fully-seeded "execution" stage project so you
 * can QA every screen of the app without triggering any AI calls.
 *
 * Usage:
 *   node scripts/seed-test-user.js
 *
 * Credentials written to stdout. Safe to re-run — deletes previous seed data.
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const TEST_EMAIL    = 'test@projectos.dev';
const TEST_PASSWORD = 'TestUser123!';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// ── 1. Upsert test user ───────────────────────────────────────────────────────

const hash = await bcrypt.hash(TEST_PASSWORD, 10);

// The unique index is on LOWER(email), not a named constraint, so we use
// a manual check-then-insert/update pattern instead of ON CONFLICT.
const existing = await client.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [TEST_EMAIL]);
let user;
if (existing.rows[0]) {
  const { rows: [u] } = await client.query(
    `UPDATE users SET password_hash=$2 WHERE id=$1 RETURNING id, email`,
    [existing.rows[0].id, hash],
  );
  user = u;
} else {
  const { rows: [u] } = await client.query(
    `INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id, email`,
    [TEST_EMAIL, hash],
  );
  user = u;
}
console.log(`\nTest user: ${user.email} (id: ${user.id})`);

// ── 2. Delete any previous seed project for this user ─────────────────────────

await client.query(`DELETE FROM projects WHERE user_id = $1`, [user.id]);
console.log('Cleared previous seed data.');

// ── 3. Create the project ─────────────────────────────────────────────────────

const { rows: [proj] } = await client.query(
  `INSERT INTO projects
     (title, one_liner, project_type, target_user, core_problem,
      stage, overall_status, plan_approved,
      methodology, hours_per_week, budget,
      total_estimated_hours, planned_weeks,
      momentum_score, confidence_score,
      user_id)
   VALUES
     ($1,$2,$3,$4,$5,
      'execution','on_track',true,
      $6,$7,$8,
      $9,$10,
      $11,$12,
      $13)
   RETURNING id`,
  [
    'NoteFlow AI',
    'AI-powered note-taking that summarises your thoughts so you can think faster.',
    'saas',
    'Knowledge workers, students, and founders who write a lot',
    'Information overload: people take notes but never have time to review or connect them.',
    'Agile-lite (2-week sprints, ship early, iterate)',
    10,
    'Bootstrap, $500 max',
    118, 12,
    72, 68,
    user.id,
  ],
);
const projectId = proj.id;
console.log(`Project created: ${projectId}`);

// ── 4. Success criteria ───────────────────────────────────────────────────────

const criteria = [
  '500 monthly active users within 3 months of launch',
  'AI summarisation latency under 2 seconds for notes up to 1000 words',
  'Average user rating ≥ 4.5 stars in the first 100 reviews',
];
for (let i = 0; i < criteria.length; i++) {
  await client.query(
    `INSERT INTO success_criteria (project_id, criterion, sort_order) VALUES ($1,$2,$3)`,
    [projectId, criteria[i], i],
  );
}

// ── 5. Scope items ────────────────────────────────────────────────────────────

const inScope  = ['Web app (desktop first)', 'AI summarisation', 'User accounts + auth', 'Note tagging and search', 'Note sharing via link'];
const outScope = ['Mobile app (v2)', 'Offline mode', 'Public API', 'Team collaboration features'];
for (const d of inScope)  await client.query(`INSERT INTO scope_items (project_id, description, in_scope) VALUES ($1,$2,true)`,  [projectId, d]);
for (const d of outScope) await client.query(`INSERT INTO scope_items (project_id, description, in_scope) VALUES ($1,$2,false)`, [projectId, d]);

// ── 6. Open questions ─────────────────────────────────────────────────────────

await client.query(
  `INSERT INTO open_questions (project_id, question, resolved, resolved_at) VALUES ($1,$2,true,now())`,
  [projectId, 'Which AI model gives the best summarisation quality vs cost?'],
);
await client.query(
  `INSERT INTO open_questions (project_id, question) VALUES ($1,$2)`,
  [projectId, 'Should we offer a free tier, or go straight to paid?'],
);

// ── 7. Phases → Milestones → Tasks ───────────────────────────────────────────

async function insertPhase(key, title, goal, sortOrder) {
  const { rows: [r] } = await client.query(
    `INSERT INTO phases (project_id, phase_key, title, goal, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [projectId, key, title, goal, sortOrder],
  );
  return r.id;
}

async function insertMilestone(phaseId, key, title, condition, hours, sortOrder, completedAt = null) {
  const { rows: [r] } = await client.query(
    `INSERT INTO milestones (project_id, phase_id, milestone_key, title, success_condition, estimated_hours, sort_order, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [projectId, phaseId, key, title, condition, hours, sortOrder, completedAt],
  );
  return r.id;
}

async function insertTask(milestoneId, key, title, desc, estH, actualH, priority, status, notes = null, completedAt = null) {
  await client.query(
    `INSERT INTO tasks
       (project_id, milestone_id, task_key, title, description,
        estimated_hours, actual_hours, priority, status, notes, completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [projectId, milestoneId, key, title, desc, estH, actualH, priority, status, notes, completedAt],
  );
}

// Phase 1 — Foundation
const ph1 = await insertPhase('ph-1', 'Foundation', 'Ship auth, data model, and a working note editor.', 0);

const ms1 = await insertMilestone(ph1, 'ms-1', 'Auth & Infrastructure Live',
  'A new user can sign up, log in, and reach their empty dashboard.',
  18, 0, new Date('2026-03-15'));

await insertTask(ms1, 't-1-1', 'Set up Next.js 14 + Supabase project',
  'Scaffold repo, configure Supabase auth and DB, set up env vars.',
  3, 3.5, 'high', 'done', null, new Date('2026-03-08'));
await insertTask(ms1, 't-1-2', 'Build sign-up / login pages with email auth',
  'Email + password auth using Supabase Auth. Include forgot-password flow.',
  3, 2.5, 'high', 'done', null, new Date('2026-03-10'));
await insertTask(ms1, 't-1-3', 'Design DB schema: notes, tags, summaries',
  'Create tables in Supabase with RLS policies. Write migration scripts.',
  2, 2, 'normal', 'done', null, new Date('2026-03-12'));
await insertTask(ms1, 't-1-4', 'Build empty dashboard UI with sidebar nav',
  'Responsive shell layout. Sidebar: Notes, Search, Tags, Settings.',
  3, 4, 'normal', 'done', null, new Date('2026-03-15'));
await insertTask(ms1, 't-1-5', 'Set up error monitoring (Sentry)',
  'Sentry free tier wired up. Test error capture before going further.',
  1, 1, 'normal', 'done', null, new Date('2026-03-15'));

const ms2 = await insertMilestone(ph1, 'ms-2', 'Core Note Editor Working',
  'User can create, edit, save, and delete notes with rich text.',
  20, 1, new Date('2026-04-01'));

await insertTask(ms2, 't-2-1', 'Integrate Tiptap rich-text editor',
  'Headings, bold/italic/lists, inline code, undo/redo. Auto-save every 30s.',
  4, 5, 'critical', 'done', null, new Date('2026-03-22'));
await insertTask(ms2, 't-2-2', 'Note list + create/delete flow',
  'Sidebar shows all notes sorted by updated_at. Create blank note on click.',
  3, 3, 'high', 'done', null, new Date('2026-03-25'));
await insertTask(ms2, 't-2-3', 'Tag system: add/remove tags on notes',
  'Tags stored in DB, chips UI in editor header. Filter by tag in sidebar.',
  3, 3, 'normal', 'done', null, new Date('2026-03-28'));
await insertTask(ms2, 't-2-4', 'Full-text search across notes',
  'Postgres tsvector search. Highlight matching terms in results.',
  4, 5, 'high', 'done', null, new Date('2026-04-01'));

// Phase 2 — Core Features
const ph2 = await insertPhase('ph-2', 'Core AI Features', 'Build the AI summarisation loop and make it reliable.', 1);

const ms3 = await insertMilestone(ph2, 'ms-3', 'AI Summarisation MVP',
  'User clicks Summarise on a note and gets a readable 3-point summary within 2 seconds.',
  22, 0, new Date('2026-04-20'));

await insertTask(ms3, 't-3-1', 'Wire Claude API (claude-haiku-4-5) for summarisation',
  'POST /api/summarise → Claude API with note content. Return structured JSON.',
  3, 3, 'critical', 'done', null, new Date('2026-04-08'));
await insertTask(ms3, 't-3-2', 'Streaming summarisation response to UI',
  'Server-sent events from API route. Show summary building in real-time.',
  3, 4, 'high', 'done', null, new Date('2026-04-12'));
await insertTask(ms3, 't-3-3', 'Summary storage and display panel',
  'Save most recent summary to DB. Show in right panel next to editor.',
  3, 3, 'normal', 'done', null, new Date('2026-04-15'));
await insertTask(ms3, 't-3-4', 'Rate limiting: max 10 summaries/user/hour',
  'Supabase RLS + server-side counter. Return 429 with retry-after header.',
  2, 2.5, 'high', 'done', null, new Date('2026-04-18'));
await insertTask(ms3, 't-3-5', 'Quality evaluation: thumbs up/down on each summary',
  'Save rating to DB. Will use to monitor quality and tune prompts.',
  2, 1.5, 'normal', 'done', null, new Date('2026-04-20'));

const ms4 = await insertMilestone(ph2, 'ms-4', 'Connected Notes (Backlinks)',
  'User sees which notes reference the current note and can click to navigate.',
  18, 1, null);

await insertTask(ms4, 't-4-1', 'Parse [[Note Title]] syntax in editor',
  'Custom Tiptap extension. Highlight links, warn on broken references.',
  4, 3, 'high', 'done', null, new Date('2026-04-28'));
await insertTask(ms4, 't-4-2', 'Build backlinks panel in note view',
  'Query: find all notes that reference this note\'s title. Show in sidebar.',
  3, 3, 'normal', 'in_progress', '[2026-05-02 09:15] Core query works, UI panel 50% done');
await insertTask(ms4, 't-4-3', 'Graph view: visual note network',
  'D3 force graph. Nodes = notes, edges = [[links]]. Click to navigate.',
  5, null, 'normal', 'todo');
await insertTask(ms4, 't-4-4', 'Orphan note detection and cleanup prompt',
  'Nightly job: flag notes with no links and no tag. Surface in dashboard.',
  2, null, 'normal', 'todo');

// Phase 3 — Launch
const ph3 = await insertPhase('ph-3', 'Beta Launch', 'Get 50 real users. Measure. Decide.', 2);

const ms5 = await insertMilestone(ph3, 'ms-5', 'Beta-Ready Polish',
  'Product is stable, not embarrassing, and works on Chrome/Firefox/Safari desktop.',
  16, 0, null);

await insertTask(ms5, 't-5-1', 'Fix top UX friction points from internal review',
  'List gathered: keyboard shortcuts missing, mobile sidebar broken, empty states ugly.',
  4, null, 'high', 'in_progress', '[2026-05-05 11:00] Keyboard shortcuts done. Empty states WIP.');
await insertTask(ms5, 't-5-2', 'Write landing page (problem → solution → sign-up)',
  'One-page site. Problem statement, 3 hero features, email capture for beta.',
  4, null, 'normal', 'todo');
await insertTask(ms5, 't-5-3', 'Manual QA: full user flow start to finish',
  'Create account → write note → add tags → summarise → search → share → delete.',
  3, null, 'high', 'todo');
await insertTask(ms5, 't-5-4', 'Set up PostHog analytics',
  'Track: note created, summarise clicked, search used, session length.',
  2, null, 'normal', 'todo');

const ms6 = await insertMilestone(ph3, 'ms-6', '50 Beta Users Active',
  '50 users have signed up and created at least one note in the last 7 days.',
  12, 1, null);

await insertTask(ms6, 't-6-1', 'Post on Indie Hackers and Product Hunt Ship',
  'Draft post, get 3 people to upvote on launch day.',
  2, null, 'normal', 'blocked',
  '[2026-05-04 14:00] BLOCKED: waiting on landing page to be live first');
await insertTask(ms6, 't-6-2', 'DM 30 target users personally',
  'IndieHackers note-takers, PKM Twitter, students in /r/studytips.',
  3, null, 'normal', 'todo');
await insertTask(ms6, 't-6-3', 'Onboarding email sequence (3 emails over 7 days)',
  'Email 1: welcome + first note tips. Email 2: try AI summary. Email 3: share a note.',
  3, null, 'normal', 'todo');

// ── 8. Risk register ──────────────────────────────────────────────────────────

await client.query(
  `INSERT INTO risk_register
     (project_id, risk_key, description, likelihood, impact, risk_score,
      early_signals, mitigation, contingency, owner, status, source_agent, entry_type)
   VALUES
     ($1,'R-001','Claude API latency spikes above 2s SLA during summarisation','medium','high',6,
      'P99 latency > 1.5s in staging tests',
      'Cache summaries aggressively; show streaming output so perceived latency is low.',
      'Fall back to a local extractive summariser if API latency > 3s.',
      'founder','open','execution','risk')`,
  [projectId],
);

await client.query(
  `INSERT INTO risk_register
     (project_id, risk_key, description, likelihood, impact, risk_score,
      early_signals, mitigation, contingency, owner, status, source_agent, entry_type)
   VALUES
     ($1,'R-002','Low beta retention — users sign up but don''t form a note-taking habit','high','high',9,
      'Day-7 retention below 20% in first 2 weeks',
      'Trigger in-app nudge after 3-day inactivity. Onboarding email sequence. Focus on one daily habit use-case.',
      'Pivot to a niche (e.g., meeting notes only) where habit is externally triggered.',
      'founder','open','execution','risk')`,
  [projectId],
);

await client.query(
  `INSERT INTO risk_register
     (project_id, risk_key, description, likelihood, impact, risk_score,
      early_signals, mitigation, contingency, owner, status, source_agent, entry_type)
   VALUES
     ($1,'R-003','AI summarisation quality is too generic — users stop using it','medium','high',6,
      'Summary thumbs-down rate > 35% in first week',
      'Iterate on the prompt. Add context: note length, tags, user''s past ratings.',
      'Let users edit summaries and use edits as fine-tuning signal.',
      'founder','open','intake','risk')`,
  [projectId],
);

await client.query(
  `INSERT INTO risk_register
     (project_id, risk_key, description, likelihood, impact, risk_score,
      early_signals, mitigation, contingency, owner, status, source_agent, entry_type)
   VALUES
     ($1,'R-004','ASSUMPTION: Users want a web app, not a desktop app (Obsidian/Notion competitor)','low','medium',2,
      'Beta signups from mobile > 60%',
      'Validate assumption in week 1 user interviews before building mobile.',
      'Shift to a browser extension instead of standalone app.',
      'founder','accepted','intake','assumption')`,
  [projectId],
);

// ── 9. Decision log ───────────────────────────────────────────────────────────

await client.query(
  `INSERT INTO decision_log
     (project_id, decision_key, decision, rationale, risk_evaluation, outcome, decided_at)
   VALUES
     ($1,'D-001',
      'Use claude-haiku-4-5 for summarisation instead of gpt-4o-mini',
      'Haiku is 3x cheaper per token at our volume, and blind tests showed equal quality for short-note summarisation.',
      'Risk: Anthropic API dependency. Mitigated by keeping the AI call behind an interface we can swap.',
      null,
      '2026-04-06 10:00')`,
  [projectId],
);

await client.query(
  `INSERT INTO decision_log
     (project_id, decision_key, decision, rationale, risk_evaluation, outcome, decided_at)
   VALUES
     ($1,'D-002',
      'Use streaming (SSE) for summarisation instead of waiting for full response',
      'User testing showed people gave up after 3 seconds if nothing appeared. Streaming perceived as instant.',
      'Slight implementation complexity. Worth it for the UX gain.',
      'Shipped in milestone 3. Thumbs-up rate went from 44% to 61% after streaming rollout.',
      '2026-04-10 15:00')`,
  [projectId],
);

await client.query(
  `INSERT INTO decision_log
     (project_id, decision_key, decision, rationale, risk_evaluation, outcome, decided_at)
   VALUES
     ($1,'D-003',
      'Delay graph view to after beta launch',
      'Graph view is compelling but not table-stakes. Cuts 5h from sprint 4, lets us launch 2 weeks earlier.',
      'Risk of scope creep back in if users ask for it immediately. Will park in v2 backlog.',
      null,
      '2026-04-25 09:00')`,
  [projectId],
);

// ── 10. Knowledge entries ──────────────────────────────────────────────────────

const knowledgeItems = [
  {
    type: 'lesson_learned',
    title: 'Users want folder structure, not just tags',
    content: 'In user interviews (week 3), 4 out of 5 participants tried to drag notes into folders. Tags alone feel disorganised to most people. We should add a folder hierarchy in v2 — this is probably the top feature gap.',
    tags: ['user-research', 'ux', 'v2-candidate'],
  },
  {
    type: 'decision',
    title: 'Chose Tiptap over ProseMirror direct and Quill',
    content: "ProseMirror is too low-level for our timeline. Quill is unmaintained. Tiptap wraps ProseMirror with a clean extension API — we can ship the custom [[link]] extension without reinventing the wheel. Downside: 80kb bundle size addition.",
    tags: ['tech-choice', 'editor', 'dependencies'],
  },
  {
    type: 'risk_insight',
    title: 'Supabase RLS policies caused 3h of debugging on the backlinks query',
    content: "The backlinks query does a self-join on the notes table. RLS applies per-row, but the join reads rows from user B's notes (to check if they reference user A's note title). RLS blocked the join silently — returned empty results. Fix: use a security definer function for the backlinks query.",
    tags: ['supabase', 'rls', 'debugging', 'security'],
  },
];

for (const k of knowledgeItems) {
  await client.query(
    `INSERT INTO knowledge_entries (project_id, project_name, type, title, content, source_type, tags)
     VALUES ($1, $2, $3, $4, $5, 'manual', $6)`,
    [projectId, 'NoteFlow AI', k.type, k.title, k.content, k.tags],
  );
}

// ── 11. Conversation history (intake + planning) ──────────────────────────────

await client.query(
  `INSERT INTO conversation_history (project_id, agent, role, content, token_count)
   VALUES ($1,'intake','user','I want to build an AI note-taking tool. Think Notion meets AI — you write notes and it automatically generates summaries, finds connections, and surfaces what you wrote 6 months ago when it becomes relevant.',120)`,
  [projectId],
);

await client.query(
  `INSERT INTO conversation_history (project_id, agent, role, content, token_count)
   VALUES ($1,'intake','assistant','Great concept. Let me ask a few things to sharpen the brief: (1) Who is your primary user — students, knowledge workers, founders, or someone else? (2) What does success look like in 3 months — is it revenue, users, or validation? (3) Any constraints I should know about — time per week, budget, specific tech you want or must avoid?',280)`,
  [projectId],
);

await client.query(
  `INSERT INTO conversation_history (project_id, agent, role, content, token_count)
   VALUES ($1,'planning','user','Here is my approved plan. Let''s move to execution.',40)`,
  [projectId],
);

await client.query(
  `INSERT INTO conversation_history (project_id, agent, role, content, token_count)
   VALUES ($1,'planning','system','Plan approved by founder. Project advancing to execution stage.',60)`,
  [projectId],
);

// ── 12. Add a blocker record for the blocked task ─────────────────────────────

const { rows: [blockedTask] } = await client.query(
  `SELECT id FROM tasks WHERE project_id = $1 AND task_key = 't-6-1'`,
  [projectId],
);

if (blockedTask) {
  await client.query(
    `INSERT INTO blockers (project_id, task_id, description)
     VALUES ($1, $2, 'Waiting on landing page to be live — no URL to point people to for sign-ups')`,
    [projectId, blockedTask.id],
  );
}

// ── Done ──────────────────────────────────────────────────────────────────────

await client.end();

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SEED COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  URL:      https://project-os-production-4d9c.up.railway.app
  Email:    ${TEST_EMAIL}
  Password: ${TEST_PASSWORD}
  Project:  NoteFlow AI (${projectId})
  Stage:    execution
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  What's seeded:
    3 phases → 6 milestones → 21 tasks
    (mix of done / in_progress / todo / blocked)
    4 risks (3 real, 1 assumption)
    3 decisions
    3 knowledge entries
    1 active blocker (task t-6-1)
    Conversation history (intake + planning)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
