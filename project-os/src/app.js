import 'dotenv/config';
import express from 'express';

import authRouter         from './routes/auth.js';
import projectsRouter     from './routes/projects.js';
import messagesRouter     from './routes/messages.js';
import approveRouter      from './routes/approve.js';
import retroRouter        from './routes/retro.js';
import tasksRouter        from './routes/tasks.js';
import transitionsRouter  from './routes/transitions.js';
import documentsRouter    from './routes/documents.js';
import raidRouter         from './routes/raid.js';
import specialistsRouter  from './routes/specialists.js';
import registryRouter     from './routes/registry.js';
import assignmentsRouter  from './routes/assignments.js';
import knowledgeRouter    from './routes/knowledge.js';
import workspaceRouter    from './routes/workspace.js';
import telemetryRouter    from './routes/telemetry.js';
import briefRouter        from './routes/brief.js';
import workroomRouter     from './routes/workroom.js';
import budgetsRouter      from './routes/budgets.js';
import integrationsRouter from './routes/integrations.js';
import abRouter           from './routes/ab.js';
import { errorHandler }                  from './middleware/errors.js';
import { requireAuth }                   from './middleware/auth.js';
import { rateLimit }                     from './middleware/rateLimit.js';
import { injectionDetection, piiAudit }  from './middleware/security.js';

const app = express();

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Request logger (dev only) ─────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`→ ${req.method} ${req.path}`);
    next();
  });
}

// ── Health check (no auth) ────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date() }));

// ── Auth routes (no auth required) ───────────────────────────────────────────
app.use('/auth', authRouter);

// ── All routes below require a valid JWT ─────────────────────────────────────
app.use(requireAuth);

// ── Routes ────────────────────────────────────────────────────────────────────
// Mount order is load-bearing: rateLimit → injectionDetection → piiAudit on /message.
app.use('/projects',                   projectsRouter);
app.use('/projects/:id/message',       rateLimit, injectionDetection, piiAudit, messagesRouter);
app.use('/projects/:id/approve',       approveRouter);
app.use('/projects/:id/retro',         retroRouter);
app.use('/projects/:id/tasks',         tasksRouter);
app.use('/projects/:id/transition',    transitionsRouter);
app.use('/projects/:id/documents',     documentsRouter);
app.use('/projects/:id/raid',          raidRouter);
app.use('/projects/:id/specialists',   specialistsRouter);
app.use('/projects/:id/assignments',   assignmentsRouter);
app.use('/registry',                   registryRouter);
app.use('/knowledge',                  knowledgeRouter);
app.use('/projects/:id/workspace',     workspaceRouter);
app.use('/telemetry',                  telemetryRouter);
app.use('/projects/:id/brief',         briefRouter);
app.use('/projects/:id/workroom',      workroomRouter);
app.use('/projects/:id/budgets',       budgetsRouter);
app.use('/integrations',               integrationsRouter);
app.use('/ab',                         abRouter);

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Error handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

export default app;
