/**
 * Simple template interpolation for modal config text.
 * Replaces {token} placeholders with values from the context object.
 * Unknown tokens are left as-is.
 *
 * Available tokens: {count}, {cardType}, {amount}, {spaceName}, {playerName}
 *
 * Example: "You receive {count} {cardType} cards" → "You receive 3 W cards"
 */
export function interpolateTemplate(template: string, context: Record<string, string | number | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = context[key];
    return value !== undefined ? String(value) : match;
  });
}
