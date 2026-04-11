import 'dotenv/config';
import express from 'express';

import projectsRouter from './routes/projects.js';
import messagesRouter from './routes/messages.js';
import approveRouter  from './routes/approve.js';
import retroRouter    from './routes/retro.js';
import tasksRouter       from './routes/tasks.js';
import transitionsRouter from './routes/transitions.js';
import documentsRouter   from './routes/documents.js';
import raidRouter        from './routes/raid.js';
import specialistsRouter from './routes/specialists.js';
import registryRouter    from './routes/registry.js';
import assignmentsRouter from './routes/assignments.js';
import knowledgeRouter   from './routes/knowledge.js';
import workspaceRouter   from './routes/workspace.js';
import { errorHandler } from './middleware/errors.js';

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// Request logger (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`→ ${req.method} ${req.path}`);
    next();
  });
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date() }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/projects',                   projectsRouter);
app.use('/projects/:id/message',       messagesRouter);
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

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Error handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

// ── Boot ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`[server] AI Project OS API running on port ${PORT}`);
  console.log(`[server] NODE_ENV=${process.env.NODE_ENV ?? 'development'}`);
});

export default app;
