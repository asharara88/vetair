// Versioned prompt loader. Prompts live in lib/prompts/<name>.md so diffs
// show up clearly in git review. Loaded eagerly at module init, then templated
// with {{variable}} interpolation per call.
//
// Restricted to the Node runtime — fs/path don't exist on the edge runtime.
// All agents are dispatched from Node API routes; if you ever need to call
// one from an edge route, embed the prompt inline instead.

import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROMPTS_DIR = join(process.cwd(), "lib", "prompts");
const cache = new Map<string, string>();

export function loadPrompt(name: string): string {
  const cached = cache.get(name);
  if (cached) return cached;
  const text = readFileSync(join(PROMPTS_DIR, `${name}.md`), "utf-8");
  cache.set(name, text);
  return text;
}

export function renderPrompt(name: string, vars: Record<string, string | number | null | undefined>): string {
  let text = loadPrompt(name);
  for (const [key, value] of Object.entries(vars)) {
    text = text.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), value == null ? "" : String(value));
  }
  return text;
}
