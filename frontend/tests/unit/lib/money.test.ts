import { describe, expect, test } from 'vitest';
import { centavosToPesoInput, parsePesoInput, peso, pesosToCentavos } from '@/lib/money';

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

  test('parses its own peso() output for a negative amount (round-trip)', () => {
    // peso() puts the minus sign after the currency symbol ("₱-5.50"), not
    // before it — a sign check that only looks at the start of the string
    // misses it.
    expect(pesosToCentavos(peso(-123456))).toBe(-123456);
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

// pesosToCentavos is deliberately forgiving (it has to round-trip peso()'s own
// output), which means it silently reads "1,5" as 15 pesos and "1e3" as 13.
// A form must not accept that, so it validates with parsePesoInput first.
describe('parsePesoInput', () => {
  test.each([
    ['21', 2100],
    ['21.25', 2125],
    ['5.1', 510],
    ['0.05', 5],
    ['  21.25  ', 2125],
    ['₱21.25', 2125],
    ['1,234.56', 123456],
    ['₱1,234,567.00', 123456700],
  ])('accepts "%s" as %i centavos', (input, expected) => {
    expect(parsePesoInput(input)).toBe(expected);
  });

  test.each(['', '   ', '1,5', '1e3', 'abc', '-3', '--3', '1.234', '1..5', '5.', '.5', '1,23,456', '12 34', '₱', '1,5.00'])(
    'rejects "%s" instead of guessing what was meant',
    (input) => {
      expect(parsePesoInput(input)).toBeNull();
    }
  );

  test('round-trips peso()\'s own formatted output', () => {
    expect(parsePesoInput(peso(123456))).toBe(123456);
  });

  // The backend stores money in a 32-bit INTEGER column (max 2,147,483,647
  // centavos), so a larger amount can only ever come back as a server error.
  test('accepts the largest amount the database can hold', () => {
    expect(parsePesoInput('21474836.47')).toBe(2147483647);
  });

  test.each(['21474836.48', '30000000', '999999999999'])('rejects "%s", which is over that ceiling', (input) => {
    expect(parsePesoInput(input)).toBeNull();
  });
});

describe('centavosToPesoInput', () => {
  test.each([
    [2125, '21.25'],
    [1500, '15.00'],
    [5, '0.05'],
    [0, '0.00'],
    [100, '1.00'],
    [99999900, '999999.00'],
    [-150, '-1.50'],
  ])('%i centavos -> "%s"', (centavos, expected) => {
    expect(centavosToPesoInput(centavos)).toBe(expected);
  });

  test('round-trips through parsePesoInput', () => {
    expect(parsePesoInput(centavosToPesoInput(2125))).toBe(2125);
  });
});
