export function peso(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function pesosToCentavos(input: string): number {
  const clean = input.trim();
  const [pesosPart, centsPart = ''] = clean.split('.');
  const pesos = parseInt(pesosPart || '0', 10) || 0;
  const cents = parseInt((centsPart + '00').slice(0, 2), 10) || 0;
  return pesos * 100 + cents;
}
