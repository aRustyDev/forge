import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_PATH = resolve(
  import.meta.dir,
  "../migrations/001_initial.sql",
);
const schema = readFileSync(MIGRATION_PATH, "utf-8");

function openDb(): Database {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(schema);
  return db;
}

/** Generate a valid 36-char UUID-shaped string for test inserts. */
function fakeId(): string {
  return crypto.randomUUID();
}

describe("001_initial migration", () => {
  let db: Database;

  beforeEach(() => {
    db = openDb();
  });

  afterEach(() => {
    db.close();
  });

  // ── Table existence ────────────────────────────────────────────────

  const expectedTables = [
    "employers",
    "projects",
    "sources",
    "prompt_logs",
    "bullets",
    "bullet_technologies",
    "perspectives",
    "skills",
    "bullet_skills",
    "perspective_skills",
    "resumes",
    "resume_perspectives",
    "_migrations",
  ];

  test("all tables exist", () => {
    const rows = db
      .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    const tableNames = rows.map((r) => r.name);
    for (const table of expectedTables) {
      expect(tableNames).toContain(table);
    }
  });

  // ── _migrations self-registration ──────────────────────────────────

  test("001_initial is recorded in _migrations", () => {
    const row = db
      .query("SELECT name FROM _migrations WHERE name = '001_initial'")
      .get() as { name: string } | null;
    expect(row).not.toBeNull();
    expect(row!.name).toBe("001_initial");
  });

  // ── STRICT mode on entity tables ──────────────────────────────────

  test("entity tables use STRICT mode", () => {
    // In STRICT tables inserting a non-TEXT value into a TEXT column errors.
    // _migrations is intentionally non-strict; skip it.
    const strictTables = expectedTables.filter((t) => t !== "_migrations");

    for (const table of strictTables) {
      const info = db.query(`PRAGMA table_list('${table}')`).all() as {
        strict: number;
      }[];
      expect(info.length).toBeGreaterThan(0);
      expect(info[0].strict).toBe(1);
    }
  });

  // ── FK enforcement: bullet with nonexistent source_id ─────────────

  test("FK constraint: bullet with nonexistent source_id is rejected", () => {
    expect(() => {
      db.exec(`
        INSERT INTO bullets (id, source_id, content, source_content_snapshot, status)
        VALUES ('${fakeId()}', '${fakeId()}', 'content', 'snapshot', 'draft')
      `);
    }).toThrow();
  });

  // ── FK enforcement: perspective with nonexistent bullet_id ────────

  test("FK constraint: perspective with nonexistent bullet_id is rejected", () => {
    expect(() => {
      db.exec(`
        INSERT INTO perspectives (id, bullet_id, content, bullet_content_snapshot, framing, status)
        VALUES ('${fakeId()}', '${fakeId()}', 'content', 'snapshot', 'accomplishment', 'draft')
      `);
    }).toThrow();
  });

  // ── CHECK constraint: source with invalid status ──────────────────

  test("CHECK constraint: source with invalid status is rejected", () => {
    expect(() => {
      db.exec(`
        INSERT INTO sources (id, title, description, status)
        VALUES ('${fakeId()}', 'title', 'desc', 'invalid_status')
      `);
    }).toThrow();
  });

  // ── CHECK constraint: bullet with invalid status ──────────────────

  test("CHECK constraint: bullet with invalid status is rejected", () => {
    // First create a valid source so FK passes — isolate the CHECK test.
    const srcId = fakeId();
    db.exec(`
      INSERT INTO sources (id, title, description)
      VALUES ('${srcId}', 'title', 'desc')
    `);

    expect(() => {
      db.exec(`
        INSERT INTO bullets (id, source_id, content, source_content_snapshot, status)
        VALUES ('${fakeId()}', '${srcId}', 'content', 'snapshot', 'bogus')
      `);
    }).toThrow();
  });

  // ── CHECK constraint: resume with invalid status ──────────────────

  test("CHECK constraint: resume with invalid status is rejected", () => {
    expect(() => {
      db.exec(`
        INSERT INTO resumes (id, name, target_role, target_employer, archetype, status)
        VALUES ('${fakeId()}', 'My Resume', 'SWE', 'Acme', 'infra', 'published')
      `);
    }).toThrow();
  });

  // ── CHECK constraint: perspective framing ─────────────────────────

  test("CHECK constraint: perspective with invalid framing is rejected", () => {
    // Need a valid chain: source -> bullet -> perspective
    const srcId = fakeId();
    const bulId = fakeId();
    db.exec(`INSERT INTO sources (id, title, description) VALUES ('${srcId}', 't', 'd')`);
    db.exec(`INSERT INTO bullets (id, source_id, content, source_content_snapshot) VALUES ('${bulId}', '${srcId}', 'c', 's')`);

    expect(() => {
      db.exec(`
        INSERT INTO perspectives (id, bullet_id, content, bullet_content_snapshot, framing)
        VALUES ('${fakeId()}', '${bulId}', 'content', 'snap', 'narrative')
      `);
    }).toThrow();
  });

  // ── CHECK constraint: prompt_logs entity_type ─────────────────────

  test("CHECK constraint: prompt_log with invalid entity_type is rejected", () => {
    expect(() => {
      db.exec(`
        INSERT INTO prompt_logs (id, entity_type, entity_id, prompt_template, prompt_input, raw_response)
        VALUES ('${fakeId()}', 'resume', '${fakeId()}', 'tpl', 'input', 'response')
      `);
    }).toThrow();
  });

  // ── CHECK constraint: resume_perspectives section ─────────────────

  test("CHECK constraint: resume_perspective with invalid section is rejected", () => {
    // Build the full chain
    const srcId = fakeId();
    const bulId = fakeId();
    const perId = fakeId();
    const resId = fakeId();
    db.exec(`INSERT INTO sources (id, title, description) VALUES ('${srcId}', 't', 'd')`);
    db.exec(`INSERT INTO bullets (id, source_id, content, source_content_snapshot) VALUES ('${bulId}', '${srcId}', 'c', 's')`);
    db.exec(`INSERT INTO perspectives (id, bullet_id, content, bullet_content_snapshot, framing) VALUES ('${perId}', '${bulId}', 'c', 's', 'accomplishment')`);
    db.exec(`INSERT INTO resumes (id, name, target_role, target_employer, archetype) VALUES ('${resId}', 'n', 'r', 'e', 'a')`);

    expect(() => {
      db.exec(`
        INSERT INTO resume_perspectives (resume_id, perspective_id, section, position)
        VALUES ('${resId}', '${perId}', 'hobbies', 1)
      `);
    }).toThrow();
  });

  // ── CHECK constraint: UUID length ─────────────────────────────────

  test("CHECK constraint: id with wrong length is rejected", () => {
    expect(() => {
      db.exec(`INSERT INTO employers (id, name) VALUES ('too-short', 'Acme')`);
    }).toThrow();
  });

  // ── ON DELETE RESTRICT: cannot delete source with bullets ─────────

  test("ON DELETE RESTRICT: cannot delete source that has bullets", () => {
    const srcId = fakeId();
    db.exec(`INSERT INTO sources (id, title, description) VALUES ('${srcId}', 't', 'd')`);
    db.exec(`INSERT INTO bullets (id, source_id, content, source_content_snapshot) VALUES ('${fakeId()}', '${srcId}', 'c', 's')`);

    expect(() => {
      db.exec(`DELETE FROM sources WHERE id = '${srcId}'`);
    }).toThrow();
  });

  // ── ON DELETE RESTRICT: cannot delete bullet with perspectives ────

  test("ON DELETE RESTRICT: cannot delete bullet that has perspectives", () => {
    const srcId = fakeId();
    const bulId = fakeId();
    db.exec(`INSERT INTO sources (id, title, description) VALUES ('${srcId}', 't', 'd')`);
    db.exec(`INSERT INTO bullets (id, source_id, content, source_content_snapshot) VALUES ('${bulId}', '${srcId}', 'c', 's')`);
    db.exec(`INSERT INTO perspectives (id, bullet_id, content, bullet_content_snapshot, framing) VALUES ('${fakeId()}', '${bulId}', 'c', 's', 'accomplishment')`);

    expect(() => {
      db.exec(`DELETE FROM bullets WHERE id = '${bulId}'`);
    }).toThrow();
  });

  // ── ON DELETE CASCADE: deleting bullet cascades to technologies ────

  test("ON DELETE CASCADE: deleting bullet cascades to bullet_technologies", () => {
    const srcId = fakeId();
    const bulId = fakeId();
    db.exec(`INSERT INTO sources (id, title, description) VALUES ('${srcId}', 't', 'd')`);
    db.exec(`INSERT INTO bullets (id, source_id, content, source_content_snapshot) VALUES ('${bulId}', '${srcId}', 'c', 's')`);
    db.exec(`INSERT INTO bullet_technologies (bullet_id, technology) VALUES ('${bulId}', 'Kubernetes')`);

    db.exec(`DELETE FROM bullets WHERE id = '${bulId}'`);

    const remaining = db.query("SELECT * FROM bullet_technologies WHERE bullet_id = ?").all(bulId);
    expect(remaining).toHaveLength(0);
  });

  // ── ON DELETE SET NULL: deleting employer nulls source.employer_id ─

  test("ON DELETE SET NULL: deleting employer nulls sources.employer_id", () => {
    const empId = fakeId();
    const srcId = fakeId();
    db.exec(`INSERT INTO employers (id, name) VALUES ('${empId}', 'Acme')`);
    db.exec(`INSERT INTO sources (id, title, description, employer_id) VALUES ('${srcId}', 't', 'd', '${empId}')`);

    db.exec(`DELETE FROM employers WHERE id = '${empId}'`);

    const row = db.query("SELECT employer_id FROM sources WHERE id = ?").get(srcId) as { employer_id: string | null };
    expect(row.employer_id).toBeNull();
  });

  // ── Indexes exist ─────────────────────────────────────────────────

  const expectedIndexes = [
    "idx_projects_employer",
    "idx_sources_status",
    "idx_sources_employer",
    "idx_sources_project",
    "idx_prompt_logs_entity",
    "idx_bullets_source",
    "idx_bullets_status",
    "idx_bullet_tech_technology",
    "idx_perspectives_bullet",
    "idx_perspectives_status",
    "idx_perspectives_archetype",
    "idx_perspectives_domain",
    "idx_resume_perspectives_resume",
  ];

  test("all indexes exist", () => {
    const rows = db
      .query("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'")
      .all() as { name: string }[];
    const indexNames = rows.map((r) => r.name);
    for (const idx of expectedIndexes) {
      expect(indexNames).toContain(idx);
    }
  });
});
