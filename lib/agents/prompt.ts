// Prompt template rendering.
//
// Agent prompts live as markdown in lib/prompts/<name>.md with `{{var}}`
// substitutions for the context block the runtime injects (case, pet,
// country_rules, etc.). `renderPrompt` performs the substitution; values
// that are objects/arrays are JSON-stringified so the model sees structure.

export type PromptContext = Record<string, unknown>;

const TOKEN_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/**
 * Render a markdown prompt template by substituting `{{var}}` tokens.
 *
 * - Strings are inserted verbatim.
 * - `null` and `undefined` become the literal string `"null"` so the model
 *   sees an unambiguous absence rather than a stray brace.
 * - Anything else is `JSON.stringify`d with 2-space indent for readability.
 * - Unknown tokens raise — silent fallthrough hides bugs that only surface
 *   when an agent invents a citation from a missing context slot.
 */
export function renderPrompt(template: string, context: PromptContext): string {
  return template.replace(TOKEN_RE, (_match, key: string) => {
    if (!(key in context)) {
      throw new Error(`renderPrompt: missing context key "${key}"`);
    }
    return formatValue(context[key]);
  });
}

function formatValue(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

/**
 * Return the set of `{{var}}` tokens referenced by a template.
 * Useful at startup to verify a prompt and a context shape line up.
 */
export function extractPromptTokens(template: string): Set<string> {
  const tokens = new Set<string>();
  for (const match of template.matchAll(TOKEN_RE)) {
    tokens.add(match[1]);
  }
  return tokens;
}
