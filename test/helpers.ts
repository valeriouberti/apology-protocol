import { readFileSync } from "node:fs";

/** Load a JSON fixture as `unknown` — exactly what validatePlan receives. */
export function loadFixture(name: string): unknown {
  const url = new URL(`./fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8"));
}

/** Load a JSON file from the top-level examples/ directory. */
export function loadExample(name: string): unknown {
  const url = new URL(`../examples/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8"));
}
