// Validate data/muscles.json and data/exercises.json.
// Run: node muscle-map/scripts/validate-data.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const muscles = JSON.parse(readFileSync(join(root, 'data/muscles.json'), 'utf8')).muscles;
const exercises = JSON.parse(readFileSync(join(root, 'data/exercises.json'), 'utf8')).exercises;

const errors = [];
const muscleIds = new Set();
for (const m of muscles) {
  if (muscleIds.has(m.id)) errors.push(`duplicate muscle id: ${m.id}`);
  muscleIds.add(m.id);
  if (!['front', 'back', 'both'].includes(m.view)) errors.push(`bad view on ${m.id}`);
}

const exerciseIds = new Set();
for (const e of exercises) {
  if (exerciseIds.has(e.id)) errors.push(`duplicate exercise id: ${e.id}`);
  exerciseIds.add(e.id);
  if (!['compound', 'isolation'].includes(e.category)) errors.push(`bad category on ${e.id}`);
  if (e.primary_muscles.length === 0) errors.push(`${e.id} has no primary muscles`);
  for (const id of [...e.primary_muscles, ...e.secondary_muscles]) {
    if (!muscleIds.has(id)) errors.push(`${e.id} references unknown muscle: ${id}`);
  }
  for (const id of e.primary_muscles) {
    if (e.secondary_muscles.includes(id)) errors.push(`${e.id} lists ${id} as primary and secondary`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`OK: ${muscles.length} muscles, ${exercises.length} exercises`);
