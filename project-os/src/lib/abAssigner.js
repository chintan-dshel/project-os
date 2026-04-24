import { query } from '../db/pool.js';

// Returns { variantId, model, systemPrompt, temperature } or null if no active experiment.
export async function resolveVariant(projectId, agent) {
  if (!projectId || !agent) return null;

  // Find active variants for this agent's experiments
  const { rows: variants } = await query(
    `SELECT v.id, v.experiment_key, v.variant_name, v.model,
            v.system_prompt, v.temperature, v.traffic_weight
     FROM ab_variants v
     WHERE v.agent = $1 AND v.active = true
     ORDER BY v.experiment_key, v.traffic_weight DESC`,
    [agent],
  );
  if (!variants.length) return null;

  // Group by experiment_key — process one experiment at a time
  const experiments = {};
  for (const v of variants) {
    if (!experiments[v.experiment_key]) experiments[v.experiment_key] = [];
    experiments[v.experiment_key].push(v);
  }

  for (const [experimentKey, expVariants] of Object.entries(experiments)) {
    // Check for existing sticky assignment
    const { rows: existing } = await query(
      `SELECT variant_id FROM ab_assignments
       WHERE project_id = $1 AND experiment_key = $2`,
      [projectId, experimentKey],
    );

    if (existing.length) {
      const assigned = variants.find(v => v.id === existing[0].variant_id);
      if (assigned) return toResult(assigned);
      continue;
    }

    // New assignment — weighted random pick
    const totalWeight = expVariants.reduce((s, v) => s + v.traffic_weight, 0);
    if (totalWeight === 0) continue;

    const chosen = weightedPick(expVariants, Math.random() * totalWeight);

    await query(
      `INSERT INTO ab_assignments (project_id, experiment_key, variant_id)
       VALUES ($1, $2, $3) ON CONFLICT (project_id, experiment_key) DO NOTHING`,
      [projectId, experimentKey, chosen.id],
    );

    return toResult(chosen);
  }

  return null;
}

// Exported for unit testing — picks from a list of {traffic_weight} items given a pre-rolled value.
export function weightedPick(variants, roll) {
  let cumulative = 0;
  for (const v of variants) {
    cumulative += v.traffic_weight;
    if (roll < cumulative) return v;
  }
  return variants[variants.length - 1];
}

function toResult(v) {
  return {
    variantId:    v.id,
    model:        v.model,
    systemPrompt: v.system_prompt ?? null,
    temperature:  parseFloat(v.temperature ?? 1.0),
  };
}
