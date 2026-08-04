export function canonicalName(value) {
  return value + 1;
}

export const stableValue = 7;
const metadata = { canonicalName: 'property-key', stableValue };
export function inspectMetadata() {
  return metadata.canonicalName;
}
// canonicalName remains in comments
export const label = 'canonicalName remains in strings';
