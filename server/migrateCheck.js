// server/migrateCheck.js
// Dry-run for the Phase 1 classroom-1 migration (npm run migrate:check).
// Prints exactly what the migration WOULD do — which tile positions become
// classroom config, and which live differences are stale content that the
// stock refresh will replace. Writes nothing.
//
// Compares the live working copy (DATA_DIR volume) against the stock deck
// (dist build, falling back to public/ in a dev checkout).

import fs from 'fs';
import path from 'path';
import { computeMigrationPlan, formatMigrationPlan, defaultMigrationPaths } from './migrateInstance.js';

const dataDir = process.env.DATA_DIR || './server/data';
const distPath = process.env.DIST_PATH || path.join(process.cwd(), 'dist');

const { liveSpacesPath, stockSpacesPath, liveGameConfigPath, stockGameConfigPath } =
  defaultMigrationPaths({ dataDir, distPath });

console.log('migrate:check — classroom-1 migration dry run');
console.log(`  live working copy: ${liveSpacesPath}`);
console.log(`  stock deck:        ${stockSpacesPath}`);
console.log(`  live positions:    ${liveGameConfigPath}`);
console.log(`  stock positions:   ${stockGameConfigPath}`);
console.log('');

if (!fs.existsSync(stockSpacesPath)) {
  console.error('No stock Spaces.csv found — run a build first or set DIST_PATH.');
  process.exit(1);
}

if (!fs.existsSync(liveSpacesPath)) {
  console.log('No live working copy found — nothing to migrate (first boot will copy stock as-is).');
  process.exit(0);
}

const hasGameConfig = fs.existsSync(liveGameConfigPath) && fs.existsSync(stockGameConfigPath);
const plan = computeMigrationPlan({
  liveSpacesCsv: fs.readFileSync(liveSpacesPath, 'utf-8'),
  stockSpacesCsv: fs.readFileSync(stockSpacesPath, 'utf-8'),
  liveGameConfigCsv: hasGameConfig ? fs.readFileSync(liveGameConfigPath, 'utf-8') : undefined,
  stockGameConfigCsv: hasGameConfig ? fs.readFileSync(stockGameConfigPath, 'utf-8') : undefined,
});

console.log(formatMigrationPlan(plan));
console.log('');
console.log('Dry run only — nothing was written. The real migration runs once at server boot.');
