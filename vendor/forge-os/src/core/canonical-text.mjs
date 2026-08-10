export function canonicalTextContent(value) {
  return String(value).replace(/\r\n?/g, '\n');
}
