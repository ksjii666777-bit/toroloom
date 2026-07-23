#!/usr/bin/env ts-node
/**
 * ============================================================================
 * Toroloom — Migration CLI
 * ============================================================================
 *
 * Usage:
 *   npx ts-node src/scripts/run-migration.ts up       # Apply pending migrations
 *   npx ts-node src/scripts/run-migration.ts status   # Show migration status
 *
 * Environment:
 *   DATABASE_URL  — PostgreSQL connection string (required)
 *
 * ============================================================================
 */

import path from 'path';
import fs from 'fs';

// Load .env from backend root (manual parse — avoids dotenv dependency)
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes if present
    const clean = value.replace(/^["']|["']$/g, '');
    if (!process.env[key]) {
      process.env[key] = clean;
    }
  }
}

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

async function main() {
  const command = process.argv[2]?.toLowerCase();

  if (!command || (command !== 'up' && command !== 'status')) {
    console.log(`
Toroloom Migration CLI

Usage:
  npx ts-node src/scripts/run-migration.ts up        Apply pending migrations
  npx ts-node src/scripts/run-migration.ts status    Show migration status

Environment:
  DATABASE_URL  — PostgreSQL connection string (required)
`);
    process.exit(command ? 1 : 0);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL is not set. Create a backend/.env file or set the environment variable.');
    process.exit(1);
  }

  // Dynamic import — uses the same `pg` package from the project
  const { Pool } = await import('pg');
  const { runMigrations, getMigrationStatus } = await import('../services/migrationRunner');

  const pool = new Pool({ connectionString });

  try {
    if (command === 'up') {
      console.log('📦 Toroloom Migration — Up');
      console.log(`   Migrations directory: ${MIGRATIONS_DIR}`);
      console.log('');

      const result = await runMigrations(pool, {
        dir: MIGRATIONS_DIR,
      });

      console.log('');
      console.log(`   ✅ Applied: ${result.applied}`);
      console.log(`   ⏭ Skipped: ${result.skipped}`);
      console.log(`   📋 Total records: ${result.records.length}`);
    } else if (command === 'status') {
      console.log('📦 Toroloom Migration — Status');
      console.log(`   Migrations directory: ${MIGRATIONS_DIR}`);
      console.log('');

      const status = await getMigrationStatus(pool, {
        dir: MIGRATIONS_DIR,
      });

      console.log(`   ✅ Applied: ${status.applied.length} migration(s)`);
      if (status.applied.length > 0) {
        console.log('');
        for (const m of status.applied) {
          console.log(`     ✔ ${m.version} — ${m.name}  (${new Date(m.appliedAt).toISOString()})`);
        }
      }

      console.log('');
      console.log(`   ⏳ Pending: ${status.pending.length} migration(s)`);
      if (status.pending.length > 0) {
        console.log('');
        for (const m of status.pending) {
          console.log(`     · ${m.version}_${m.description.replace(/ /g, '_')}.sql`);
        }
      }
    }
  } catch (err: any) {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
