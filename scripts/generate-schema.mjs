// Regenerates schema/plan.schema.json from the Zod source of truth.
// Run via `npm run schema` (builds dist first).
import { mkdirSync, writeFileSync } from "node:fs";
import { planJsonSchema } from "../dist/json-schema.js";

const url = new URL("../schema/plan.schema.json", import.meta.url);
mkdirSync(new URL("../schema/", import.meta.url), { recursive: true });
writeFileSync(url, JSON.stringify(planJsonSchema(), null, 2) + "\n");
console.log("wrote schema/plan.schema.json");
