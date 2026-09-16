#!/usr/bin/env node
/**
 * Regenerates `src/domain/workouts/exerciseCatalog.json` and `exerciseInstructions.json`
 * from the FreeExerciseDB corpus the native apps bundle
 * (`ios/calorietracker/Resources/FreeExerciseDB/dist/exercises.json`) and the workout-vector
 * manifest (`shared/workout-vectors/exercise-visual-manifest.json`).
 *
 * The catalog is a compact tuple array (metadata plus the per-frame content digests, ~250 KB)
 * so the library list stays light; instructions live in a second file that the detail view
 * requires lazily. Frames themselves are never bundled — like the native store builds they
 * load from the CDN (`https://assets.fud-ai.app/workout-vectors/v2/<frame>.png?v=<digest>`),
 * the digest doubling as the cache key so a replaced frame is never served stale.
 *
 *   node scripts/build-exercise-catalog.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const source = resolve(repo, 'ios/calorietracker/Resources/FreeExerciseDB/dist/exercises.json');
const manifestPath = resolve(repo, 'shared/workout-vectors/exercise-visual-manifest.json');
const outDir = resolve(here, '..', 'src/domain/workouts');

const records = JSON.parse(readFileSync(source, 'utf8'));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')).exercises;
const frames = new Map(manifest.map((m) => [m.exerciseId, m]));

/** Comma-joined digests, one per frame index; '' where the manifest has none (`validDigests` on iOS). */
function digestList(visual, key) {
  const digests = visual?.[key];
  if (!Array.isArray(digests) || digests.length !== visual.frameCount) return '';
  return digests.map((d) => String(d ?? '')).join(',');
}

const catalog = [];
const instructions = {};
for (const record of records) {
  const id = String(record.id ?? '').trim();
  const name = String(record.name ?? '').trim();
  if (!id || !name) continue;
  const visual = frames.get(id);
  catalog.push([
    id,
    name,
    record.level ?? '',
    record.force ?? '',
    record.mechanic ?? '',
    record.equipment ?? '',
    record.category ?? '',
    record.primaryMuscles ?? [],
    record.secondaryMuscles ?? [],
    visual ? visual.frameCount : 0,
    visual ? visual.representativeFrameIndex : 0,
    digestList(visual, 'maleFrameDigests'),
    digestList(visual, 'femaleFrameDigests'),
  ]);
  const steps = (record.instructions ?? []).map((s) => String(s).trim()).filter(Boolean);
  if (steps.length > 0) instructions[id] = steps;
}
catalog.sort((a, b) => a[1].localeCompare(b[1], 'en', { sensitivity: 'base' }));

writeFileSync(resolve(outDir, 'exerciseCatalog.json'), JSON.stringify(catalog));
writeFileSync(resolve(outDir, 'exerciseInstructions.json'), JSON.stringify(instructions));
console.log(`Wrote ${catalog.length} exercises (${Object.keys(instructions).length} with instructions).`);
