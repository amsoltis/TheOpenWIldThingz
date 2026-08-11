/**
 * Executes `generated/seed.sql` against a real SQLite engine and asserts the
 * schema behaves.
 *
 *   npm run verify:sqlite --workspace=@streetlevel/data
 *
 * Run separately from the vitest suite because `node:sqlite` still needs
 * `--experimental-sqlite`. Worth having as its own step: the client's whole
 * offline story rests on this file loading cleanly on a phone, and a CHECK
 * constraint that quietly stopped being enforced would not show up anywhere
 * else until bad data was already on a device.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.resolve(here, '../../generated/seed.sql');

const failures: string[] = [];

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    process.stdout.write(`  ok    ${label}\n`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    process.stdout.write(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}\n`);
  }
}

/** True when the statement is rejected, which is what a CHECK constraint is for. */
function rejects(db: DatabaseSync, sql: string): boolean {
  try {
    db.exec(sql);
    return false;
  } catch {
    return true;
  }
}

function main(): void {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(SEED, 'utf8'));

  const count = (table: string): number =>
    (db.prepare(`SELECT count(*) AS c FROM ${table}`).get() as { c: number }).c;

  process.stdout.write(`Verifying ${SEED}\n`);

  check('stations loaded', count('mta_stations') > 400, `${count('mta_stations')} rows`);
  check('entrances loaded', count('station_entrances') > 0);
  check('platform connections loaded', count('platform_connections') > 0);
  check('exit alignments loaded', count('exit_car_alignments') > 0);

  const violations = db.prepare('PRAGMA foreign_key_check').all();
  check('no foreign key violations', violations.length === 0, `${violations.length} violations`);

  const indexes = (
    db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'").all() as {
      name: string;
    }[]
  ).map((r) => r.name);
  for (const required of ['idx_stations_coords', 'idx_entrances_station', 'idx_alignments_lookup']) {
    check(`index ${required} present`, indexes.includes(required));
  }

  check(
    'borough CHECK rejects an unknown borough',
    rejects(db, "INSERT INTO mta_stations VALUES ('zz','zz','Bad','ZZ','1',0,0)"),
  );
  check(
    'corner CHECK rejects an unknown corner',
    rejects(
      db,
      "INSERT INTO station_entrances VALUES ('zz','127','a','b','MIDDLE','STAIRS',1,'d',NULL,'FIELD_SURVEYED')",
    ),
  );
  check(
    'provenance CHECK rejects unlabelled survey data',
    rejects(db, "INSERT INTO station_entrances VALUES ('zz','127','a','b','MID','STAIRS',1,'d',NULL,'MADE_UP')"),
  );
  check(
    'entrance foreign key rejects an unknown station',
    rejects(
      db,
      "INSERT INTO station_entrances VALUES ('zz','no-such-station','a','b','MID','STAIRS',1,'d',NULL,'FIELD_SURVEYED')",
    ),
  );

  const timesSq = db
    .prepare('SELECT lines_served FROM mta_stations WHERE station_name = ? LIMIT 1')
    .get('Times Sq-42 St') as { lines_served: string } | undefined;
  check('a known station kept its lines', Boolean(timesSq?.lines_served), timesSq?.lines_served ?? 'missing');

  db.close();

  process.stdout.write(
    failures.length === 0
      ? '\nAll SQLite seed checks passed.\n'
      : `\n${failures.length} check(s) failed.\n`,
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main();
