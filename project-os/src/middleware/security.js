import crypto from 'crypto';
import { query } from '../db/pool.js';

// ── Prompt injection patterns ─────────────────────────────────────────────────

export const PATTERNS = [
  /ignore\s+(all\s+|the\s+)?(previous|above|prior)\s+(instructions?|prompts?|messages?)/i,
  /disregard\s+(all\s+|the\s+)?(previous|above|prior)/i,
  /you\s+are\s+(now\s+|actually\s+)?(DAN|a\s+different|no\s+longer)/i,
  /\bjailbreak\b/i,
  /system\s*:\s*you\s+are/i,
  /###\s*(system|instruction|admin)/i,
  /<\/?(system|instructions?)>/i,
];

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function extractUserText(req) {
  return req.body?.message ?? req.body?.content ?? null;
}

// ── Injection detection middleware ────────────────────────────────────────────

export function injectionDetection(req, res, next) {
  const text = extractUserText(req);
  if (!text || typeof text !== 'string') return next();

  for (const pattern of PATTERNS) {
    if (pattern.test(text)) {
      console.warn('[security] injection detected', {
        user_id:         req.user?.id ?? null,
        project_id:      req.params?.id ?? null,
        matched_pattern: pattern.source,
        message_hash:    sha256(text),
      });
      return res.status(403).json({
        error: {
          code:    'INJECTION_DETECTED',
          message: 'Message contains patterns associated with prompt injection.',
        },
      });
    }
  }

  next();
}

// ── PII detection middleware (audit-only — message reaches agent unchanged) ───

// Credit card Luhn check
export function luhn(num) {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

const PII_PATTERNS = {
  email:       /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
  phone:       /(?:\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}\b|\+\d{1,3}[\s\-.]?\d{4,14}/g,
  ssn:         /\b\d{3}-\d{2}-\d{4}\b/g,
  credit_card: /\b(?:\d[\s\-]?){13,19}\b/g,
};

export function detectPii(text) {
  const found = [];

  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern) ?? [];

    if (type === 'credit_card') {
      const validCards = matches.filter(m => luhn(m));
      if (validCards.length > 0) {
        found.push({ type, count: validCards.length });
      }
    } else if (matches.length > 0) {
      found.push({ type, count: matches.length });
    }
  }

  return found;
}

export function piiAudit(req, res, next) {
  const text = extractUserText(req);
  if (!text || typeof text !== 'string') return next();

  const detections = detectPii(text);

  if (detections.length > 0) {
    const hash        = sha256(text);
    const projectId   = req.params?.id ?? null;
    const userId      = req.user?.id   ?? null;

    req.piiDetected = detections.map(d => d.type);

    // Fire-and-forget — never block the request
    writePiiEvents(detections, { hash, projectId, userId }).catch(err =>
      console.error('[pii-audit] write failed', err),
    );
  } else {
    req.piiDetected = [];
  }

  next();
}

async function writePiiEvents(detections, { hash, projectId, userId }) {
  for (const { type, count } of detections) {
    await query(
      `INSERT INTO pii_events (user_id, project_id, pii_type, match_count, message_hash, redacted)
       SELECT $1, $2, $3, $4, $5, false
       WHERE EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'pii_events'
       )`,
      [userId, projectId, type, count, hash],
    ).catch(() => {});
  }
}
