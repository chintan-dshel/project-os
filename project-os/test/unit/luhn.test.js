import { describe, test, expect } from 'vitest';
import { luhn } from '../../src/middleware/security.js';

describe('luhn', () => {
  test('validates a known Visa test card', () => {
    expect(luhn('4111111111111111')).toBe(true);
  });

  test('validates a known Mastercard test card', () => {
    expect(luhn('5500005555555559')).toBe(true);
  });

  test('validates a known AmEx test card', () => {
    expect(luhn('378282246310005')).toBe(true);
  });

  test('rejects an invalid card number', () => {
    expect(luhn('1234567890123456')).toBe(false);
  });

  test('rejects a number that is too short', () => {
    expect(luhn('123456789012')).toBe(false);
  });

  test('rejects a number that is too long (>19 digits)', () => {
    expect(luhn('12345678901234567890')).toBe(false);
  });

  test('strips non-digit characters before checking', () => {
    expect(luhn('4111-1111-1111-1111')).toBe(true);
    expect(luhn('4111 1111 1111 1111')).toBe(true);
  });

  test('rejects empty string', () => {
    expect(luhn('')).toBe(false);
  });
});
