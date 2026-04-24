import { describe, test, expect } from 'vitest';
import { detectPii } from '../../src/middleware/security.js';

describe('detectPii', () => {
  test('detects an email address', () => {
    const result = detectPii('Contact me at user@example.com for details.');
    expect(result).toContainEqual({ type: 'email', count: 1 });
  });

  test('detects multiple email addresses', () => {
    const result = detectPii('Send to alice@test.com and bob@test.com');
    expect(result).toContainEqual({ type: 'email', count: 2 });
  });

  test('detects a US phone number', () => {
    const result = detectPii('Call me at 555-867-5309');
    expect(result).toContainEqual({ type: 'phone', count: 1 });
  });

  test('detects a SSN', () => {
    const result = detectPii('My SSN is 123-45-6789');
    expect(result).toContainEqual({ type: 'ssn', count: 1 });
  });

  test('detects a valid credit card (Luhn check)', () => {
    const result = detectPii('Card: 4111111111111111');
    expect(result).toContainEqual({ type: 'credit_card', count: 1 });
  });

  test('does NOT flag an invalid credit-card-like number', () => {
    const result = detectPii('Number: 1234567890123456');
    const cardHit = result.find(r => r.type === 'credit_card');
    expect(cardHit).toBeUndefined();
  });

  test('returns empty array for clean text', () => {
    expect(detectPii('Hello, how are you today?')).toEqual([]);
  });

  test('detects multiple PII types in one message', () => {
    const text = 'Email: admin@example.com | Card: 4111111111111111';
    const types = detectPii(text).map(r => r.type);
    expect(types).toContain('email');
    expect(types).toContain('credit_card');
  });
});
