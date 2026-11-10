export type CommentInput = string | Record<string, string>;

/** A SPARQL comment must stay on one line, including with non-ASCII separators. */
export function encodeComment(input: CommentInput): string {
  if (typeof input === 'string') return input.replace(/[\r\n\v\f\u0085\u2028\u2029]/g, ' ');
  const encode = (value: string) => encodeURIComponent(value).replace(/'/g, '%27');
  return Object.entries(input)
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${encode(key)}='${encode(value)}'`)
    .sort()
    .join(',');
}
