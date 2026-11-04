export function peso(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function pesosToCentavos(input: string): number {
  // Checked anywhere in the string, not just at the start — peso()'s own
  // output puts the minus sign after the currency symbol ("₱-5.50").
  const isNegative = input.includes('-');
  // Strip everything but digits and the decimal point — tolerates raw typed
  // input ("21.25") as well as peso()'s own formatted output ("₱1,234.56"),
  // and drops the sign so it can be handled explicitly below (parseInt("-0")
  // is -0, a falsy value that silently loses the sign under a `|| 0` fallback).
  const digitsAndDot = input.replace(/[^0-9.]/g, '');
  const [pesosPart, centsPart = ''] = digitsAndDot.split('.');
  const pesos = parseInt(pesosPart || '0', 10) || 0;
  const cents = parseInt((centsPart + '00').slice(0, 2), 10) || 0;
  const magnitude = pesos * 100 + cents;
  return isNegative ? -magnitude : magnitude;
}

// pesosToCentavos is forgiving on purpose (it must round-trip peso()'s own
// output), so on its own it reads "1,5" as 15 pesos and "1e3" as 13. Use this
// to validate what a person typed *before* converting: it accepts only a plain
// amount, optionally with a leading ₱ and correctly-placed thousands commas,
// and at most two decimal places — and returns null for anything else rather
// than guessing what was meant. Also null above MAX_CENTAVOS: the backend
// stores money in a 32-bit INTEGER column, so anything larger could only come
// back as a server error.
export const MAX_CENTAVOS = 2_147_483_647; // ₱21,474,836.47
const PESO_INPUT = /^₱?\s*(\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;

export function parsePesoInput(input: string): number | null {
  const trimmed = input.trim();
  if (!PESO_INPUT.test(trimmed)) return null;
  const centavos = pesosToCentavos(trimmed);
  return centavos <= MAX_CENTAVOS ? centavos : null;
}

// Whole centavos to the plain "21.25" a text input expects. Splits the integer
// into pesos and cents with trunc and %, so there is no toFixed rounding and no
// float multiplication — for any whole number of centavos the division below is
// exact.
export function centavosToPesoInput(centavos: number): string {
  const sign = centavos < 0 ? '-' : '';
  const magnitude = Math.abs(centavos);
  const pesos = Math.trunc(magnitude / 100);
  const cents = magnitude % 100;
  return `${sign}${pesos}.${String(cents).padStart(2, '0')}`;
}
