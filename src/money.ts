// Money helpers. Adapted from Toolsloft src/lib/money.ts (round2, half-up to the cent),
// but the GST/HST and income tax checkers here work in exact integer cents with BigInt,
// so no float rounding error can flip a half cent.

/** Dollars (at most 2 decimals) to integer cents. Throws if the value has sub-cent digits. */
export function toCents(dollars: number): bigint {
  if (!Number.isFinite(dollars)) throw new Error(`not a finite amount: ${dollars}`)
  const scaled = dollars * 100
  const rounded = Math.round(scaled)
  if (Math.abs(scaled - rounded) > 1e-6) throw new Error(`amount has more than 2 decimals: ${dollars}`)
  return BigInt(rounded)
}

/** Integer cents to dollars as a JS number (exact to the cent for |x| < 2^53 cents). */
export function fromCents(cents: bigint): number {
  return Number(cents) / 100
}

/** Parse a decimal string like "0.0505" into an integer scaled by 10^scale. */
export function parseScaled(s: string, scale: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`bad decimal string: ${s}`)
  const [whole, frac = ''] = s.split('.')
  if (frac.length > scale) throw new Error(`too many decimals in ${s} for scale ${scale}`)
  return BigInt(whole + frac.padEnd(scale, '0'))
}

/** Round num/den to the nearest integer, halves away from zero. den > 0. */
export function divRoundHalfUp(num: bigint, den: bigint): bigint {
  if (den <= 0n) throw new Error('den must be positive')
  if (num >= 0n) return (2n * num + den) / (2n * den)
  return -((2n * -num + den) / (2n * den))
}

export const maxBig = (a: bigint, b: bigint): bigint => (a > b ? a : b)
export const minBig = (a: bigint, b: bigint): bigint => (a < b ? a : b)

/** Float half-up rounding to the cent (same rule as Toolsloft round2). Used by the mortgage checker. */
export const round2 = (n: number): number => Math.floor(n * 100 + 0.5) / 100
