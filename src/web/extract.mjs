import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const ENTITIES = Object.freeze({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' });
function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1]?.toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      try { return Number.isFinite(code) ? String.fromCodePoint(code) : match; } catch { return match; }
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function attr(html, tagPattern, name) {
  const match = html.match(tagPattern);
  if (!match) return null;
  return match[0].match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1] ?? null;
}

export function extractHtml(html, sourceUrl) {
  const source = String(html ?? '');
  const title = decodeEntities(source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, ' ') ?? '').replace(/\s+/g, ' ').trim();
  const canonicalHref = attr(source, /<link\b[^>]*rel\s*=\s*["'][^"']*canonical[^"']*["'][^>]*>/i, 'href');
  let canonicalUrl = sourceUrl;
  if (canonicalHref) { try { canonicalUrl = new URL(canonicalHref, sourceUrl).toString(); } catch {} }
  let body = source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg|canvas|iframe|form)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ');
  const main = body.match(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2];
  if (main) body = main;
  body = body
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|section|article|main|h[1-6]|li|pre|blockquote|tr)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' ');
  const text = decodeEntities(body)
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return Object.freeze({ title, text, canonicalUrl, contentSha256: canonicalSha256(text), warnings: Object.freeze(text ? [] : ['empty-extraction']) });
}
