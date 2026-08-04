// CanonicalPayload remains in comments for induction-a
export const label = 'CanonicalPayload remains in strings';
export const metadata = { CanonicalPayload: 'property-key' };
export interface CanonicalPayload { value: string; repository: 'induction-a' }
export function echo(value: CanonicalPayload): CanonicalPayload { return value; }
