import { describe, expect, test } from 'vitest';
import { peso, pesosToCentavos } from '@/lib/money';

describe('pesosToCentavos', () => {
  test('converts a whole-peso string to centavos', () => {
    expect(pesosToCentavos('21')).toBe(2100);
  });

  test('converts a peso string with cents to centavos', () => {
    expect(pesosToCentavos('21.25')).toBe(2125);
  });

  test('never loses precision the way float multiplication would', () => {
    // 0.1 * 3 === 0.30000000000000004 in JS float math — this must not happen here.
    expect(pesosToCentavos('0.30')).toBe(30);
  });

  test('pads a single decimal digit to two centavos digits', () => {
    expect(pesosToCentavos('5.1')).toBe(510);
  });

  test('treats a blank string as zero', () => {
    expect(pesosToCentavos('')).toBe(0);
  });

  test('preserves the sign on a negative amount with cents', () => {
    expect(pesosToCentavos('-5.50')).toBe(-550);
  });

  test('preserves the sign on a negative amount under one peso', () => {
    // parseInt("-0", 10) is -0, which is falsy — a naive `|| 0` fallback
    // silently drops the sign here if it's not handled explicitly.
    expect(pesosToCentavos('-0.50')).toBe(-50);
  });

  test('parses its own peso() output back to the original centavos (round-trip)', () => {
    expect(pesosToCentavos(peso(123456))).toBe(123456);
  });
});

describe('peso', () => {
  test('formats centavos as a peso string with two decimal places', () => {
    expect(peso(2125)).toBe('₱21.25');
  });

  test('formats a whole-peso amount with trailing .00', () => {
    expect(peso(2100)).toBe('₱21.00');
  });

  test('formats zero correctly', () => {
    expect(peso(0)).toBe('₱0.00');
  });
});
