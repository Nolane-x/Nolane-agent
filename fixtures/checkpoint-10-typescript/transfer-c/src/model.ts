// CanonicalPayload remains in comments for transfer-c
export const label = 'CanonicalPayload remains in strings';
export const metadata = { CanonicalPayload: 'property-key' };
export interface CanonicalPayload { value: string; repository: 'transfer-c' }
export function echo(value: CanonicalPayload): CanonicalPayload { return value; }
