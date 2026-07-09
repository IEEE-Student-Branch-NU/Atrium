/**
 * Make a raw search box term safe to interpolate into a PostgREST `.or(...ilike...)`
 * filter as a literal substring: strip the `.or()` structural chars and PostgREST's
 * `*` (an alias for `%`), then backslash-escape ILIKE wildcards so `%` and `_` match
 * literally (Postgres LIKE/ILIKE default escape char is `\`).
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw
    .trim()
    .replace(/[,()*]/g, '')      // strip PostgREST .or() structural chars + '*' wildcard alias
    .replace(/[\\%_]/g, '\\$&')  // escape ILIKE wildcards -> literal match
}
