export function peso(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function pesosToCentavos(input: string): number {
  const isNegative = input.trim().startsWith('-');
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
