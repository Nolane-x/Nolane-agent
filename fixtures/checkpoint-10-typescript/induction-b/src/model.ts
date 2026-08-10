// CanonicalPayload remains in comments for induction-b
export const label = 'CanonicalPayload remains in strings';
export const metadata = { CanonicalPayload: 'property-key' };
export interface CanonicalPayload { value: string; repository: 'induction-b' }
export function echo(value: CanonicalPayload): CanonicalPayload { return value; }
