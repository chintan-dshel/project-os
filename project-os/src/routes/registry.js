/**
 * routes/registry.js
 * Agent Registry — CRUD for the extensible agent catalog
 */

import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

// GET /registry — list all agents
router.get('/', async (req, res, next) => {
  try {
    const activeOnly = req.query.active === 'true'
    const { rows } = await pool.query(
      `SELECT * FROM agent_registry
       ${activeOnly ? 'WHERE is_active = TRUE' : ''}
       ORDER BY created_at ASC`,
    )
    res.json({ agents: rows })
  } catch (err) { next(err) }
})

// GET /registry/:slug — single agent by slug
router.get('/:slug', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM agent_registry WHERE slug = $1',
      [req.params.slug],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Agent not found' })
    res.json({ agent: rows[0] })
  } catch (err) { next(err) }
})

// POST /registry — create custom agent
router.post('/', async (req, res, next) => {
  const { name, slug, description, system_prompt_template, output_format, icon } = req.body
  if (!name || !slug || !system_prompt_template) {
    return res.status(400).json({ error: 'name, slug, and system_prompt_template are required' })
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO agent_registry (name, slug, description, system_prompt_template, output_format, icon)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, slug, description ?? null, system_prompt_template, output_format ?? 'markdown', icon ?? null],
    )
    res.status(201).json({ agent: rows[0] })
  } catch (err) { next(err) }
})

// PATCH /registry/:id — update name, description, prompt, is_active, etc.
router.patch('/:id', async (req, res, next) => {
  const { name, description, system_prompt_template, output_format, icon, is_active } = req.body
  try {
    const sets = []
    const vals = []
    let n = 1
    if (name                  !== undefined) { sets.push(`name=$${n++}`);                   vals.push(name) }
    if (description           !== undefined) { sets.push(`description=$${n++}`);            vals.push(description) }
    if (system_prompt_template!== undefined) { sets.push(`system_prompt_template=$${n++}`); vals.push(system_prompt_template) }
    if (output_format         !== undefined) { sets.push(`output_format=$${n++}`);          vals.push(output_format) }
    if (icon                  !== undefined) { sets.push(`icon=$${n++}`);                   vals.push(icon) }
    if (is_active             !== undefined) { sets.push(`is_active=$${n++}`);              vals.push(is_active) }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' })
    vals.push(req.params.id)
    const { rows } = await pool.query(
      `UPDATE agent_registry SET ${sets.join(',')} WHERE id=$${n} RETURNING *`,
      vals,
    )
    if (!rows[0]) return res.status(404).json({ error: 'Agent not found' })
    res.json({ agent: rows[0] })
  } catch (err) { next(err) }
})

export default router
