import { Router }     from 'express';
import bcrypt          from 'bcryptjs';
import jwt             from 'jsonwebtoken';
import { findUserByEmail, createUser } from '../db/auth.queries.js';

const router     = Router();
const SALT_ROUNDS = 12;
const TOKEN_TTL   = '7d';

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL },
  );
}

router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 characters' });
    }

    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user  = await createUser({ email: email.toLowerCase().trim(), passwordHash });
    const token = signToken(user);

    return res.status(201).json({ token, user: { id: user.id, email: user.email } });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user);
    return res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) { next(err); }
});

// GET /auth/me — verify token and return current user
router.get('/me', async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    return res.json({ user: { id: payload.sub, email: payload.email } });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

export default router;
