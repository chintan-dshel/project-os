import jwt      from 'jsonwebtoken';
import bcrypt   from 'bcryptjs';
import { query } from './db.js';

export function signTestToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  );
}

export async function createTestUser(tag = '') {
  const email = `test+${Date.now()}${tag}@vitest.local`;
  const passwordHash = await bcrypt.hash('testpassword', 4);
  const { rows } = await query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email`,
    [email, passwordHash],
  );
  const user  = rows[0];
  const token = signTestToken(user);
  return { user, token };
}
