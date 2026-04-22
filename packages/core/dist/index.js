// @bun
var __require = import.meta.require;

// src/index.ts
import { resolve, dirname } from "path";
import { mkdirSync } from "fs";

// src/db/connection.ts
import { Database } from "bun:sqlite";
function getDatabase(dbPath) {
  const db = new Database(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}

// src/db/migrate.ts
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
function migrationsTableExists(db) {
  const row = db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_migrations'").get();
  return row !== null;
}
function getAppliedMigrations(db) {
  if (!migrationsTableExists(db)) {
    return new Set;
  }
  const rows = db.query("SELECT name FROM _migrations").all();
  return new Set(rows.map((r) => r.name));
}
function migrationName(filename) {
  return filename.replace(/\.sql$/, "");
}
function runMigrations(db, migrationsDir) {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  const applied = getAppliedMigrations(db);
  const pending = files.filter((f) => !applied.has(migrationName(f)));
  if (pending.length === 0) {
    console.log("All migrations up to date");
    return;
  }
  for (const file of pending) {
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    const name = migrationName(file);
    try {
      db.exec("BEGIN");
      db.exec(sql);
      db.run("INSERT OR IGNORE INTO _migrations (name) VALUES (?)", [name]);
      db.exec("COMMIT");
      console.log(`Applied migration: ${file}`);
    } catch (err) {
      try {
        db.exec("ROLLBACK");
      } catch {}
      console.error(`Migration failed: ${file}`);
      throw err;
    }
  }
}

// src/db/repositories/source-repository.ts
function getExtension(db, sourceId, sourceType) {
  switch (sourceType) {
    case "role":
      return db.query("SELECT * FROM source_roles WHERE source_id = ?").get(sourceId);
    case "project":
      return db.query("SELECT * FROM source_projects WHERE source_id = ?").get(sourceId);
    case "education":
      return db.query("SELECT * FROM source_education WHERE source_id = ?").get(sourceId);
    case "clearance":
      return db.query("SELECT * FROM source_clearances WHERE source_id = ?").get(sourceId);
    default:
      return null;
  }
}
function updateExtension(db, sourceId, sourceType, input) {
  if (sourceType === "role") {
    const sets = [];
    const params = [];
    if ("organization_id" in input) {
      sets.push("organization_id = ?");
      params.push(input.organization_id ?? null);
    }
    if ("is_current" in input) {
      sets.push("is_current = ?");
      params.push(input.is_current ?? 0);
    }
    if ("work_arrangement" in input) {
      sets.push("work_arrangement = ?");
      params.push(input.work_arrangement ?? null);
    }
    if ("base_salary" in input) {
      sets.push("base_salary = ?");
      params.push(input.base_salary ?? null);
    }
    if ("total_comp_notes" in input) {
      sets.push("total_comp_notes = ?");
      params.push(input.total_comp_notes ?? null);
    }
    if ("start_date" in input) {
      sets.push("start_date = ?");
      params.push(input.start_date ?? null);
    }
    if ("end_date" in input) {
      sets.push("end_date = ?");
      params.push(input.end_date ?? null);
    }
    if (sets.length > 0) {
      params.push(sourceId);
      db.run(`UPDATE source_roles SET ${sets.join(", ")} WHERE source_id = ?`, params);
    }
  } else if (sourceType === "project") {
    const sets = [];
    const params = [];
    if ("organization_id" in input) {
      sets.push("organization_id = ?");
      params.push(input.organization_id ?? null);
    }
    if ("is_personal" in input) {
      sets.push("is_personal = ?");
      params.push(input.is_personal ?? 0);
    }
    if ("url" in input) {
      sets.push("url = ?");
      params.push(input.url ?? null);
    }
    if ("start_date" in input) {
      sets.push("start_date = ?");
      params.push(input.start_date ?? null);
    }
    if ("end_date" in input) {
      sets.push("end_date = ?");
      params.push(input.end_date ?? null);
    }
    if (sets.length > 0) {
      params.push(sourceId);
      db.run(`UPDATE source_projects SET ${sets.join(", ")} WHERE source_id = ?`, params);
    }
  } else if (sourceType === "education") {
    const sets = [];
    const params = [];
    if ("education_type" in input) {
      sets.push("education_type = ?");
      params.push(input.education_type);
    }
    if ("institution" in input) {
      sets.push("institution = ?");
      params.push(input.institution ?? null);
    }
    if ("field" in input) {
      sets.push("field = ?");
      params.push(input.field ?? null);
    }
    if ("is_in_progress" in input) {
      sets.push("is_in_progress = ?");
      params.push(input.is_in_progress ?? 0);
    }
    if ("credential_id" in input) {
      sets.push("credential_id = ?");
      params.push(input.credential_id ?? null);
    }
    if ("expiration_date" in input) {
      sets.push("expiration_date = ?");
      params.push(input.expiration_date ?? null);
    }
    if ("issuing_body" in input) {
      sets.push("issuing_body = ?");
      params.push(input.issuing_body ?? null);
    }
    if ("url" in input) {
      sets.push("url = ?");
      params.push(input.url ?? null);
    }
    if ("start_date" in input) {
      sets.push("start_date = ?");
      params.push(input.start_date ?? null);
    }
    if ("end_date" in input) {
      sets.push("end_date = ?");
      params.push(input.end_date ?? null);
    }
    if (sets.length > 0) {
      params.push(sourceId);
      db.run(`UPDATE source_education SET ${sets.join(", ")} WHERE source_id = ?`, params);
    }
  } else if (sourceType === "clearance") {
    const sets = [];
    const params = [];
    if ("level" in input) {
      sets.push("level = ?");
      params.push(input.level);
    }
    if ("polygraph" in input) {
      sets.push("polygraph = ?");
      params.push(input.polygraph ?? null);
    }
    if ("clearance_status" in input) {
      sets.push("status = ?");
      params.push(input.clearance_status ?? null);
    }
    if ("sponsoring_agency" in input) {
      sets.push("sponsoring_agency = ?");
      params.push(input.sponsoring_agency ?? null);
    }
    if (sets.length > 0) {
      params.push(sourceId);
      db.run(`UPDATE source_clearances SET ${sets.join(", ")} WHERE source_id = ?`, params);
    }
  }
}
function create(db, input) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const sourceType = input.source_type ?? "general";
  const txn = db.transaction(() => {
    db.run(`INSERT INTO sources (id, title, description, source_type, start_date, end_date, status, updated_by, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', 'human', ?, ?, ?)`, [
      id,
      input.title,
      input.description,
      sourceType,
      input.start_date ?? null,
      input.end_date ?? null,
      input.notes ?? null,
      now,
      now
    ]);
    if (sourceType === "role") {
      db.run(`INSERT INTO source_roles (source_id, organization_id, start_date, end_date, is_current, work_arrangement, base_salary, total_comp_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
        id,
        input.organization_id ?? null,
        input.start_date ?? null,
        input.end_date ?? null,
        input.is_current ?? 0,
        input.work_arrangement ?? null,
        input.base_salary ?? null,
        input.total_comp_notes ?? null
      ]);
    } else if (sourceType === "project") {
      db.run(`INSERT INTO source_projects (source_id, organization_id, is_personal, url, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?)`, [
        id,
        input.organization_id ?? null,
        input.is_personal ?? 0,
        input.url ?? null,
        input.start_date ?? null,
        input.end_date ?? null
      ]);
    } else if (sourceType === "education") {
      db.run(`INSERT INTO source_education (source_id, education_type, institution, field, start_date, end_date, is_in_progress, credential_id, expiration_date, issuing_body, url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        id,
        input.education_type ?? "certificate",
        input.institution ?? null,
        input.field ?? null,
        input.start_date ?? null,
        input.end_date ?? null,
        input.is_in_progress ?? 0,
        input.credential_id ?? null,
        input.expiration_date ?? null,
        input.issuing_body ?? null,
        input.url ?? null
      ]);
    } else if (sourceType === "clearance") {
      db.run(`INSERT INTO source_clearances (source_id, level, polygraph, status, sponsoring_agency, investigation_date, adjudication_date, reinvestigation_date, read_on)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        id,
        input.level ?? "",
        input.polygraph ?? null,
        input.clearance_status ?? null,
        input.sponsoring_agency ?? null,
        null,
        null,
        null,
        null
      ]);
    }
  });
  txn();
  return get(db, id);
}
function get(db, id) {
  const source = db.query("SELECT * FROM sources WHERE id = ?").get(id);
  if (!source)
    return null;
  const extension = getExtension(db, source.id, source.source_type);
  return { ...source, extension };
}
function list(db, filter, offset, limit) {
  const conditions = [];
  const params = [];
  let joinClause = "";
  if (filter.source_type !== undefined) {
    conditions.push("s.source_type = ?");
    params.push(filter.source_type);
  }
  if (filter.status !== undefined) {
    conditions.push("s.status = ?");
    params.push(filter.status);
  }
  if (filter.organization_id !== undefined) {
    joinClause = `LEFT JOIN source_roles sr ON s.id = sr.source_id
                  LEFT JOIN source_projects sp ON s.id = sp.source_id`;
    conditions.push("(sr.organization_id = ? OR sp.organization_id = ?)");
    params.push(filter.organization_id, filter.organization_id);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const countRow = db.query(`SELECT COUNT(DISTINCT s.id) AS total FROM sources s ${joinClause} ${where}`).get(...params);
  const dataParams = [...params, limit, offset];
  const data = db.query(`SELECT DISTINCT s.* FROM sources s ${joinClause} ${where} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`).all(...dataParams);
  return { data, total: countRow.total };
}
function update(db, id, input) {
  const existing = get(db, id);
  if (!existing)
    return null;
  const sets = [];
  const params = [];
  if (input.title !== undefined) {
    sets.push("title = ?");
    params.push(input.title);
  }
  if (input.description !== undefined) {
    sets.push("description = ?");
    params.push(input.description);
  }
  if ("start_date" in input) {
    sets.push("start_date = ?");
    params.push(input.start_date ?? null);
  }
  if ("end_date" in input) {
    sets.push("end_date = ?");
    params.push(input.end_date ?? null);
  }
  if ("notes" in input) {
    sets.push("notes = ?");
    params.push(input.notes ?? null);
  }
  const now = new Date().toISOString();
  sets.push("updated_at = ?");
  params.push(now);
  params.push(id);
  db.run(`UPDATE sources SET ${sets.join(", ")} WHERE id = ?`, params);
  updateExtension(db, id, existing.source_type, input);
  return get(db, id);
}
function del(db, id) {
  const existing = get(db, id);
  if (!existing)
    return false;
  db.run("DELETE FROM sources WHERE id = ?", [id]);
  return true;
}
function acquireDerivingLock(db, id) {
  const row = db.query(`UPDATE sources SET status = 'deriving', updated_at = ?
       WHERE id = ? AND status != 'deriving'
       RETURNING *`).get(new Date().toISOString(), id);
  return row ?? null;
}
function releaseDerivingLock(db, id, restoreStatus, derived) {
  const now = new Date().toISOString();
  if (derived) {
    db.run(`UPDATE sources SET status = ?, last_derived_at = ?, updated_at = ? WHERE id = ?`, [restoreStatus, now, now, id]);
  } else {
    db.run(`UPDATE sources SET status = ?, updated_at = ? WHERE id = ?`, [restoreStatus, now, id]);
  }
}

// src/services/source-service.ts
class SourceService {
  db;
  constructor(db) {
    this.db = db;
  }
  createSource(input) {
    if (!input.title || input.title.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Title must not be empty" } };
    }
    if (!input.description || input.description.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Description must not be empty" } };
    }
    const source = create(this.db, input);
    return { ok: true, data: source };
  }
  getSource(id) {
    const source = get(this.db, id);
    if (!source) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Source ${id} not found` } };
    }
    return { ok: true, data: source };
  }
  listSources(filter = {}, offset = 0, limit = 50) {
    const result = list(this.db, filter, offset, limit);
    return {
      ok: true,
      data: result.data,
      pagination: { total: result.total, offset, limit }
    };
  }
  updateSource(id, input) {
    if (input.title !== undefined && input.title.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Title must not be empty" } };
    }
    if (input.description !== undefined && input.description.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Description must not be empty" } };
    }
    const source = update(this.db, id, input);
    if (!source) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Source ${id} not found` } };
    }
    return { ok: true, data: source };
  }
  deleteSource(id) {
    try {
      const deleted = del(this.db, id);
      if (!deleted) {
        return { ok: false, error: { code: "NOT_FOUND", message: `Source ${id} not found` } };
      }
      return { ok: true, data: undefined };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("FOREIGN KEY constraint")) {
        return { ok: false, error: { code: "CONFLICT", message: "Cannot delete source with existing bullets" } };
      }
      throw err;
    }
  }
}

// src/db/repositories/bullet-repository.ts
function rowToBullet(row, technologies) {
  return {
    id: row.id,
    content: row.content,
    source_content_snapshot: row.source_content_snapshot,
    metrics: row.metrics,
    domain: row.domain,
    status: row.status,
    rejection_reason: row.rejection_reason,
    prompt_log_id: row.prompt_log_id,
    approved_at: row.approved_at,
    approved_by: row.approved_by,
    notes: row.notes,
    created_at: row.created_at,
    technologies
  };
}
function getTechnologies(db, bulletId) {
  const rows = db.query("SELECT technology FROM bullet_technologies WHERE bullet_id = ? ORDER BY technology").all(bulletId);
  return rows.map((r) => r.technology);
}
function insertTechnologies(db, bulletId, technologies) {
  const stmt = db.prepare("INSERT OR IGNORE INTO bullet_technologies (bullet_id, technology) VALUES (?, ?)");
  for (const tech of technologies) {
    const normalized = tech.toLowerCase().trim();
    if (normalized.length > 0) {
      stmt.run(bulletId, normalized);
    }
  }
}
var BulletRepository = {
  create(db, input) {
    const id = crypto.randomUUID();
    const status = input.status ?? "pending_review";
    const row = db.query(`INSERT INTO bullets (id, content, source_content_snapshot, metrics, domain, status, prompt_log_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         RETURNING *`).get(id, input.content, input.source_content_snapshot, input.metrics, input.domain ?? null, status, input.prompt_log_id ?? null);
    if (input.source_ids) {
      for (const src of input.source_ids) {
        db.run("INSERT INTO bullet_sources (bullet_id, source_id, is_primary) VALUES (?, ?, ?)", [id, src.id, src.is_primary !== false ? 1 : 0]);
      }
    }
    insertTechnologies(db, id, input.technologies);
    const technologies = getTechnologies(db, id);
    return rowToBullet(row, technologies);
  },
  get(db, id) {
    const row = db.query("SELECT * FROM bullets WHERE id = ?").get(id);
    if (!row)
      return null;
    const technologies = getTechnologies(db, id);
    return rowToBullet(row, technologies);
  },
  list(db, filter = {}, offset = 0, limit = 50) {
    const conditions = [];
    const params = [];
    const joins = [];
    if (filter.source_id) {
      joins.push("JOIN bullet_sources bs ON bs.bullet_id = b.id");
      conditions.push("bs.source_id = ?");
      params.push(filter.source_id);
    }
    if (filter.status) {
      conditions.push("b.status = ?");
      params.push(filter.status);
    }
    if (filter.technology) {
      joins.push("JOIN bullet_technologies bt ON bt.bullet_id = b.id");
      conditions.push("bt.technology = ?");
      params.push(filter.technology.toLowerCase().trim());
    }
    if (filter.domain) {
      conditions.push("b.domain = ?");
      params.push(filter.domain);
    }
    const joinClause = joins.join(" ");
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRow = db.query(`SELECT COUNT(DISTINCT b.id) as total FROM bullets b ${joinClause} ${whereClause}`).get(...params);
    const total = countRow.total;
    const rows = db.query(`SELECT DISTINCT b.* FROM bullets b ${joinClause} ${whereClause}
         ORDER BY b.created_at DESC
         LIMIT ? OFFSET ?`).all(...params, limit, offset);
    const data = rows.map((row) => {
      const technologies = getTechnologies(db, row.id);
      return rowToBullet(row, technologies);
    });
    return { data, total };
  },
  update(db, id, input) {
    const sets = [];
    const params = [];
    if (input.content !== undefined) {
      sets.push("content = ?");
      params.push(input.content);
    }
    if (input.metrics !== undefined) {
      sets.push("metrics = ?");
      params.push(input.metrics);
    }
    if (sets.length === 0) {
      return BulletRepository.get(db, id);
    }
    params.push(id);
    const row = db.query(`UPDATE bullets SET ${sets.join(", ")} WHERE id = ? RETURNING *`).get(...params);
    if (!row)
      return null;
    const technologies = getTechnologies(db, id);
    return rowToBullet(row, technologies);
  },
  delete(db, id) {
    const result = db.run("DELETE FROM bullets WHERE id = ?", [id]);
    return result.changes > 0;
  },
  updateStatus(db, id, status, opts) {
    let row;
    if (status === "approved") {
      row = db.query(`UPDATE bullets
           SET status = ?, approved_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), approved_by = 'human'
           WHERE id = ?
           RETURNING *`).get(status, id);
    } else if (status === "rejected") {
      row = db.query(`UPDATE bullets
           SET status = ?, rejection_reason = ?
           WHERE id = ?
           RETURNING *`).get(status, opts?.rejection_reason ?? null, id);
    } else {
      row = db.query(`UPDATE bullets SET status = ? WHERE id = ? RETURNING *`).get(status, id);
    }
    if (!row)
      return null;
    const technologies = getTechnologies(db, id);
    return rowToBullet(row, technologies);
  },
  getSources(db, bulletId) {
    return db.query(`SELECT s.id, s.title, bs.is_primary
         FROM bullet_sources bs
         JOIN sources s ON bs.source_id = s.id
         WHERE bs.bullet_id = ?
         ORDER BY bs.is_primary DESC, s.title ASC`).all(bulletId);
  },
  getPrimarySource(db, bulletId) {
    return db.query(`SELECT s.id, s.title
         FROM bullet_sources bs
         JOIN sources s ON bs.source_id = s.id
         WHERE bs.bullet_id = ? AND bs.is_primary = 1`).get(bulletId);
  },
  addSource(db, bulletId, sourceId, isPrimary = false) {
    if (isPrimary) {
      db.run("UPDATE bullet_sources SET is_primary = 0 WHERE bullet_id = ? AND is_primary = 1", [bulletId]);
    }
    db.run("INSERT INTO bullet_sources (bullet_id, source_id, is_primary) VALUES (?, ?, ?)", [bulletId, sourceId, isPrimary ? 1 : 0]);
  },
  removeSource(db, bulletId, sourceId) {
    const result = db.run("DELETE FROM bullet_sources WHERE bullet_id = ? AND source_id = ?", [bulletId, sourceId]);
    return result.changes > 0;
  }
};

// src/services/bullet-service.ts
var VALID_TRANSITIONS = {
  draft: ["pending_review"],
  pending_review: ["approved", "rejected"],
  rejected: ["pending_review"],
  approved: []
};

class BulletService {
  db;
  constructor(db) {
    this.db = db;
  }
  getBullet(id) {
    const bullet = BulletRepository.get(this.db, id);
    if (!bullet) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Bullet ${id} not found` } };
    }
    return { ok: true, data: bullet };
  }
  listBullets(filter = {}, offset = 0, limit = 50) {
    const result = BulletRepository.list(this.db, filter, offset, limit);
    return {
      ok: true,
      data: result.data,
      pagination: { total: result.total, offset, limit }
    };
  }
  updateBullet(id, input) {
    if (input.content !== undefined && input.content.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Content must not be empty" } };
    }
    const bullet = BulletRepository.update(this.db, id, input);
    if (!bullet) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Bullet ${id} not found` } };
    }
    return { ok: true, data: bullet };
  }
  deleteBullet(id) {
    try {
      const deleted = BulletRepository.delete(this.db, id);
      if (!deleted) {
        return { ok: false, error: { code: "NOT_FOUND", message: `Bullet ${id} not found` } };
      }
      return { ok: true, data: undefined };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("FOREIGN KEY constraint")) {
        return { ok: false, error: { code: "CONFLICT", message: "Cannot delete bullet with existing perspectives" } };
      }
      throw err;
    }
  }
  approveBullet(id) {
    return this.transition(id, "approved");
  }
  rejectBullet(id, reason) {
    if (!reason || reason.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Rejection reason must not be empty" } };
    }
    return this.transition(id, "rejected", { rejection_reason: reason });
  }
  reopenBullet(id) {
    return this.transition(id, "pending_review");
  }
  transition(id, target, opts) {
    const bullet = BulletRepository.get(this.db, id);
    if (!bullet) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Bullet ${id} not found` } };
    }
    const allowed = VALID_TRANSITIONS[bullet.status] ?? [];
    if (!allowed.includes(target)) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Cannot transition from '${bullet.status}' to '${target}'`
        }
      };
    }
    const updated = BulletRepository.updateStatus(this.db, id, target, opts);
    if (!updated) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Bullet ${id} not found` } };
    }
    return { ok: true, data: updated };
  }
}

// src/db/repositories/perspective-repository.ts
function rowToPerspective(row) {
  return {
    id: row.id,
    bullet_id: row.bullet_id,
    content: row.content,
    bullet_content_snapshot: row.bullet_content_snapshot,
    target_archetype: row.target_archetype,
    domain: row.domain,
    framing: row.framing,
    status: row.status,
    rejection_reason: row.rejection_reason,
    prompt_log_id: row.prompt_log_id,
    approved_at: row.approved_at,
    approved_by: row.approved_by,
    created_at: row.created_at
  };
}
function chainRowToResult(row) {
  return {
    id: row.id,
    bullet_id: row.bullet_id,
    content: row.content,
    bullet_content_snapshot: row.bullet_content_snapshot,
    target_archetype: row.target_archetype,
    domain: row.domain,
    framing: row.framing,
    status: row.status,
    rejection_reason: row.rejection_reason,
    prompt_log_id: row.prompt_log_id,
    approved_at: row.approved_at,
    approved_by: row.approved_by,
    created_at: row.created_at,
    bullet: {
      id: row.b_id,
      content: row.b_content,
      source_content_snapshot: row.b_source_content_snapshot,
      status: row.b_status,
      created_at: row.b_created_at
    },
    source: {
      id: row.s_id,
      title: row.s_title,
      description: row.s_description,
      source_type: row.s_source_type,
      status: row.s_status,
      created_at: row.s_created_at
    }
  };
}
var PerspectiveRepository = {
  create(db, input) {
    const id = crypto.randomUUID();
    const status = input.status ?? "pending_review";
    const row = db.query(`INSERT INTO perspectives (id, bullet_id, content, bullet_content_snapshot, target_archetype, domain, framing, status, prompt_log_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`).get(id, input.bullet_id, input.content, input.bullet_content_snapshot, input.target_archetype, input.domain, input.framing, status, input.prompt_log_id ?? null);
    return rowToPerspective(row);
  },
  get(db, id) {
    const row = db.query("SELECT * FROM perspectives WHERE id = ?").get(id);
    return row ? rowToPerspective(row) : null;
  },
  getWithChain(db, id) {
    const row = db.query(`SELECT
         p.*,
         b.id AS b_id,
         b.content AS b_content,
         b.source_content_snapshot AS b_source_content_snapshot,
         b.status AS b_status,
         b.created_at AS b_created_at,
         s.id AS s_id,
         s.title AS s_title,
         s.description AS s_description,
         s.source_type AS s_source_type,
         s.status AS s_status,
         s.created_at AS s_created_at
       FROM perspectives p
       JOIN bullets b ON p.bullet_id = b.id
       JOIN bullet_sources bs ON b.id = bs.bullet_id AND bs.is_primary = 1
       JOIN sources s ON bs.source_id = s.id
       WHERE p.id = ?`).get(id);
    return row ? chainRowToResult(row) : null;
  },
  list(db, filter = {}, offset = 0, limit = 50) {
    const conditions = [];
    const params = [];
    if (filter.bullet_id !== undefined) {
      conditions.push("bullet_id = ?");
      params.push(filter.bullet_id);
    }
    if (filter.target_archetype !== undefined) {
      conditions.push("target_archetype = ?");
      params.push(filter.target_archetype);
    }
    if (filter.domain !== undefined) {
      conditions.push("domain = ?");
      params.push(filter.domain);
    }
    if (filter.framing !== undefined) {
      conditions.push("framing = ?");
      params.push(filter.framing);
    }
    if (filter.status !== undefined) {
      conditions.push("status = ?");
      params.push(filter.status);
    }
    const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";
    const countRow = db.query(`SELECT COUNT(*) AS total FROM perspectives ${where}`).get(...params);
    const rows = db.query(`SELECT * FROM perspectives ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return {
      data: rows.map(rowToPerspective),
      total: countRow.total
    };
  },
  update(db, id, input) {
    const sets = [];
    const params = [];
    if (input.content !== undefined) {
      sets.push("content = ?");
      params.push(input.content);
    }
    if (input.target_archetype !== undefined) {
      sets.push("target_archetype = ?");
      params.push(input.target_archetype);
    }
    if (input.domain !== undefined) {
      sets.push("domain = ?");
      params.push(input.domain);
    }
    if (input.framing !== undefined) {
      sets.push("framing = ?");
      params.push(input.framing);
    }
    if (sets.length === 0) {
      return this.get(db, id);
    }
    params.push(id);
    const row = db.query(`UPDATE perspectives SET ${sets.join(", ")} WHERE id = ? RETURNING *`).get(...params);
    return row ? rowToPerspective(row) : null;
  },
  delete(db, id) {
    const result = db.run("DELETE FROM perspectives WHERE id = ?", [id]);
    return result.changes > 0;
  },
  updateStatus(db, id, status, opts) {
    let approved_at = null;
    let approved_by = null;
    const rejection_reason = opts?.rejection_reason ?? null;
    if (status === "approved") {
      approved_at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      approved_by = "human";
    }
    const row = db.query(`UPDATE perspectives
       SET status = ?,
           approved_at = COALESCE(?, approved_at),
           approved_by = COALESCE(?, approved_by),
           rejection_reason = ?
       WHERE id = ?
       RETURNING *`).get(status, approved_at, approved_by, rejection_reason, id);
    return row ? rowToPerspective(row) : null;
  }
};

// src/services/perspective-service.ts
var VALID_TRANSITIONS2 = {
  draft: ["pending_review"],
  pending_review: ["approved", "rejected"],
  rejected: ["pending_review"],
  approved: []
};

class PerspectiveService {
  db;
  constructor(db) {
    this.db = db;
  }
  getPerspective(id) {
    const p = PerspectiveRepository.get(this.db, id);
    if (!p) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Perspective ${id} not found` } };
    }
    return { ok: true, data: p };
  }
  getPerspectiveWithChain(id) {
    const chain = PerspectiveRepository.getWithChain(this.db, id);
    if (!chain) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Perspective ${id} not found` } };
    }
    return { ok: true, data: chain };
  }
  listPerspectives(filter = {}, offset = 0, limit = 50) {
    const result = PerspectiveRepository.list(this.db, filter, offset, limit);
    return {
      ok: true,
      data: result.data,
      pagination: { total: result.total, offset, limit }
    };
  }
  updatePerspective(id, input) {
    if (input.content !== undefined && input.content.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Content must not be empty" } };
    }
    const p = PerspectiveRepository.update(this.db, id, input);
    if (!p) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Perspective ${id} not found` } };
    }
    return { ok: true, data: p };
  }
  deletePerspective(id) {
    try {
      const deleted = PerspectiveRepository.delete(this.db, id);
      if (!deleted) {
        return { ok: false, error: { code: "NOT_FOUND", message: `Perspective ${id} not found` } };
      }
      return { ok: true, data: undefined };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("FOREIGN KEY constraint")) {
        return { ok: false, error: { code: "CONFLICT", message: "Cannot delete perspective that is in a resume" } };
      }
      throw err;
    }
  }
  approvePerspective(id) {
    return this.transition(id, "approved");
  }
  rejectPerspective(id, reason) {
    if (!reason || reason.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Rejection reason must not be empty" } };
    }
    return this.transition(id, "rejected", { rejection_reason: reason });
  }
  reopenPerspective(id) {
    return this.transition(id, "pending_review");
  }
  transition(id, target, opts) {
    const p = PerspectiveRepository.get(this.db, id);
    if (!p) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Perspective ${id} not found` } };
    }
    const allowed = VALID_TRANSITIONS2[p.status] ?? [];
    if (!allowed.includes(target)) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Cannot transition from '${p.status}' to '${target}'`
        }
      };
    }
    const updated = PerspectiveRepository.updateStatus(this.db, id, target, opts);
    if (!updated) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Perspective ${id} not found` } };
    }
    return { ok: true, data: updated };
  }
}

// src/db/repositories/prompt-log-repository.ts
function create2(db, input) {
  const id = crypto.randomUUID();
  const row = db.query(`INSERT INTO prompt_logs (id, entity_type, entity_id, prompt_template, prompt_input, raw_response)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`).get(id, input.entity_type, input.entity_id, input.prompt_template, input.prompt_input, input.raw_response);
  return row;
}

// src/db/repositories/archetype-repository.ts
function rowToArchetype(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    created_at: row.created_at
  };
}
function create3(db, input) {
  const id = crypto.randomUUID();
  const row = db.query(`INSERT INTO archetypes (id, name, description)
       VALUES (?, ?, ?)
       RETURNING *`).get(id, input.name, input.description ?? null);
  return rowToArchetype(row);
}
function get2(db, id) {
  const row = db.query("SELECT * FROM archetypes WHERE id = ?").get(id);
  return row ? rowToArchetype(row) : null;
}
function getByName(db, name) {
  const row = db.query("SELECT * FROM archetypes WHERE name = ?").get(name);
  return row ? rowToArchetype(row) : null;
}
function getWithDomains(db, id) {
  const archetype = get2(db, id);
  if (!archetype)
    return null;
  const domains = db.query(`SELECT d.* FROM domains d
       JOIN archetype_domains ad ON d.id = ad.domain_id
       WHERE ad.archetype_id = ?
       ORDER BY d.name ASC`).all(id);
  return {
    ...archetype,
    domains: domains.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      created_at: d.created_at
    }))
  };
}
function list2(db, offset = 0, limit = 50) {
  const countRow = db.query("SELECT COUNT(*) AS total FROM archetypes").get();
  const rows = db.query(`SELECT a.*,
              (SELECT COUNT(*) FROM resumes r WHERE r.archetype = a.name) AS resume_count,
              (SELECT COUNT(*) FROM perspectives p WHERE p.target_archetype = a.name) AS perspective_count,
              (SELECT COUNT(*) FROM archetype_domains ad WHERE ad.archetype_id = a.id) AS domain_count
       FROM archetypes a
       ORDER BY a.name ASC
       LIMIT ? OFFSET ?`).all(limit, offset);
  return {
    data: rows.map((row) => ({
      ...rowToArchetype(row),
      resume_count: row.resume_count,
      perspective_count: row.perspective_count,
      domain_count: row.domain_count
    })),
    total: countRow.total
  };
}
function update2(db, id, input) {
  const existing = get2(db, id);
  if (!existing)
    return null;
  const sets = [];
  const params = [];
  if (input.name !== undefined) {
    sets.push("name = ?");
    params.push(input.name);
  }
  if (input.description !== undefined) {
    sets.push("description = ?");
    params.push(input.description);
  }
  if (sets.length === 0)
    return existing;
  params.push(id);
  const row = db.query(`UPDATE archetypes SET ${sets.join(", ")} WHERE id = ? RETURNING *`).get(...params);
  return row ? rowToArchetype(row) : null;
}
function countReferences(db, id) {
  const archetype = get2(db, id);
  if (!archetype)
    return { resume_count: 0, perspective_count: 0 };
  const resumeCount = db.query("SELECT COUNT(*) AS c FROM resumes WHERE archetype = ?").get(archetype.name);
  const perspCount = db.query("SELECT COUNT(*) AS c FROM perspectives WHERE target_archetype = ?").get(archetype.name);
  return {
    resume_count: resumeCount.c,
    perspective_count: perspCount.c
  };
}
function del2(db, id) {
  const result = db.run("DELETE FROM archetypes WHERE id = ?", [id]);
  return result.changes > 0;
}
function addDomain(db, archetypeId, domainId) {
  db.run("INSERT INTO archetype_domains (archetype_id, domain_id) VALUES (?, ?)", [archetypeId, domainId]);
}
function removeDomain(db, archetypeId, domainId) {
  const result = db.run("DELETE FROM archetype_domains WHERE archetype_id = ? AND domain_id = ?", [archetypeId, domainId]);
  return result.changes > 0;
}
function listDomains(db, archetypeId) {
  return db.query(`SELECT d.* FROM domains d
       JOIN archetype_domains ad ON d.id = ad.domain_id
       WHERE ad.archetype_id = ?
       ORDER BY d.name ASC`).all(archetypeId);
}
function getExpectedDomainNames(db, archetypeName) {
  const rows = db.query(`SELECT d.name FROM domains d
       JOIN archetype_domains ad ON d.id = ad.domain_id
       JOIN archetypes a ON a.id = ad.archetype_id
       WHERE a.name = ?`).all(archetypeName);
  return rows.map((r) => r.name);
}

// src/db/repositories/domain-repository.ts
function rowToDomain(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    created_at: row.created_at
  };
}
function create4(db, input) {
  const id = crypto.randomUUID();
  const row = db.query(`INSERT INTO domains (id, name, description)
       VALUES (?, ?, ?)
       RETURNING *`).get(id, input.name, input.description ?? null);
  return rowToDomain(row);
}
function get3(db, id) {
  const row = db.query("SELECT * FROM domains WHERE id = ?").get(id);
  return row ? rowToDomain(row) : null;
}
function getByName2(db, name) {
  const row = db.query("SELECT * FROM domains WHERE name = ?").get(name);
  return row ? rowToDomain(row) : null;
}
function list3(db, offset = 0, limit = 50) {
  const countRow = db.query("SELECT COUNT(*) AS total FROM domains").get();
  const rows = db.query(`SELECT d.*,
              (SELECT COUNT(*) FROM perspectives p WHERE p.domain = d.name) AS perspective_count,
              (SELECT COUNT(*) FROM archetype_domains ad WHERE ad.domain_id = d.id) AS archetype_count
       FROM domains d
       ORDER BY d.name ASC
       LIMIT ? OFFSET ?`).all(limit, offset);
  return {
    data: rows.map((row) => ({
      ...rowToDomain(row),
      perspective_count: row.perspective_count,
      archetype_count: row.archetype_count
    })),
    total: countRow.total
  };
}
function update3(db, id, input) {
  const existing = get3(db, id);
  if (!existing)
    return null;
  const sets = [];
  const params = [];
  if (input.name !== undefined) {
    sets.push("name = ?");
    params.push(input.name);
  }
  if (input.description !== undefined) {
    sets.push("description = ?");
    params.push(input.description);
  }
  if (sets.length === 0)
    return existing;
  params.push(id);
  const row = db.query(`UPDATE domains SET ${sets.join(", ")} WHERE id = ? RETURNING *`).get(...params);
  return row ? rowToDomain(row) : null;
}
function countReferences2(db, id) {
  const domain = get3(db, id);
  if (!domain)
    return { perspective_count: 0, archetype_count: 0 };
  const perspCount = db.query("SELECT COUNT(*) AS c FROM perspectives WHERE domain = ?").get(domain.name);
  const archCount = db.query("SELECT COUNT(*) AS c FROM archetype_domains WHERE domain_id = ?").get(id);
  return {
    perspective_count: perspCount.c,
    archetype_count: archCount.c
  };
}
function del3(db, id) {
  const result = db.run("DELETE FROM domains WHERE id = ?", [id]);
  return result.changes > 0;
}

// src/ai/claude-cli.ts
var CODE_FENCE_RE = /```(?:json)?\s*\n?([\s\S]*?)```/;
function stripCodeFences(raw) {
  const match = CODE_FENCE_RE.exec(raw);
  return match ? match[1].trim() : raw.trim();
}
function parseClaudeEnvelope(raw) {
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return { ok: false, message: `Failed to parse CLI envelope as JSON` };
  }
  if (envelope.is_error === true) {
    const msg = typeof envelope.result === "string" ? envelope.result : "Claude CLI reported an error";
    return { ok: false, message: msg };
  }
  const inner = envelope.result;
  if (typeof inner !== "string") {
    return {
      ok: false,
      message: `Envelope .result is not a string (got ${typeof inner})`
    };
  }
  const stripped = stripCodeFences(inner);
  try {
    const data = JSON.parse(stripped);
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      message: `Failed to parse inner JSON after stripping code fences`
    };
  }
}
async function invokeClaude(options) {
  const {
    prompt,
    timeout = Number(process.env.FORGE_CLAUDE_TIMEOUT) || 60000,
    claudePath = process.env.FORGE_CLAUDE_PATH || "claude"
  } = options;
  let proc;
  try {
    proc = Bun.spawn([claudePath, "-p", prompt, "--output-format", "json"], {
      stdout: "pipe",
      stderr: "pipe",
      signal: AbortSignal.timeout(timeout)
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found") || msg.includes("No such file")) {
      return {
        ok: false,
        error: "NOT_FOUND",
        message: `Claude Code CLI not found at "${claudePath}". Install from https://claude.ai/claude-code`
      };
    }
    return {
      ok: false,
      error: "PROCESS_ERROR",
      message: `Failed to spawn claude process: ${msg}`
    };
  }
  let rawStdout;
  let rawStderr;
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited
    ]);
    rawStdout = stdout;
    rawStderr = stderr;
    if (exitCode !== 0) {
      return {
        ok: false,
        error: "PROCESS_ERROR",
        message: `claude exited with code ${exitCode}: ${rawStderr || "(no stderr)"}`,
        rawResponse: rawStdout
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort") || msg.includes("Abort") || msg.includes("timeout") || msg.includes("Timeout") || msg.includes("The operation was aborted")) {
      return {
        ok: false,
        error: "TIMEOUT",
        message: `AI derivation timed out after ${timeout}ms`
      };
    }
    return {
      ok: false,
      error: "PROCESS_ERROR",
      message: `Error reading claude output: ${msg}`
    };
  }
  const parsed = parseClaudeEnvelope(rawStdout);
  if (!parsed.ok) {
    return {
      ok: false,
      error: "PARSE_ERROR",
      message: parsed.message,
      rawResponse: rawStdout
    };
  }
  return { ok: true, data: parsed.data, rawResponse: rawStdout };
}
// src/ai/prompts.ts
var SOURCE_TO_BULLET_TEMPLATE_VERSION = "source-to-bullet-v1";
function renderSourceToBulletPrompt(description) {
  return `You are a resume content assistant. Given a source description of work performed,
decompose it into factual bullet points. Each bullet must:
- State only facts present in the source description
- Include specific technologies, tools, or methods mentioned
- Include quantitative metrics if present in the source
- NOT infer, embellish, or add context not explicitly stated

Source description:
---
${description}
---

Respond with a JSON object:
{
  "bullets": [
    {
      "content": "factual bullet text",
      "technologies": ["tech1", "tech2"],
      "metrics": "quantitative metric if present, null otherwise"
    }
  ]
}`;
}
var BULLET_TO_PERSPECTIVE_TEMPLATE_VERSION = "bullet-to-perspective-v1";
function renderBulletToPerspectivePrompt(content, technologies, metrics, archetype, domain, framing) {
  const techList = technologies.length > 0 ? technologies.join(", ") : "(none)";
  const metricsText = metrics ?? "(none)";
  return `You are a resume content assistant. Given a factual bullet point, reframe it
for a target role archetype. The reframing must:
- Only use facts present in the original bullet
- Emphasize aspects relevant to the target archetype
- NOT add claims, technologies, outcomes, or context not in the bullet
- Use active voice, concise phrasing

Original bullet:
---
${content}
Technologies: ${techList}
Metrics: ${metricsText}
---

Target archetype: ${archetype}
Target domain: ${domain}
Framing style: ${framing} (accomplishment | responsibility | context)

Respond with a JSON object:
{
  "content": "reframed bullet text",
  "reasoning": "brief explanation of what was emphasized and why"
}`;
}
// src/ai/validator.ts
var BULLET_ITEM_FIELDS = new Set(["content", "technologies", "metrics"]);
var BULLET_ROOT_FIELDS = new Set(["bullets"]);
var PERSPECTIVE_FIELDS = new Set(["content", "reasoning"]);
function extraFields(obj, known) {
  return Object.keys(obj).filter((k) => !known.has(k));
}
function validateBulletDerivation(data) {
  const warnings = [];
  if (data === null || data === undefined || typeof data !== "object") {
    return { ok: false, error: "Response is not an object" };
  }
  const obj = data;
  const rootExtra = extraFields(obj, BULLET_ROOT_FIELDS);
  if (rootExtra.length > 0) {
    warnings.push(`Unexpected root fields: ${rootExtra.join(", ")}`);
  }
  if (!("bullets" in obj)) {
    return { ok: false, error: 'Missing required field "bullets"' };
  }
  if (!Array.isArray(obj.bullets)) {
    return { ok: false, error: '"bullets" must be an array' };
  }
  if (obj.bullets.length === 0) {
    return { ok: false, error: '"bullets" array is empty \u2014 no bullets produced' };
  }
  const bullets = [];
  for (let i = 0;i < obj.bullets.length; i++) {
    const item = obj.bullets[i];
    const prefix = `bullets[${i}]`;
    if (item === null || item === undefined || typeof item !== "object") {
      return { ok: false, error: `${prefix} is not an object` };
    }
    const bullet = item;
    const itemExtra = extraFields(bullet, BULLET_ITEM_FIELDS);
    if (itemExtra.length > 0) {
      warnings.push(`${prefix}: unexpected fields: ${itemExtra.join(", ")}`);
    }
    if (typeof bullet.content !== "string") {
      return { ok: false, error: `${prefix}.content must be a string` };
    }
    if (bullet.content.trim().length === 0) {
      return { ok: false, error: `${prefix}.content must be non-empty` };
    }
    if (!Array.isArray(bullet.technologies)) {
      return { ok: false, error: `${prefix}.technologies must be an array` };
    }
    for (let j = 0;j < bullet.technologies.length; j++) {
      if (typeof bullet.technologies[j] !== "string") {
        return {
          ok: false,
          error: `${prefix}.technologies[${j}] must be a string`
        };
      }
    }
    if (!("metrics" in bullet)) {
      return { ok: false, error: `${prefix}.metrics is required (use null if none)` };
    }
    if (bullet.metrics !== null && typeof bullet.metrics !== "string") {
      return { ok: false, error: `${prefix}.metrics must be a string or null` };
    }
    bullets.push({
      content: bullet.content,
      technologies: bullet.technologies,
      metrics: bullet.metrics
    });
  }
  return { ok: true, data: { bullets }, warnings };
}
function validatePerspectiveDerivation(data) {
  const warnings = [];
  if (data === null || data === undefined || typeof data !== "object") {
    return { ok: false, error: "Response is not an object" };
  }
  const obj = data;
  const extra = extraFields(obj, PERSPECTIVE_FIELDS);
  if (extra.length > 0) {
    warnings.push(`Unexpected fields: ${extra.join(", ")}`);
  }
  if (typeof obj.content !== "string") {
    return { ok: false, error: 'Missing or invalid "content" field (must be a string)' };
  }
  if (obj.content.trim().length === 0) {
    return { ok: false, error: '"content" must be non-empty' };
  }
  if (typeof obj.reasoning !== "string") {
    return { ok: false, error: 'Missing or invalid "reasoning" field (must be a string)' };
  }
  return {
    ok: true,
    data: { content: obj.content, reasoning: obj.reasoning },
    warnings
  };
}
// src/services/derivation-service.ts
class DerivationService {
  db;
  derivingBullets;
  constructor(db, derivingBullets) {
    this.db = db;
    this.derivingBullets = derivingBullets;
  }
  async deriveBulletsFromSource(sourceId) {
    const source = get(this.db, sourceId);
    if (!source) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Source ${sourceId} not found` } };
    }
    const locked = acquireDerivingLock(this.db, sourceId);
    if (!locked) {
      return { ok: false, error: { code: "CONFLICT", message: `Source ${sourceId} is already being derived` } };
    }
    const previousStatus = source.status;
    try {
      const snapshot = source.description;
      const prompt = renderSourceToBulletPrompt(snapshot);
      const aiResult = await invokeClaude({ prompt });
      if (!aiResult.ok) {
        releaseDerivingLock(this.db, sourceId, previousStatus, false);
        const errorCode = aiResult.error === "TIMEOUT" ? "GATEWAY_TIMEOUT" : "AI_ERROR";
        return { ok: false, error: { code: errorCode, message: `AI invocation failed: ${aiResult.error}`, details: aiResult.raw } };
      }
      const validation = validateBulletDerivation(aiResult.data);
      if (!validation.ok) {
        releaseDerivingLock(this.db, sourceId, previousStatus, false);
        return { ok: false, error: { code: "AI_ERROR", message: `AI response validation failed: ${validation.error}` } };
      }
      const bullets = [];
      const txn = this.db.transaction(() => {
        for (const item of validation.data.bullets) {
          const bullet = BulletRepository.create(this.db, {
            content: item.content,
            source_content_snapshot: snapshot,
            technologies: item.technologies,
            metrics: item.metrics,
            status: "pending_review",
            source_ids: [{ id: sourceId, is_primary: true }]
          });
          create2(this.db, {
            entity_type: "bullet",
            entity_id: bullet.id,
            prompt_template: SOURCE_TO_BULLET_TEMPLATE_VERSION,
            prompt_input: prompt,
            raw_response: JSON.stringify(aiResult.data)
          });
          bullets.push(bullet);
        }
        releaseDerivingLock(this.db, sourceId, previousStatus, true);
      });
      txn();
      return { ok: true, data: bullets };
    } catch (err) {
      releaseDerivingLock(this.db, sourceId, previousStatus, false);
      throw err;
    }
  }
  async derivePerspectivesFromBullet(bulletId, params) {
    const bullet = BulletRepository.get(this.db, bulletId);
    if (!bullet) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Bullet ${bulletId} not found` } };
    }
    if (bullet.status !== "approved") {
      return {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: `Bullet must be approved to derive perspectives (current: ${bullet.status})` }
      };
    }
    const archetypeExists = getByName(this.db, params.archetype);
    if (!archetypeExists) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Unknown archetype: '${params.archetype}'. Check /api/archetypes for valid values.`
        }
      };
    }
    const domainExists = getByName2(this.db, params.domain);
    if (!domainExists) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Unknown domain: '${params.domain}'. Check /api/domains for valid values.`
        }
      };
    }
    if (this.derivingBullets.has(bulletId)) {
      return { ok: false, error: { code: "CONFLICT", message: `Bullet ${bulletId} is already being derived` } };
    }
    this.derivingBullets.add(bulletId);
    try {
      const snapshot = bullet.content;
      const prompt = renderBulletToPerspectivePrompt(snapshot, bullet.technologies, bullet.metrics, params.archetype, params.domain, params.framing);
      const aiResult = await invokeClaude({ prompt });
      if (!aiResult.ok) {
        this.derivingBullets.delete(bulletId);
        const errorCode = aiResult.error === "TIMEOUT" ? "GATEWAY_TIMEOUT" : "AI_ERROR";
        return { ok: false, error: { code: errorCode, message: `AI invocation failed: ${aiResult.error}`, details: aiResult.raw } };
      }
      const validation = validatePerspectiveDerivation(aiResult.data);
      if (!validation.ok) {
        this.derivingBullets.delete(bulletId);
        return { ok: false, error: { code: "AI_ERROR", message: `AI response validation failed: ${validation.error}` } };
      }
      let perspective;
      const txn = this.db.transaction(() => {
        perspective = PerspectiveRepository.create(this.db, {
          bullet_id: bulletId,
          content: validation.data.content,
          bullet_content_snapshot: snapshot,
          target_archetype: params.archetype,
          domain: params.domain,
          framing: params.framing,
          status: "pending_review"
        });
        create2(this.db, {
          entity_type: "perspective",
          entity_id: perspective.id,
          prompt_template: BULLET_TO_PERSPECTIVE_TEMPLATE_VERSION,
          prompt_input: prompt,
          raw_response: JSON.stringify(aiResult.data)
        });
      });
      txn();
      this.derivingBullets.delete(bulletId);
      return { ok: true, data: perspective };
    } catch (err) {
      this.derivingBullets.delete(bulletId);
      throw err;
    }
  }
  static recoverStaleLocks(db, thresholdMs = 300000) {
    const threshold = new Date(Date.now() - thresholdMs).toISOString();
    const result = db.run(`UPDATE sources SET status = 'draft', updated_at = ?
       WHERE status = 'deriving' AND updated_at < ?`, [new Date().toISOString(), threshold]);
    return result.changes;
  }
}

// src/db/repositories/resume-repository.ts
function rowToResume(row) {
  return {
    id: row.id,
    name: row.name,
    target_role: row.target_role,
    target_employer: row.target_employer,
    archetype: row.archetype,
    status: row.status,
    notes: row.notes ?? null,
    header: row.header ?? null,
    markdown_override: row.markdown_override ?? null,
    markdown_override_updated_at: row.markdown_override_updated_at ?? null,
    latex_override: row.latex_override ?? null,
    latex_override_updated_at: row.latex_override_updated_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}
var ResumeRepository = {
  create(db, input) {
    const id = crypto.randomUUID();
    const row = db.query(`INSERT INTO resumes (id, name, target_role, target_employer, archetype)
         VALUES (?, ?, ?, ?, ?)
         RETURNING *`).get(id, input.name, input.target_role, input.target_employer, input.archetype);
    return rowToResume(row);
  },
  get(db, id) {
    const row = db.query("SELECT * FROM resumes WHERE id = ?").get(id);
    if (!row)
      return null;
    return rowToResume(row);
  },
  getWithEntries(db, id) {
    const resume = ResumeRepository.get(db, id);
    if (!resume)
      return null;
    const rows = db.query(`SELECT
           re.id AS entry_id,
           re.section,
           re.position,
           re.content AS entry_content,
           re.perspective_content_snapshot,
           re.notes AS entry_notes,
           re.created_at AS entry_created_at,
           re.updated_at AS entry_updated_at,
           re.perspective_id,
           p.bullet_id,
           p.content AS perspective_content
         FROM resume_entries re
         JOIN perspectives p ON p.id = re.perspective_id
         WHERE re.resume_id = ?
         ORDER BY re.section, re.position`).all(id);
    const sections = {};
    for (const row of rows) {
      if (!sections[row.section]) {
        sections[row.section] = [];
      }
      sections[row.section].push({
        id: row.entry_id,
        resume_id: id,
        perspective_id: row.perspective_id,
        content: row.entry_content,
        perspective_content_snapshot: row.perspective_content_snapshot,
        section: row.section,
        position: row.position,
        notes: row.entry_notes,
        created_at: row.entry_created_at,
        updated_at: row.entry_updated_at,
        perspective_content: row.perspective_content
      });
    }
    return { ...resume, sections };
  },
  list(db, offset = 0, limit = 50) {
    const countRow = db.query("SELECT COUNT(*) AS total FROM resumes").get();
    const rows = db.query("SELECT * FROM resumes ORDER BY created_at DESC LIMIT ? OFFSET ?").all(limit, offset);
    return {
      data: rows.map(rowToResume),
      total: countRow.total
    };
  },
  update(db, id, input) {
    const existing = ResumeRepository.get(db, id);
    if (!existing)
      return null;
    const sets = [];
    const params = [];
    if (input.name !== undefined) {
      sets.push("name = ?");
      params.push(input.name);
    }
    if (input.target_role !== undefined) {
      sets.push("target_role = ?");
      params.push(input.target_role);
    }
    if (input.target_employer !== undefined) {
      sets.push("target_employer = ?");
      params.push(input.target_employer);
    }
    if (input.archetype !== undefined) {
      sets.push("archetype = ?");
      params.push(input.archetype);
    }
    if (input.status !== undefined) {
      sets.push("status = ?");
      params.push(input.status);
    }
    if (input.header !== undefined) {
      sets.push("header = ?");
      params.push(input.header);
    }
    if (input.markdown_override !== undefined) {
      sets.push("markdown_override = ?");
      params.push(input.markdown_override);
      sets.push("markdown_override_updated_at = ?");
      params.push(input.markdown_override !== null ? new Date().toISOString() : null);
    }
    if (input.latex_override !== undefined) {
      sets.push("latex_override = ?");
      params.push(input.latex_override);
      sets.push("latex_override_updated_at = ?");
      params.push(input.latex_override !== null ? new Date().toISOString() : null);
    }
    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
    params.push(id);
    const row = db.query(`UPDATE resumes SET ${sets.join(", ")} WHERE id = ? RETURNING *`).get(...params);
    if (!row)
      return null;
    return rowToResume(row);
  },
  delete(db, id) {
    const result = db.run("DELETE FROM resumes WHERE id = ?", [id]);
    return result.changes > 0;
  },
  addEntry(db, resumeId, input) {
    const id = crypto.randomUUID();
    db.run(`INSERT INTO resume_entries (id, resume_id, perspective_id, content, section, position, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [
      id,
      resumeId,
      input.perspective_id,
      input.content ?? null,
      input.section,
      input.position,
      input.notes ?? null
    ]);
    return db.query("SELECT * FROM resume_entries WHERE id = ?").get(id);
  },
  removeEntry(db, resumeId, entryId) {
    const result = db.run("DELETE FROM resume_entries WHERE id = ? AND resume_id = ?", [entryId, resumeId]);
    return result.changes > 0;
  },
  reorderEntries(db, resumeId, entries) {
    const txn = db.transaction(() => {
      const stmt = db.prepare(`UPDATE resume_entries SET section = ?, position = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE id = ? AND resume_id = ?`);
      for (const entry of entries) {
        stmt.run(entry.section, entry.position, entry.id, resumeId);
      }
    });
    txn();
  },
  updateEntry(db, entryId, input) {
    const sets = [];
    const params = [];
    if ("content" in input) {
      sets.push("content = ?");
      params.push(input.content);
      if (input.content !== null && input.content !== undefined) {
        sets.push("perspective_content_snapshot = (SELECT content FROM perspectives WHERE id = (SELECT perspective_id FROM resume_entries WHERE id = ?))");
        params.push(entryId);
      } else {
        sets.push("perspective_content_snapshot = NULL");
      }
    }
    if (input.section !== undefined) {
      sets.push("section = ?");
      params.push(input.section);
    }
    if (input.position !== undefined) {
      sets.push("position = ?");
      params.push(input.position);
    }
    if ("notes" in input) {
      sets.push("notes = ?");
      params.push(input.notes ?? null);
    }
    if (sets.length === 0) {
      return db.query("SELECT * FROM resume_entries WHERE id = ?").get(entryId);
    }
    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
    params.push(entryId);
    const row = db.query(`UPDATE resume_entries SET ${sets.join(", ")} WHERE id = ? RETURNING *`).get(...params);
    return row;
  },
  updateHeader(db, id, header) {
    const row = db.query(`UPDATE resumes SET header = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE id = ? RETURNING *`).get(JSON.stringify(header), id);
    if (!row)
      return null;
    return rowToResume(row);
  },
  updateMarkdownOverride(db, id, content) {
    const row = db.query(`UPDATE resumes SET
          markdown_override = ?,
          markdown_override_updated_at = CASE WHEN ? IS NOT NULL THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE NULL END,
          updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE id = ? RETURNING *`).get(content, content, id);
    if (!row)
      return null;
    return rowToResume(row);
  },
  updateLatexOverride(db, id, content) {
    const row = db.query(`UPDATE resumes SET
          latex_override = ?,
          latex_override_updated_at = CASE WHEN ? IS NOT NULL THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE NULL END,
          updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE id = ? RETURNING *`).get(content, content, id);
    if (!row)
      return null;
    return rowToResume(row);
  }
};

// src/constants/archetypes.ts
var THIN_COVERAGE_THRESHOLD = 2;

// src/services/resume-compiler.ts
function compileResumeIR(db, resumeId) {
  const resume = db.query("SELECT id, name, target_role, header FROM resumes WHERE id = ?").get(resumeId);
  if (!resume)
    return null;
  const header = parseHeader(resume);
  const sections = [];
  let sectionOrder = 0;
  const summaryItems = buildSummarySection(db, resumeId);
  if (summaryItems.length > 0) {
    sections.push({
      id: syntheticUUID("summary", resumeId),
      type: "summary",
      title: "Summary",
      display_order: sectionOrder++,
      items: summaryItems
    });
  }
  const experienceGroups = buildExperienceSection(db, resumeId);
  if (experienceGroups.length > 0) {
    sections.push({
      id: syntheticUUID("experience", resumeId),
      type: "experience",
      title: "Experience",
      display_order: sectionOrder++,
      items: experienceGroups
    });
  }
  const skillGroups = buildSkillsSection(db, resumeId);
  if (skillGroups.length > 0) {
    sections.push({
      id: syntheticUUID("skills", resumeId),
      type: "skills",
      title: "Technical Skills",
      display_order: sectionOrder++,
      items: skillGroups
    });
  }
  const educationItems = buildEducationSection(db, resumeId);
  if (educationItems.length > 0) {
    sections.push({
      id: syntheticUUID("education", resumeId),
      type: "education",
      title: "Education & Certifications",
      display_order: sectionOrder++,
      items: educationItems
    });
  }
  const projectItems = buildProjectsSection(db, resumeId);
  if (projectItems.length > 0) {
    sections.push({
      id: syntheticUUID("projects", resumeId),
      type: "projects",
      title: "Selected Projects",
      display_order: sectionOrder++,
      items: projectItems
    });
  }
  const clearanceItems = buildClearanceSection(db, resumeId);
  if (clearanceItems.length > 0) {
    sections.push({
      id: syntheticUUID("clearance", resumeId),
      type: "clearance",
      title: "Security Clearance",
      display_order: sectionOrder++,
      items: clearanceItems
    });
  }
  const presentationItems = buildPresentationsSection(db, resumeId);
  if (presentationItems.length > 0) {
    sections.push({
      id: syntheticUUID("presentations", resumeId),
      type: "presentations",
      title: "Presentations",
      display_order: sectionOrder++,
      items: presentationItems
    });
  }
  return { resume_id: resumeId, header, sections };
}
function parseHeader(resume) {
  if (resume.header) {
    try {
      return JSON.parse(resume.header);
    } catch {}
  }
  return {
    name: resume.name,
    tagline: resume.target_role,
    location: null,
    email: null,
    phone: null,
    linkedin: null,
    github: null,
    website: null,
    clearance: null
  };
}
function buildSummarySection(db, resumeId) {
  const rows = db.query(`SELECT re.id AS entry_id, re.content AS entry_content,
              p.content AS perspective_content
       FROM resume_entries re
       JOIN perspectives p ON p.id = re.perspective_id
       WHERE re.resume_id = ? AND re.section = 'summary'
       ORDER BY re.position ASC`).all(resumeId);
  return rows.map((row) => ({
    kind: "summary",
    content: row.entry_content ?? row.perspective_content,
    entry_id: row.entry_id
  }));
}
function buildExperienceSection(db, resumeId) {
  const rows = db.query(`SELECT
        re.id AS entry_id,
        re.content AS entry_content,
        re.perspective_id,
        re.position,
        p.content AS perspective_content,
        p.bullet_id,
        bs.source_id,
        s.title AS source_title,
        sr.organization_id,
        sr.start_date,
        sr.end_date,
        sr.is_current,
        o.name AS org_name
      FROM resume_entries re
      JOIN perspectives p ON p.id = re.perspective_id
      JOIN bullet_sources bs ON bs.bullet_id = p.bullet_id AND bs.is_primary = 1
      JOIN sources s ON s.id = bs.source_id
      LEFT JOIN source_roles sr ON sr.source_id = s.id
      LEFT JOIN organizations o ON o.id = sr.organization_id
      WHERE re.resume_id = ? AND re.section IN ('experience', 'work_history')
      ORDER BY sr.is_current DESC, sr.start_date DESC, re.position ASC`).all(resumeId);
  const orgMap = new Map;
  for (const row of rows) {
    const orgKey = row.org_name ?? "Other";
    if (!orgMap.has(orgKey))
      orgMap.set(orgKey, new Map);
    const roleMap = orgMap.get(orgKey);
    const roleKey = row.source_title;
    if (!roleMap.has(roleKey))
      roleMap.set(roleKey, []);
    roleMap.get(roleKey).push(row);
  }
  const groups = [];
  for (const [orgName, roleMap] of orgMap) {
    const subheadings = [];
    for (const [roleTitle, entries] of roleMap) {
      const first = entries[0];
      const dateRange = formatDateRange(first.start_date, first.end_date, !!first.is_current);
      const bullets = entries.map((e) => ({
        content: e.entry_content ?? e.perspective_content,
        entry_id: e.entry_id,
        source_chain: {
          perspective_id: e.perspective_id,
          bullet_id: e.bullet_id,
          source_id: e.source_id
        },
        is_cloned: e.entry_content !== null
      }));
      subheadings.push({
        id: syntheticUUID("subheading", `${orgName}-${roleTitle}`),
        title: roleTitle,
        date_range: dateRange,
        source_id: first.source_id,
        bullets
      });
    }
    groups.push({
      kind: "experience_group",
      id: syntheticUUID("org", orgName),
      organization: orgName,
      subheadings
    });
  }
  return groups;
}
function buildSkillsSection(db, resumeId) {
  const rows = db.query(`SELECT DISTINCT sk.category, sk.name AS skill_name
       FROM resume_entries re
       JOIN perspectives p ON p.id = re.perspective_id
       JOIN bullet_skills bsk ON bsk.bullet_id = p.bullet_id
       JOIN skills sk ON sk.id = bsk.skill_id
       WHERE re.resume_id = ?
       ORDER BY sk.category ASC, sk.name ASC`).all(resumeId);
  if (rows.length === 0)
    return [];
  const catMap = new Map;
  for (const row of rows) {
    const cat = row.category ?? "Other";
    if (!catMap.has(cat))
      catMap.set(cat, []);
    catMap.get(cat).push(row.skill_name);
  }
  return [{
    kind: "skill_group",
    categories: Array.from(catMap.entries()).map(([label, skills]) => ({
      label,
      skills
    }))
  }];
}
function buildEducationSection(db, resumeId) {
  const rows = db.query(`SELECT
        re.id AS entry_id,
        re.content AS entry_content,
        p.content AS perspective_content,
        bs.source_id,
        se.institution,
        se.field,
        se.end_date
      FROM resume_entries re
      JOIN perspectives p ON p.id = re.perspective_id
      JOIN bullet_sources bs ON bs.bullet_id = p.bullet_id AND bs.is_primary = 1
      JOIN sources s ON s.id = bs.source_id
      LEFT JOIN source_education se ON se.source_id = s.id
      WHERE re.resume_id = ? AND re.section = 'education'
      ORDER BY re.position ASC`).all(resumeId);
  return rows.map((row) => ({
    kind: "education",
    institution: row.institution ?? "Unknown",
    degree: row.entry_content ?? row.perspective_content,
    date: row.end_date ? new Date(row.end_date).getFullYear().toString() : "",
    entry_id: row.entry_id,
    source_id: row.source_id
  }));
}
function buildProjectsSection(db, resumeId) {
  const rows = db.query(`SELECT
        re.id AS entry_id,
        re.content AS entry_content,
        re.perspective_id,
        p.content AS perspective_content,
        p.bullet_id,
        bs.source_id,
        s.title AS source_title,
        sp.start_date,
        sp.end_date
      FROM resume_entries re
      JOIN perspectives p ON p.id = re.perspective_id
      JOIN bullet_sources bs ON bs.bullet_id = p.bullet_id AND bs.is_primary = 1
      JOIN sources s ON s.id = bs.source_id
      LEFT JOIN source_projects sp ON sp.source_id = s.id
      WHERE re.resume_id = ? AND re.section = 'projects'
      ORDER BY re.position ASC`).all(resumeId);
  const projectMap = new Map;
  for (const row of rows) {
    if (!projectMap.has(row.source_title))
      projectMap.set(row.source_title, []);
    projectMap.get(row.source_title).push(row);
  }
  return Array.from(projectMap.entries()).map(([name, entries]) => ({
    kind: "project",
    name,
    date: entries[0].end_date ? new Date(entries[0].end_date).getFullYear().toString() : null,
    entry_id: entries[0].entry_id,
    source_id: entries[0].source_id,
    bullets: entries.map((e) => ({
      content: e.entry_content ?? e.perspective_content,
      entry_id: e.entry_id,
      source_chain: {
        perspective_id: e.perspective_id,
        bullet_id: e.bullet_id,
        source_id: e.source_id
      },
      is_cloned: e.entry_content !== null
    }))
  }));
}
function buildClearanceSection(db, resumeId) {
  const rows = db.query(`SELECT
        re.id AS entry_id,
        re.content AS entry_content,
        p.content AS perspective_content,
        bs.source_id,
        sc.level,
        sc.polygraph,
        sc.status AS clearance_status
      FROM resume_entries re
      JOIN perspectives p ON p.id = re.perspective_id
      JOIN bullet_sources bs ON bs.bullet_id = p.bullet_id AND bs.is_primary = 1
      JOIN sources s ON s.id = bs.source_id
      LEFT JOIN source_clearances sc ON sc.source_id = s.id
      WHERE re.resume_id = ? AND re.section = 'clearance'
      ORDER BY re.position ASC`).all(resumeId);
  return rows.map((row) => {
    let content = row.entry_content ?? row.perspective_content;
    if (row.level) {
      content = row.level;
      if (row.polygraph)
        content += ` with ${row.polygraph}`;
      if (row.clearance_status)
        content += ` - ${row.clearance_status}`;
    }
    return {
      kind: "clearance",
      content,
      entry_id: row.entry_id,
      source_id: row.source_id
    };
  });
}
function buildPresentationsSection(db, resumeId) {
  const rows = db.query(`SELECT
        re.id AS entry_id,
        re.content AS entry_content,
        re.perspective_id,
        p.content AS perspective_content,
        p.bullet_id,
        bs.source_id,
        s.title AS source_title,
        s.end_date
      FROM resume_entries re
      JOIN perspectives p ON p.id = re.perspective_id
      JOIN bullet_sources bs ON bs.bullet_id = p.bullet_id AND bs.is_primary = 1
      JOIN sources s ON s.id = bs.source_id
      WHERE re.resume_id = ? AND re.section = 'presentations'
      ORDER BY re.position ASC`).all(resumeId);
  const presMap = new Map;
  for (const row of rows) {
    if (!presMap.has(row.source_title))
      presMap.set(row.source_title, []);
    presMap.get(row.source_title).push(row);
  }
  return Array.from(presMap.entries()).map(([title, entries]) => ({
    kind: "presentation",
    title,
    venue: "",
    date: entries[0].end_date ? new Date(entries[0].end_date).getFullYear().toString() : null,
    entry_id: entries[0].entry_id,
    source_id: entries[0].source_id,
    bullets: entries.map((e) => ({
      content: e.entry_content ?? e.perspective_content,
      entry_id: e.entry_id,
      source_chain: {
        perspective_id: e.perspective_id,
        bullet_id: e.bullet_id,
        source_id: e.source_id
      },
      is_cloned: e.entry_content !== null
    }))
  }));
}
function syntheticUUID(namespace, key) {
  const input = `${namespace}:${key}`;
  let hash = 0;
  for (let i = 0;i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(1, 4)}-${hex.slice(0, 12).padEnd(12, "0")}`;
}
function formatDateRange(startDate, endDate, isCurrent) {
  const fmt = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };
  if (!startDate && !endDate)
    return "";
  if (!startDate && endDate)
    return fmt(endDate);
  if (startDate && isCurrent)
    return `${fmt(startDate)} - Present`;
  if (startDate && endDate)
    return `${fmt(startDate)} - ${fmt(endDate)}`;
  if (startDate)
    return fmt(startDate);
  return "";
}

// src/lib/escape.ts
function escapeLatex(text) {
  if (!text)
    return text;
  return text.replace(/\\/g, "\x00BACKSLASH\x00").replace(/~/g, "\x01TILDE\x01").replace(/\^/g, "\x02CARET\x02").replace(/&/g, "\\&").replace(/%/g, "\\%").replace(/\$/g, "\\$").replace(/#/g, "\\#").replace(/_/g, "\\_").replace(/\{/g, "\\{").replace(/\}/g, "\\}").replace(/\x00BACKSLASH\x00/g, "\\textbackslash{}").replace(/\x01TILDE\x01/g, "\\textasciitilde{}").replace(/\x02CARET\x02/g, "\\textasciicircum{}");
}

// src/lib/latex-compiler.ts
function compileToLatex(doc, template) {
  const escaped = escapeIR(doc);
  const parts = [];
  parts.push(template.preamble);
  parts.push("");
  parts.push("\\begin{document}");
  parts.push("");
  parts.push(template.renderHeader(escaped.header));
  parts.push("");
  for (const section of escaped.sections) {
    parts.push(template.renderSection(section));
    parts.push("");
  }
  parts.push(template.footer);
  return parts.join(`
`);
}
function escapeIR(doc) {
  return {
    resume_id: doc.resume_id,
    header: escapeHeader(doc.header),
    sections: doc.sections.map(escapeSection)
  };
}
function escapeHeader(h) {
  return {
    name: escapeLatex(h.name),
    tagline: h.tagline ? escapeLatex(h.tagline) : null,
    location: h.location ? escapeLatex(h.location) : null,
    email: h.email,
    phone: h.phone ? escapeLatex(h.phone) : null,
    linkedin: h.linkedin,
    github: h.github,
    website: h.website,
    clearance: h.clearance ? escapeLatex(h.clearance) : null
  };
}
function escapeSection(section) {
  return {
    ...section,
    title: escapeLatex(section.title),
    items: section.items.map(escapeItem)
  };
}
function escapeItem(item) {
  switch (item.kind) {
    case "summary":
      return { ...item, content: escapeLatex(item.content) };
    case "experience_group":
      return {
        ...item,
        organization: escapeLatex(item.organization),
        subheadings: item.subheadings.map((sub) => ({
          ...sub,
          title: escapeLatex(sub.title),
          date_range: escapeLatex(sub.date_range),
          bullets: sub.bullets.map((b) => ({
            ...b,
            content: escapeLatex(b.content)
          }))
        }))
      };
    case "skill_group":
      return {
        ...item,
        categories: item.categories.map((cat) => ({
          label: escapeLatex(cat.label),
          skills: cat.skills.map((s) => escapeLatex(s))
        }))
      };
    case "education":
      return {
        ...item,
        institution: escapeLatex(item.institution),
        degree: escapeLatex(item.degree),
        date: escapeLatex(item.date)
      };
    case "project":
      return {
        ...item,
        name: escapeLatex(item.name),
        date: item.date ? escapeLatex(item.date) : null,
        bullets: item.bullets.map((b) => ({
          ...b,
          content: escapeLatex(b.content)
        }))
      };
    case "certification_group":
      return {
        ...item,
        categories: item.categories.map((cat) => ({
          label: escapeLatex(cat.label),
          certs: cat.certs.map((c) => ({
            ...c,
            name: escapeLatex(c.name)
          }))
        }))
      };
    case "clearance":
      return { ...item, content: escapeLatex(item.content) };
    case "presentation":
      return {
        ...item,
        title: escapeLatex(item.title),
        venue: escapeLatex(item.venue),
        date: item.date ? escapeLatex(item.date) : null,
        bullets: item.bullets.map((b) => ({
          ...b,
          content: escapeLatex(b.content)
        }))
      };
    default:
      return item;
  }
}

// src/lib/markdown-linter.ts
function lintMarkdown(content) {
  const errors = [];
  const lines = content.split(`
`);
  const firstNonEmpty = lines.find((l) => l.trim().length > 0);
  if (!firstNonEmpty || !firstNonEmpty.startsWith("# ")) {
    errors.push("Document must begin with a level-1 heading (# Name)");
  }
  for (let i = 0;i < lines.length; i++) {
    const line = lines[i].trim();
    if (i > 0 && line.startsWith("# ") && !line.startsWith("## ") && !line.startsWith("### ")) {
      errors.push(`Line ${i + 1}: Only one level-1 heading allowed. Sections must use ## (H2)`);
    }
  }
  for (let i = 0;i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if ((trimmed.startsWith("* ") || trimmed.startsWith("+ ")) && !trimmed.startsWith("**")) {
      errors.push(`Line ${i + 1}: Bullet items must start with "- " (not "*" or "+")`);
    }
  }
  let consecutiveBlanks = 0;
  for (let i = 0;i < lines.length; i++) {
    if (lines[i].trim().length === 0) {
      consecutiveBlanks++;
      if (consecutiveBlanks > 2) {
        errors.push(`Line ${i + 1}: No more than 2 consecutive blank lines allowed`);
        break;
      }
    } else {
      consecutiveBlanks = 0;
    }
  }
  let inSkillsSection = false;
  for (let i = 0;i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("## ") && line.toLowerCase().includes("skill")) {
      inSkillsSection = true;
      continue;
    }
    if (line.startsWith("## ") && !line.toLowerCase().includes("skill")) {
      inSkillsSection = false;
      continue;
    }
    if (inSkillsSection && line.length > 0 && !line.startsWith("## ")) {
      if (!line.match(/^\*\*[^*]+\*\*\s*:/)) {
        errors.push(`Line ${i + 1}: Skills section items must match "**Label**: content" pattern`);
      }
    }
  }
  if (errors.length === 0) {
    return { ok: true };
  }
  return { ok: false, errors };
}

// src/lib/latex-linter.ts
function lintLatex(content) {
  const errors = [];
  if (!content.includes("\\begin{document}")) {
    errors.push("Document must contain \\begin{document}");
  }
  if (!content.includes("\\end{document}")) {
    errors.push("Document must contain \\end{document}");
  }
  const itemListStarts = (content.match(/\\resumeItemListStart/g) || []).length;
  const itemListEnds = (content.match(/\\resumeItemListEnd/g) || []).length;
  if (itemListStarts !== itemListEnds) {
    errors.push(`Unmatched \\resumeItemListStart/\\resumeItemListEnd: ${itemListStarts} starts, ${itemListEnds} ends`);
  }
  const subHeadingStarts = (content.match(/\\resumeSubHeadingListStart/g) || []).length;
  const subHeadingEnds = (content.match(/\\resumeSubHeadingListEnd/g) || []).length;
  if (subHeadingStarts !== subHeadingEnds) {
    errors.push(`Unmatched \\resumeSubHeadingListStart/\\resumeSubHeadingListEnd: ${subHeadingStarts} starts, ${subHeadingEnds} ends`);
  }
  const lines = content.split(`
`);
  let inTabular = false;
  for (let i = 0;i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("\\begin{tabular"))
      inTabular = true;
    if (line.includes("\\end{tabular"))
      inTabular = false;
    if (line.trimStart().startsWith("%"))
      continue;
    if (line.includes("$"))
      continue;
    if (inTabular || line.includes("tabular") || line.includes("@{"))
      continue;
    if (/(?<!\\)&/.test(line)) {
      errors.push(`Line ${i + 1}: Possibly unescaped '&' (use \\& in text)`);
    }
  }
  if (/\\write18/i.test(content)) {
    errors.push("SECURITY: \\write18 is forbidden (enables shell escape)");
  }
  if (/\\input\s*\{/i.test(content)) {
    const inputMatches = content.match(/\\input\s*\{([^}]+)\}/gi) || [];
    for (const match of inputMatches) {
      if (!match.includes("glyphtounicode")) {
        errors.push(`SECURITY: \\input commands are forbidden (prevents filesystem access): ${match}`);
      }
    }
  }
  if (errors.length === 0) {
    return { ok: true };
  }
  return { ok: false, errors };
}

// src/templates/sb2nov.ts
var sb2nov = {
  preamble: `%-------------------------
% Resume in LaTeX
% Based on sb2nov template (https://github.com/sb2nov/resume)
% Generated by Forge Resume Builder
% License: MIT
%------------------------

\\documentclass[letterpaper,10pt]{article}

\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
% glyphtounicode not needed with tectonic (XeTeX handles Unicode natively)

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\addtolength{\\oddsidemargin}{-0.55in}
\\addtolength{\\evensidemargin}{-0.55in}
\\addtolength{\\textwidth}{1.1in}
\\addtolength{\\topmargin}{-.55in}
\\addtolength{\\textheight}{1.1in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat{\\section}{
  \\vspace{-4pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-5pt}]

% pdfgentounicode not needed with tectonic (XeTeX)

\\newcommand{\\resumeItem}[1]{\\item\\small{#1 \\vspace{-2pt}}}
\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-1pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small #3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-5pt}
}
\\newcommand{\\resumeSubSubheading}[2]{
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\textit{\\small #1} & \\textit{\\small #2} \\\\
    \\end{tabular*}\\vspace{-5pt}
}
\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small #1 & #2 \\\\
    \\end{tabular*}\\vspace{-7pt}
}
\\newcommand{\\resumeSubItem}[1]{\\resumeItem{#1}\\vspace{-4pt}}
\\renewcommand{\\labelitemii}{$\\circ$}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=*]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}
`,
  renderHeader(header) {
    const lines = [];
    lines.push("\\begin{center}");
    lines.push(`    \\textbf{\\Huge \\scshape ${header.name}} \\\\ \\vspace{1pt}`);
    if (header.tagline) {
      lines.push(`    \\small ${header.tagline} \\\\ \\vspace{3pt}`);
    }
    const parts = [];
    if (header.location) {
      parts.push(`\\small ${header.location}`);
    }
    if (header.email) {
      parts.push(`\\href{mailto:${header.email}}{\\underline{${header.email}}}`);
    }
    if (header.phone) {
      const digits = header.phone.replace(/\D/g, "");
      parts.push(`\\href{tel:+${digits}}{\\underline{${header.phone}}}`);
    }
    if (header.linkedin) {
      parts.push(`\\href{${header.linkedin}}{\\underline{LinkedIn}}`);
    }
    if (header.github) {
      parts.push(`\\href{${header.github}}{\\underline{GitHub}}`);
    }
    if (header.website) {
      parts.push(`\\href{${header.website}}{\\underline{Website}}`);
    }
    if (parts.length > 0) {
      lines.push(`    ${parts.join(` $|$
    `)}`);
    }
    lines.push("\\end{center}");
    return lines.join(`
`);
  },
  renderSection(section) {
    switch (section.type) {
      case "summary":
        return renderSummarySection(section);
      case "experience":
        return renderExperienceSection(section);
      case "skills":
        return renderSkillsSection(section);
      case "education":
        return renderEducationSection(section);
      case "projects":
        return renderProjectsSection(section);
      case "certifications":
        return renderCertificationsSection(section);
      case "clearance":
        return renderClearanceSection(section);
      case "presentations":
        return renderPresentationsSection(section);
      default:
        return sb2nov.renderSectionFallback(section);
    }
  },
  renderSectionFallback(section) {
    const lines = [];
    lines.push(`\\section{${section.title}}`);
    lines.push("  \\resumeSubHeadingListStart");
    for (const item of section.items) {
      if ("content" in item && typeof item.content === "string") {
        lines.push(`    \\resumeItem{${item.content}}`);
      }
    }
    lines.push("  \\resumeSubHeadingListEnd");
    return lines.join(`
`);
  },
  footer: `
%-------------------------------------------
\\end{document}
`
};
function renderSummarySection(section) {
  const lines = [];
  lines.push(`\\section{${section.title}}`);
  for (const item of section.items) {
    if (item.kind === "summary") {
      lines.push(item.content);
    }
  }
  return lines.join(`
`);
}
function renderExperienceSection(section) {
  const lines = [];
  lines.push(`\\section{${section.title}}`);
  lines.push("  \\resumeSubHeadingListStart");
  let isFirst = true;
  for (const item of section.items) {
    if (item.kind !== "experience_group")
      continue;
    if (!isFirst)
      lines.push("");
    if (!isFirst)
      lines.push("    \\vspace{5pt}");
    isFirst = false;
    for (let i = 0;i < item.subheadings.length; i++) {
      const sub = item.subheadings[i];
      if (i === 0) {
        lines.push("");
        lines.push(`    \\resumeSubheading`);
        lines.push(`      {${item.organization}}{}`);
        lines.push(`      {${sub.title}}{${sub.date_range}}`);
      } else {
        lines.push("    \\vspace{5pt}");
        lines.push(`    \\resumeSubSubheading`);
        lines.push(`      {${sub.title}}{${sub.date_range}}`);
      }
      lines.push("      \\resumeItemListStart");
      for (const bullet of sub.bullets) {
        lines.push(`        \\resumeItem{${bullet.content}}`);
      }
      lines.push("      \\resumeItemListEnd");
    }
  }
  lines.push("  \\resumeSubHeadingListEnd");
  return lines.join(`
`);
}
function renderSkillsSection(section) {
  const lines = [];
  lines.push(`\\section{${section.title}}`);
  lines.push(" \\begin{itemize}[leftmargin=0.15in, label={}]");
  lines.push("    \\small{\\item{");
  for (const item of section.items) {
    if (item.kind !== "skill_group")
      continue;
    for (const cat of item.categories) {
      lines.push(`     \\textbf{${cat.label}}{: ${cat.skills.join(", ")}} \\\\`);
    }
  }
  lines.push("    }}");
  lines.push(" \\end{itemize}");
  return lines.join(`
`);
}
function renderEducationSection(section) {
  const lines = [];
  lines.push(`\\section{${section.title}}`);
  lines.push("  \\resumeSubHeadingListStart");
  for (const item of section.items) {
    if (item.kind !== "education")
      continue;
    lines.push(`    \\resumeSubheading`);
    lines.push(`      {${item.institution}}{}`);
    lines.push(`      {${item.degree}}{${item.date}}`);
  }
  lines.push("  \\resumeSubHeadingListEnd");
  return lines.join(`
`);
}
function renderProjectsSection(section) {
  const lines = [];
  lines.push(`\\section{${section.title}}`);
  lines.push("  \\resumeSubHeadingListStart");
  for (const item of section.items) {
    if (item.kind !== "project")
      continue;
    lines.push(`    \\resumeProjectHeading`);
    lines.push(`      {\\textbf{${item.name}}}{${item.date ?? ""}}`);
    if (item.bullets.length > 0) {
      lines.push("      \\resumeItemListStart");
      for (const bullet of item.bullets) {
        lines.push(`        \\resumeItem{${bullet.content}}`);
      }
      lines.push("      \\resumeItemListEnd");
    }
  }
  lines.push("  \\resumeSubHeadingListEnd");
  return lines.join(`
`);
}
function renderCertificationsSection(section) {
  const lines = [];
  lines.push(`\\section{${section.title}}`);
  lines.push("  \\begin{itemize}[leftmargin=0.15in, label={}]");
  lines.push("    \\small{\\item{");
  for (const item of section.items) {
    if (item.kind !== "certification_group")
      continue;
    for (const cat of item.categories) {
      const certNames = cat.certs.map((c) => c.name).join(", ");
      lines.push(`     \\textbf{${cat.label}}{: ${certNames}} \\\\`);
    }
  }
  lines.push("    }}");
  lines.push(" \\end{itemize}");
  return lines.join(`
`);
}
function renderClearanceSection(section) {
  const lines = [];
  lines.push(`\\section{${section.title}}`);
  for (const item of section.items) {
    if (item.kind !== "clearance")
      continue;
    lines.push(item.content);
  }
  return lines.join(`
`);
}
function renderPresentationsSection(section) {
  const lines = [];
  lines.push(`\\section{${section.title}}`);
  lines.push("  \\resumeSubHeadingListStart");
  for (const item of section.items) {
    if (item.kind !== "presentation")
      continue;
    const titlePart = `\\textbf{\`\`${item.title}''}`;
    const venuePart = item.venue ? ` $|$ \\emph{${item.venue}${item.date ? `, ${item.date}` : ""}}` : "";
    lines.push(`    \\resumeProjectHeading`);
    lines.push(`      {${titlePart}${venuePart}}{}`);
    if (item.bullets.length > 0) {
      lines.push("      \\resumeItemListStart");
      for (const bullet of item.bullets) {
        lines.push(`        \\resumeItem{${bullet.content}}`);
      }
      lines.push("      \\resumeItemListEnd");
    }
  }
  lines.push("  \\resumeSubHeadingListEnd");
  return lines.join(`
`);
}

// src/services/resume-service.ts
var tectonicAvailable = null;
async function checkTectonic() {
  if (tectonicAvailable !== null)
    return tectonicAvailable;
  try {
    const proc = Bun.spawnSync(["which", "tectonic"], { stdout: "pipe", stderr: "pipe" });
    tectonicAvailable = proc.exitCode === 0;
  } catch {
    tectonicAvailable = false;
  }
  if (!tectonicAvailable) {
    console.warn("[forge] tectonic not found \u2014 PDF generation will be unavailable");
  }
  return tectonicAvailable;
}

class ResumeService {
  db;
  constructor(db) {
    this.db = db;
  }
  createResume(input) {
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Name must not be empty" } };
    }
    if (!input.target_role || input.target_role.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Target role must not be empty" } };
    }
    if (!input.target_employer || input.target_employer.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Target employer must not be empty" } };
    }
    if (!input.archetype || input.archetype.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Archetype must not be empty" } };
    }
    const resume = ResumeRepository.create(this.db, input);
    return { ok: true, data: resume };
  }
  getResume(id) {
    const resume = ResumeRepository.getWithEntries(this.db, id);
    if (!resume) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Resume ${id} not found` } };
    }
    return { ok: true, data: resume };
  }
  listResumes(offset = 0, limit = 50) {
    const result = ResumeRepository.list(this.db, offset, limit);
    return {
      ok: true,
      data: result.data,
      pagination: { total: result.total, offset, limit }
    };
  }
  updateResume(id, input) {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Name must not be empty" } };
    }
    const resume = ResumeRepository.update(this.db, id, input);
    if (!resume) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Resume ${id} not found` } };
    }
    return { ok: true, data: resume };
  }
  deleteResume(id) {
    const deleted = ResumeRepository.delete(this.db, id);
    if (!deleted) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Resume ${id} not found` } };
    }
    return { ok: true, data: undefined };
  }
  addEntry(resumeId, input) {
    const resume = ResumeRepository.get(this.db, resumeId);
    if (!resume) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Resume ${resumeId} not found` } };
    }
    const perspective = PerspectiveRepository.get(this.db, input.perspective_id);
    if (!perspective) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Perspective ${input.perspective_id} not found` } };
    }
    if (perspective.status !== "approved") {
      return {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Only approved perspectives can be added to resumes" }
      };
    }
    try {
      const entry = ResumeRepository.addEntry(this.db, resumeId, input);
      return { ok: true, data: entry };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("UNIQUE constraint")) {
        return { ok: false, error: { code: "CONFLICT", message: "Perspective already in this resume" } };
      }
      throw err;
    }
  }
  updateEntry(resumeId, entryId, input) {
    const resume = ResumeRepository.get(this.db, resumeId);
    if (!resume) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Resume ${resumeId} not found` } };
    }
    const entry = ResumeRepository.updateEntry(this.db, entryId, input);
    if (!entry) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Entry not found" } };
    }
    if (entry.resume_id !== resumeId) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Entry not found in this resume" } };
    }
    return { ok: true, data: entry };
  }
  removeEntry(resumeId, entryId) {
    const removed = ResumeRepository.removeEntry(this.db, resumeId, entryId);
    if (!removed) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Entry not found in this resume" } };
    }
    return { ok: true, data: undefined };
  }
  reorderEntries(resumeId, entries) {
    const resume = ResumeRepository.get(this.db, resumeId);
    if (!resume) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Resume ${resumeId} not found` } };
    }
    const existing = ResumeRepository.getWithEntries(this.db, resumeId);
    if (!existing) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Resume ${resumeId} not found` } };
    }
    const existingIds = new Set;
    for (const section of Object.values(existing.sections)) {
      for (const e of section) {
        existingIds.add(e.id);
      }
    }
    for (const item of entries) {
      if (!existingIds.has(item.id)) {
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: `Entry ${item.id} is not in this resume`
          }
        };
      }
    }
    ResumeRepository.reorderEntries(this.db, resumeId, entries);
    return { ok: true, data: undefined };
  }
  analyzeGaps(resumeId) {
    const resume = ResumeRepository.getWithEntries(this.db, resumeId);
    if (!resume) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Resume ${resumeId} not found` } };
    }
    const includedDomains = new Map;
    let perspectivesIncluded = 0;
    for (const section of Object.values(resume.sections)) {
      for (const entry of section) {
        perspectivesIncluded++;
        const perspective = PerspectiveRepository.get(this.db, entry.perspective_id);
        if (perspective?.domain) {
          includedDomains.set(perspective.domain, (includedDomains.get(perspective.domain) ?? 0) + 1);
        }
      }
    }
    const expectedDomains = getExpectedDomainNames(this.db, resume.archetype);
    const allForArchetype = PerspectiveRepository.list(this.db, {
      target_archetype: resume.archetype,
      status: "approved"
    }, 0, 1e4);
    const gaps = [];
    for (const domain of expectedDomains) {
      const count = includedDomains.get(domain) ?? 0;
      if (count === 0) {
        const availableBullets = this.findBulletsForGap(resume.archetype, domain);
        gaps.push({
          type: "missing_domain_coverage",
          domain,
          description: `No approved perspectives with domain '${domain}' are included in this resume`,
          available_bullets: availableBullets,
          recommendation: `Derive perspectives with domain '${domain}' from these bullets`
        });
      } else if (count < THIN_COVERAGE_THRESHOLD) {
        gaps.push({
          type: "thin_coverage",
          domain,
          current_count: count,
          description: `Only ${count} perspective with domain '${domain}' \u2014 consider adding more`,
          recommendation: `Review approved bullets for additional ${domain} framing opportunities`
        });
      }
    }
    const allApproved = BulletRepository.list(this.db, { status: "approved" }, 0, 1e4);
    for (const bullet of allApproved.data) {
      const perspectivesForBullet = PerspectiveRepository.list(this.db, {
        bullet_id: bullet.id,
        target_archetype: resume.archetype,
        status: "approved"
      }, 0, 1);
      if (perspectivesForBullet.data.length === 0) {
        const sourceTitle = this.getSourceTitleForBullet(bullet.id);
        gaps.push({
          type: "unused_bullet",
          bullet_id: bullet.id,
          bullet_content: bullet.content,
          source_title: sourceTitle,
          description: `This approved bullet has no perspective for archetype '${resume.archetype}'`,
          recommendation: `Derive a perspective targeting '${resume.archetype}' archetype`
        });
      }
    }
    const domainsRepresented = [...includedDomains.keys()];
    const domainsMissing = expectedDomains.filter((d) => !includedDomains.has(d));
    return {
      ok: true,
      data: {
        resume_id: resumeId,
        archetype: resume.archetype,
        target_role: resume.target_role,
        target_employer: resume.target_employer,
        gaps,
        coverage_summary: {
          perspectives_included: perspectivesIncluded,
          total_approved_perspectives_for_archetype: allForArchetype.data.length,
          domains_represented: domainsRepresented,
          domains_missing: domainsMissing
        }
      }
    };
  }
  getIR(id) {
    const ir = compileResumeIR(this.db, id);
    if (!ir) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Resume ${id} not found` } };
    }
    return { ok: true, data: ir };
  }
  updateHeader(id, header) {
    if (!header.name || typeof header.name !== "string" || header.name.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Header name must not be empty" } };
    }
    const resume = ResumeRepository.updateHeader(this.db, id, header);
    if (!resume)
      return { ok: false, error: { code: "NOT_FOUND", message: `Resume ${id} not found` } };
    return { ok: true, data: resume };
  }
  updateMarkdownOverride(id, content) {
    if (content !== null) {
      const lint = lintMarkdown(content);
      if (!lint.ok) {
        return { ok: false, error: { code: "VALIDATION_ERROR", message: `Markdown lint errors: ${lint.errors.join("; ")}` } };
      }
    }
    const resume = ResumeRepository.updateMarkdownOverride(this.db, id, content);
    if (!resume)
      return { ok: false, error: { code: "NOT_FOUND", message: `Resume ${id} not found` } };
    return { ok: true, data: resume };
  }
  updateLatexOverride(id, content) {
    if (content !== null) {
      const lint = lintLatex(content);
      if (!lint.ok) {
        return { ok: false, error: { code: "VALIDATION_ERROR", message: `LaTeX lint errors: ${lint.errors.join("; ")}` } };
      }
    }
    const resume = ResumeRepository.updateLatexOverride(this.db, id, content);
    if (!resume)
      return { ok: false, error: { code: "NOT_FOUND", message: `Resume ${id} not found` } };
    return { ok: true, data: resume };
  }
  async generatePDF(id, latex) {
    if (!await checkTectonic()) {
      return { ok: false, error: { code: "TECTONIC_NOT_AVAILABLE", message: "tectonic is not installed. Install it for PDF generation." } };
    }
    let latexContent = latex;
    if (!latexContent) {
      const resume = ResumeRepository.get(this.db, id);
      if (!resume)
        return { ok: false, error: { code: "NOT_FOUND", message: `Resume ${id} not found` } };
      if (resume.latex_override) {
        latexContent = resume.latex_override;
      } else {
        const ir = compileResumeIR(this.db, id);
        if (!ir)
          return { ok: false, error: { code: "NOT_FOUND", message: `Resume ${id} not found` } };
        latexContent = compileToLatex(ir, sb2nov);
      }
    }
    const tmpDir = "/tmp";
    const uuid = crypto.randomUUID();
    const texPath = `${tmpDir}/forge-pdf-${uuid}.tex`;
    const pdfPath = `${tmpDir}/forge-pdf-${uuid}.pdf`;
    try {
      await Bun.write(texPath, latexContent);
      const proc = Bun.spawn(["tectonic", texPath], { cwd: tmpDir, stdout: "pipe", stderr: "pipe" });
      const timeout = setTimeout(() => {
        proc.kill();
      }, 60000);
      const exitCode = await proc.exited;
      clearTimeout(timeout);
      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        if (proc.killed) {
          return { ok: false, error: { code: "TECTONIC_TIMEOUT", message: "PDF compilation timed out after 60 seconds" } };
        }
        return {
          ok: false,
          error: {
            code: "LATEX_COMPILE_ERROR",
            message: "LaTeX compilation failed",
            details: { tectonic_stderr: stderr.slice(-2000) }
          }
        };
      }
      const pdfBytes = await Bun.file(pdfPath).arrayBuffer();
      return { ok: true, data: Buffer.from(pdfBytes) };
    } finally {
      try {
        const { unlinkSync } = await import("fs");
        try {
          unlinkSync(texPath);
        } catch {}
        try {
          unlinkSync(pdfPath);
        } catch {}
        try {
          unlinkSync(`${tmpDir}/forge-pdf-${uuid}.log`);
        } catch {}
        try {
          unlinkSync(`${tmpDir}/forge-pdf-${uuid}.aux`);
        } catch {}
      } catch {}
    }
  }
  findBulletsForGap(archetype, domain) {
    const rows = this.db.query(`SELECT b.id, b.content, s.title AS source_title
         FROM bullets b
         JOIN bullet_sources bs ON b.id = bs.bullet_id AND bs.is_primary = 1
         JOIN sources s ON bs.source_id = s.id
         WHERE b.status = 'approved'
         AND b.id NOT IN (
           SELECT p.bullet_id FROM perspectives p
           WHERE p.target_archetype = ?
           AND p.domain = ?
           AND p.status = 'approved'
         )`).all(archetype, domain);
    return rows;
  }
  getSourceTitleForBullet(bulletId) {
    const row = this.db.query(`SELECT s.title FROM sources s
         JOIN bullet_sources bs ON s.id = bs.source_id
         WHERE bs.bullet_id = ? AND bs.is_primary = 1`).get(bulletId);
    return row?.title ?? "Unknown Source";
  }
}

// src/services/audit-service.ts
class AuditService {
  db;
  constructor(db) {
    this.db = db;
  }
  traceChain(perspectiveId) {
    const perspective = PerspectiveRepository.get(this.db, perspectiveId);
    if (!perspective) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Perspective ${perspectiveId} not found` } };
    }
    const bullet = BulletRepository.get(this.db, perspective.bullet_id);
    if (!bullet) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Bullet ${perspective.bullet_id} not found (chain broken)` } };
    }
    const primarySource = BulletRepository.getPrimarySource(this.db, bullet.id);
    if (!primarySource) {
      return { ok: false, error: { code: "NOT_FOUND", message: `No primary source for bullet ${bullet.id} (chain broken)` } };
    }
    const source = get(this.db, primarySource.id);
    if (!source) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Source ${primarySource.id} not found (chain broken)` } };
    }
    return { ok: true, data: { perspective, bullet, source } };
  }
  checkIntegrity(perspectiveId) {
    const chain = this.traceChain(perspectiveId);
    if (!chain.ok)
      return chain;
    const { perspective, bullet, source } = chain.data;
    const bulletSnapshotMatches = perspective.bullet_content_snapshot === bullet.content;
    const sourceSnapshotMatches = bullet.source_content_snapshot === source.description;
    const report = {
      perspective_id: perspectiveId,
      bullet_snapshot_matches: bulletSnapshotMatches,
      source_snapshot_matches: sourceSnapshotMatches
    };
    if (!bulletSnapshotMatches) {
      report.bullet_diff = {
        snapshot: perspective.bullet_content_snapshot,
        current: bullet.content
      };
    }
    if (!sourceSnapshotMatches) {
      report.source_diff = {
        snapshot: bullet.source_content_snapshot,
        current: source.description
      };
    }
    return { ok: true, data: report };
  }
}

// src/services/review-service.ts
class ReviewService {
  db;
  constructor(db) {
    this.db = db;
  }
  getPendingReview() {
    const bulletRows = this.db.query(`SELECT b.*, s.title AS source_title
         FROM bullets b
         JOIN bullet_sources bs ON b.id = bs.bullet_id AND bs.is_primary = 1
         JOIN sources s ON bs.source_id = s.id
         WHERE b.status = 'pending_review'
         ORDER BY b.created_at DESC`).all();
    const bullets = bulletRows.map((row) => ({
      id: row.id,
      content: row.content,
      source_content_snapshot: row.source_content_snapshot,
      technologies: [],
      metrics: row.metrics,
      domain: row.domain,
      status: row.status,
      rejection_reason: row.rejection_reason,
      prompt_log_id: row.prompt_log_id,
      approved_at: row.approved_at,
      approved_by: row.approved_by,
      notes: row.notes,
      created_at: row.created_at,
      source_title: row.source_title
    }));
    for (const bullet of bullets) {
      const techRows = this.db.query("SELECT technology FROM bullet_technologies WHERE bullet_id = ? ORDER BY technology").all(bullet.id);
      bullet.technologies = techRows.map((r) => r.technology);
    }
    const perspectiveRows = this.db.query(`SELECT p.*, b.content AS bullet_content, s.title AS source_title
         FROM perspectives p
         JOIN bullets b ON p.bullet_id = b.id
         JOIN bullet_sources bs ON b.id = bs.bullet_id AND bs.is_primary = 1
         JOIN sources s ON bs.source_id = s.id
         WHERE p.status = 'pending_review'
         ORDER BY p.created_at DESC`).all();
    const perspectives = perspectiveRows.map((row) => ({
      id: row.id,
      bullet_id: row.bullet_id,
      content: row.content,
      bullet_content_snapshot: row.bullet_content_snapshot,
      target_archetype: row.target_archetype,
      domain: row.domain,
      framing: row.framing,
      status: row.status,
      rejection_reason: row.rejection_reason,
      prompt_log_id: row.prompt_log_id,
      approved_at: row.approved_at,
      approved_by: row.approved_by,
      created_at: row.created_at,
      bullet_content: row.bullet_content,
      source_title: row.source_title
    }));
    return {
      ok: true,
      data: {
        bullets: { count: bullets.length, items: bullets },
        perspectives: { count: perspectives.length, items: perspectives }
      }
    };
  }
}

// src/db/repositories/organization-repository.ts
function create5(db, input) {
  const id = crypto.randomUUID();
  const row = db.query(`INSERT INTO organizations (id, name, org_type, industry, size, worked, employment_type, location, headquarters, website, linkedin_url, glassdoor_url, glassdoor_rating, reputation_notes, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`).get(id, input.name, input.org_type ?? "company", input.industry ?? null, input.size ?? null, input.worked ?? 0, input.employment_type ?? null, input.location ?? null, input.headquarters ?? null, input.website ?? null, input.linkedin_url ?? null, input.glassdoor_url ?? null, input.glassdoor_rating ?? null, input.reputation_notes ?? null, input.notes ?? null, input.status ?? null);
  return row;
}
function get4(db, id) {
  return db.query("SELECT * FROM organizations WHERE id = ?").get(id) ?? null;
}
function list4(db, filter, offset = 0, limit = 50) {
  const conditions = [];
  const params = [];
  if (filter?.org_type !== undefined) {
    conditions.push("org_type = ?");
    params.push(filter.org_type);
  }
  if (filter?.worked !== undefined) {
    conditions.push("worked = ?");
    params.push(filter.worked);
  }
  if (filter?.status !== undefined) {
    conditions.push("status = ?");
    params.push(filter.status);
  }
  if (filter?.search !== undefined) {
    conditions.push("name LIKE ?");
    params.push(`%${filter.search}%`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const countRow = db.query(`SELECT COUNT(*) AS total FROM organizations ${where}`).get(...params);
  const dataParams = [...params, limit, offset];
  const rows = db.query(`SELECT * FROM organizations ${where} ORDER BY name ASC LIMIT ? OFFSET ?`).all(...dataParams);
  return { data: rows, total: countRow.total };
}
function update4(db, id, input) {
  const existing = get4(db, id);
  if (!existing)
    return null;
  const sets = [];
  const params = [];
  if (input.name !== undefined) {
    sets.push("name = ?");
    params.push(input.name);
  }
  if (input.org_type !== undefined) {
    sets.push("org_type = ?");
    params.push(input.org_type);
  }
  if (input.industry !== undefined) {
    sets.push("industry = ?");
    params.push(input.industry);
  }
  if (input.size !== undefined) {
    sets.push("size = ?");
    params.push(input.size);
  }
  if (input.worked !== undefined) {
    sets.push("worked = ?");
    params.push(input.worked);
  }
  if (input.employment_type !== undefined) {
    sets.push("employment_type = ?");
    params.push(input.employment_type);
  }
  if (input.location !== undefined) {
    sets.push("location = ?");
    params.push(input.location);
  }
  if (input.headquarters !== undefined) {
    sets.push("headquarters = ?");
    params.push(input.headquarters);
  }
  if (input.website !== undefined) {
    sets.push("website = ?");
    params.push(input.website);
  }
  if (input.linkedin_url !== undefined) {
    sets.push("linkedin_url = ?");
    params.push(input.linkedin_url);
  }
  if (input.glassdoor_url !== undefined) {
    sets.push("glassdoor_url = ?");
    params.push(input.glassdoor_url);
  }
  if (input.glassdoor_rating !== undefined) {
    sets.push("glassdoor_rating = ?");
    params.push(input.glassdoor_rating);
  }
  if (input.reputation_notes !== undefined) {
    sets.push("reputation_notes = ?");
    params.push(input.reputation_notes);
  }
  if (input.notes !== undefined) {
    sets.push("notes = ?");
    params.push(input.notes);
  }
  if (input.status !== undefined) {
    sets.push("status = ?");
    params.push(input.status);
  }
  if (sets.length === 0) {
    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
  } else {
    sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
  }
  params.push(id);
  const row = db.query(`UPDATE organizations SET ${sets.join(", ")} WHERE id = ? RETURNING *`).get(...params);
  return row ?? null;
}
function del4(db, id) {
  const result = db.run("DELETE FROM organizations WHERE id = ?", [id]);
  return result.changes > 0;
}

// src/services/organization-service.ts
var VALID_ORG_TYPES = ["company", "nonprofit", "government", "military", "education", "volunteer", "freelance", "other"];
var VALID_STATUSES = ["interested", "review", "targeting", "excluded"];

class OrganizationService {
  db;
  constructor(db) {
    this.db = db;
  }
  create(input) {
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Name must not be empty" } };
    }
    if (input.org_type && !VALID_ORG_TYPES.includes(input.org_type)) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: `Invalid org_type: ${input.org_type}. Must be one of: ${VALID_ORG_TYPES.join(", ")}` } };
    }
    if (input.status !== undefined && input.status !== null && !VALID_STATUSES.includes(input.status)) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: `Invalid status: ${input.status}. Must be one of: ${VALID_STATUSES.join(", ")}` } };
    }
    const org = create5(this.db, input);
    return { ok: true, data: org };
  }
  get(id) {
    const org = get4(this.db, id);
    if (!org) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Organization ${id} not found` } };
    }
    return { ok: true, data: org };
  }
  list(filter, offset, limit) {
    const result = list4(this.db, filter, offset, limit);
    return { ok: true, data: result.data, pagination: { total: result.total, offset: offset ?? 0, limit: limit ?? 50 } };
  }
  update(id, input) {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Name must not be empty" } };
    }
    if (input.org_type && !VALID_ORG_TYPES.includes(input.org_type)) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: `Invalid org_type: ${input.org_type}` } };
    }
    if (input.status !== undefined && input.status !== null && !VALID_STATUSES.includes(input.status)) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: `Invalid status: ${input.status}. Must be one of: ${VALID_STATUSES.join(", ")}` } };
    }
    const org = update4(this.db, id, input);
    if (!org) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Organization ${id} not found` } };
    }
    return { ok: true, data: org };
  }
  delete(id) {
    const deleted = del4(this.db, id);
    if (!deleted) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Organization ${id} not found` } };
    }
    return { ok: true, data: undefined };
  }
}

// src/db/repositories/note-repository.ts
function create6(db, input) {
  const id = crypto.randomUUID();
  const row = db.query(`INSERT INTO user_notes (id, title, content)
       VALUES (?, ?, ?)
       RETURNING *`).get(id, input.title ?? null, input.content);
  return row;
}
function get5(db, id) {
  return db.query("SELECT * FROM user_notes WHERE id = ?").get(id) ?? null;
}
function getWithReferences(db, id) {
  const note = get5(db, id);
  if (!note)
    return null;
  const refs = db.query("SELECT * FROM note_references WHERE note_id = ?").all(id);
  return { ...note, references: refs };
}
function list5(db, search, offset = 0, limit = 50) {
  if (search) {
    const pattern = `%${search}%`;
    const countRow2 = db.query(`SELECT COUNT(*) AS total FROM user_notes
         WHERE content LIKE ? OR title LIKE ?`).get(pattern, pattern);
    const rows2 = db.query(`SELECT * FROM user_notes
         WHERE content LIKE ? OR title LIKE ?
         ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(pattern, pattern, limit, offset);
    return { data: rows2, total: countRow2.total };
  }
  const countRow = db.query("SELECT COUNT(*) AS total FROM user_notes").get();
  const rows = db.query("SELECT * FROM user_notes ORDER BY updated_at DESC LIMIT ? OFFSET ?").all(limit, offset);
  return { data: rows, total: countRow.total };
}
function update5(db, id, input) {
  const existing = get5(db, id);
  if (!existing)
    return null;
  const sets = [];
  const params = [];
  if (input.title !== undefined) {
    sets.push("title = ?");
    params.push(input.title);
  }
  if (input.content !== undefined) {
    sets.push("content = ?");
    params.push(input.content);
  }
  sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
  params.push(id);
  const row = db.query(`UPDATE user_notes SET ${sets.join(", ")} WHERE id = ? RETURNING *`).get(...params);
  return row ?? null;
}
function del5(db, id) {
  const result = db.run("DELETE FROM user_notes WHERE id = ?", [id]);
  return result.changes > 0;
}
function addReference(db, noteId, entityType, entityId) {
  db.run(`INSERT INTO note_references (note_id, entity_type, entity_id)
     VALUES (?, ?, ?)`, [noteId, entityType, entityId]);
}
function removeReference(db, noteId, entityType, entityId) {
  const result = db.run("DELETE FROM note_references WHERE note_id = ? AND entity_type = ? AND entity_id = ?", [noteId, entityType, entityId]);
  return result.changes > 0;
}
function getByEntity(db, entityType, entityId) {
  return db.query(`SELECT un.* FROM user_notes un
       JOIN note_references nr ON un.id = nr.note_id
       WHERE nr.entity_type = ? AND nr.entity_id = ?
       ORDER BY un.updated_at DESC`).all(entityType, entityId);
}

// src/services/note-service.ts
var VALID_ENTITY_TYPES = ["source", "bullet", "perspective", "resume_entry", "resume", "skill", "organization"];

class NoteService {
  db;
  constructor(db) {
    this.db = db;
  }
  create(input) {
    if (!input.content || input.content.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Content must not be empty" } };
    }
    const note = create6(this.db, input);
    return { ok: true, data: note };
  }
  get(id) {
    const note = getWithReferences(this.db, id);
    if (!note) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Note ${id} not found` } };
    }
    return { ok: true, data: note };
  }
  list(search, offset, limit) {
    const result = list5(this.db, search, offset, limit);
    return { ok: true, data: result.data, pagination: { total: result.total, offset: offset ?? 0, limit: limit ?? 50 } };
  }
  update(id, input) {
    if (input.content !== undefined && input.content.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Content must not be empty" } };
    }
    const note = update5(this.db, id, input);
    if (!note) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Note ${id} not found` } };
    }
    return { ok: true, data: note };
  }
  delete(id) {
    const deleted = del5(this.db, id);
    if (!deleted) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Note ${id} not found` } };
    }
    return { ok: true, data: undefined };
  }
  addReference(noteId, entityType, entityId) {
    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: `Invalid entity_type: ${entityType}. Must be one of: ${VALID_ENTITY_TYPES.join(", ")}` } };
    }
    const note = get5(this.db, noteId);
    if (!note) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Note ${noteId} not found` } };
    }
    addReference(this.db, noteId, entityType, entityId);
    return { ok: true, data: undefined };
  }
  removeReference(noteId, entityType, entityId) {
    const removed = removeReference(this.db, noteId, entityType, entityId);
    if (!removed) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Reference not found" } };
    }
    return { ok: true, data: undefined };
  }
  getNotesForEntity(entityType, entityId) {
    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: `Invalid entity_type: ${entityType}` } };
    }
    const notes = getByEntity(this.db, entityType, entityId);
    return { ok: true, data: notes };
  }
}

// src/services/integrity-service.ts
class IntegrityService {
  db;
  constructor(db) {
    this.db = db;
  }
  getDriftedEntities() {
    const drifted = [];
    const bulletDrifts = this.db.query(`SELECT b.id AS bullet_id, b.source_content_snapshot, s.description AS current_description
         FROM bullets b
         JOIN bullet_sources bs ON b.id = bs.bullet_id AND bs.is_primary = 1
         JOIN sources s ON bs.source_id = s.id
         WHERE b.source_content_snapshot != s.description`).all();
    for (const row of bulletDrifts) {
      drifted.push({
        entity_type: "bullet",
        entity_id: row.bullet_id,
        snapshot_field: "source_content_snapshot",
        snapshot_value: row.source_content_snapshot,
        current_value: row.current_description
      });
    }
    const perspectiveDrifts = this.db.query(`SELECT p.id AS perspective_id, p.bullet_content_snapshot, b.content AS current_content
         FROM perspectives p
         JOIN bullets b ON p.bullet_id = b.id
         WHERE p.bullet_content_snapshot != b.content`).all();
    for (const row of perspectiveDrifts) {
      drifted.push({
        entity_type: "perspective",
        entity_id: row.perspective_id,
        snapshot_field: "bullet_content_snapshot",
        snapshot_value: row.bullet_content_snapshot,
        current_value: row.current_content
      });
    }
    return { ok: true, data: drifted };
  }
}

// src/services/domain-service.ts
class DomainService {
  db;
  constructor(db) {
    this.db = db;
  }
  create(input) {
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Name must not be empty" } };
    }
    if (!/^[a-z][a-z0-9_]*$/.test(input.name)) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Domain name must be lowercase, start with a letter, and contain only letters, digits, and underscores"
        }
      };
    }
    try {
      const domain = create4(this.db, input);
      return { ok: true, data: domain };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("UNIQUE constraint")) {
        return { ok: false, error: { code: "CONFLICT", message: `Domain '${input.name}' already exists` } };
      }
      throw err;
    }
  }
  get(id) {
    const domain = get3(this.db, id);
    if (!domain) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Domain ${id} not found` } };
    }
    return { ok: true, data: domain };
  }
  list(offset, limit) {
    const result = list3(this.db, offset, limit);
    return {
      ok: true,
      data: result.data,
      pagination: { total: result.total, offset: offset ?? 0, limit: limit ?? 50 }
    };
  }
  update(id, input) {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Name must not be empty" } };
    }
    if (input.name !== undefined && !/^[a-z][a-z0-9_]*$/.test(input.name)) {
      return {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Domain name must be lowercase with underscores only" }
      };
    }
    try {
      const domain = update3(this.db, id, input);
      if (!domain) {
        return { ok: false, error: { code: "NOT_FOUND", message: `Domain ${id} not found` } };
      }
      return { ok: true, data: domain };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("UNIQUE constraint")) {
        return { ok: false, error: { code: "CONFLICT", message: `Domain '${input.name}' already exists` } };
      }
      throw err;
    }
  }
  delete(id) {
    const domain = get3(this.db, id);
    if (!domain) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Domain ${id} not found` } };
    }
    const refs = countReferences2(this.db, id);
    if (refs.perspective_count > 0) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: `Cannot delete domain '${domain.name}': referenced by ${refs.perspective_count} perspective(s)`
        }
      };
    }
    if (refs.archetype_count > 0) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: `Cannot delete domain '${domain.name}': associated with ${refs.archetype_count} archetype(s)`
        }
      };
    }
    del3(this.db, id);
    return { ok: true, data: undefined };
  }
}

// src/services/archetype-service.ts
class ArchetypeService {
  db;
  constructor(db) {
    this.db = db;
  }
  create(input) {
    if (!input.name || input.name.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Name must not be empty" } };
    }
    if (!/^[a-z][a-z0-9-]*$/.test(input.name)) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Archetype name must be lowercase, start with a letter, and contain only letters, digits, and hyphens"
        }
      };
    }
    try {
      const archetype = create3(this.db, input);
      return { ok: true, data: archetype };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("UNIQUE constraint")) {
        return { ok: false, error: { code: "CONFLICT", message: `Archetype '${input.name}' already exists` } };
      }
      throw err;
    }
  }
  get(id) {
    const archetype = get2(this.db, id);
    if (!archetype) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Archetype ${id} not found` } };
    }
    return { ok: true, data: archetype };
  }
  getWithDomains(id) {
    const archetype = getWithDomains(this.db, id);
    if (!archetype) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Archetype ${id} not found` } };
    }
    return { ok: true, data: archetype };
  }
  list(offset, limit) {
    const result = list2(this.db, offset, limit);
    return {
      ok: true,
      data: result.data,
      pagination: { total: result.total, offset: offset ?? 0, limit: limit ?? 50 }
    };
  }
  update(id, input) {
    if (input.name !== undefined && input.name.trim().length === 0) {
      return { ok: false, error: { code: "VALIDATION_ERROR", message: "Name must not be empty" } };
    }
    if (input.name !== undefined && !/^[a-z][a-z0-9-]*$/.test(input.name)) {
      return {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "Archetype name must be lowercase with hyphens only" }
      };
    }
    try {
      const archetype = update2(this.db, id, input);
      if (!archetype) {
        return { ok: false, error: { code: "NOT_FOUND", message: `Archetype ${id} not found` } };
      }
      return { ok: true, data: archetype };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("UNIQUE constraint")) {
        return { ok: false, error: { code: "CONFLICT", message: `Archetype '${input.name}' already exists` } };
      }
      throw err;
    }
  }
  delete(id) {
    const archetype = get2(this.db, id);
    if (!archetype) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Archetype ${id} not found` } };
    }
    const refs = countReferences(this.db, id);
    if (refs.resume_count > 0) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: `Cannot delete archetype '${archetype.name}': referenced by ${refs.resume_count} resume(s)`
        }
      };
    }
    if (refs.perspective_count > 0) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: `Cannot delete archetype '${archetype.name}': referenced by ${refs.perspective_count} perspective(s)`
        }
      };
    }
    del2(this.db, id);
    return { ok: true, data: undefined };
  }
  addDomain(archetypeId, domainId) {
    const archetype = get2(this.db, archetypeId);
    if (!archetype) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Archetype ${archetypeId} not found` } };
    }
    const domain = get3(this.db, domainId);
    if (!domain) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Domain ${domainId} not found` } };
    }
    try {
      addDomain(this.db, archetypeId, domainId);
      return { ok: true, data: undefined };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("UNIQUE constraint") || message.includes("PRIMARY KEY")) {
        return { ok: false, error: { code: "CONFLICT", message: "Domain already associated with this archetype" } };
      }
      throw err;
    }
  }
  removeDomain(archetypeId, domainId) {
    const removed = removeDomain(this.db, archetypeId, domainId);
    if (!removed) {
      return { ok: false, error: { code: "NOT_FOUND", message: "Domain association not found" } };
    }
    return { ok: true, data: undefined };
  }
  listDomains(archetypeId) {
    const archetype = get2(this.db, archetypeId);
    if (!archetype) {
      return { ok: false, error: { code: "NOT_FOUND", message: `Archetype ${archetypeId} not found` } };
    }
    const domains = listDomains(this.db, archetypeId);
    return { ok: true, data: domains };
  }
}

// src/services/index.ts
function createServices(db) {
  const derivingBullets = new Set;
  return {
    sources: new SourceService(db),
    bullets: new BulletService(db),
    perspectives: new PerspectiveService(db),
    derivation: new DerivationService(db, derivingBullets),
    resumes: new ResumeService(db),
    audit: new AuditService(db),
    review: new ReviewService(db),
    organizations: new OrganizationService(db),
    notes: new NoteService(db),
    integrity: new IntegrityService(db),
    domains: new DomainService(db),
    archetypes: new ArchetypeService(db)
  };
}

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || undefined;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/utils/body.js
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
};
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== undefined) {
    if (Array.isArray(form[key])) {
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match, index) => {
    const mark = `@${index}`;
    groups.push([mark, match]);
    return mark;
  });
  return { groups, path };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1;i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1;j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match[1], new RegExp(`^${match[2]}(?=/${next})`)] : [label, match[1], new RegExp(`^${match[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match) => {
      try {
        return decoder(match);
      } catch {
        return match;
      }
    });
  }
};
var tryDecodeURI = (str) => tryDecode(str, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (;i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? undefined : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var _decodeURI = (value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
};
var _getQueryParam = (url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? undefined : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(keyIndex + 1, valueIndex === -1 ? nextKeyIndex === -1 ? undefined : nextKeyIndex : valueIndex);
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? undefined : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/request.js
var tryDecodeURIComponent = (str) => tryDecode(str, decodeURIComponent_);
var HonoRequest = class {
  raw;
  #validatedData;
  #matchResult;
  routeIndex = 0;
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== undefined) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? undefined;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw[key]();
  };
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  text() {
    return this.#cachedBody("text");
  }
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  blob() {
    return this.#cachedBody("blob");
  }
  formData() {
    return this.#cachedBody("formData");
  }
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  get url() {
    return this.raw.url;
  }
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then((res) => Promise.all(res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))).then(() => buffer[0]));
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
};

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  env = {};
  #var;
  finalized = false;
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers
    });
  }
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  setLayout = (layout) => this.#layout = layout;
  getLayout = () => this.#layout;
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers;
    if (value === undefined) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map;
    this.#var.set(key, value);
  };
  get = (key) => {
    return this.#var ? this.#var.get(key) : undefined;
  };
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers;
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = (...args) => this.#newResponse(...args);
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(text, arg, setDefaultContentType(TEXT_PLAIN, headers));
  };
  json = (object, arg, headers) => {
    return this.#newResponse(JSON.stringify(object), arg, setDefaultContentType("application/json", headers));
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  redirect = (location, status) => {
    const locationString = String(location);
    this.header("Location", !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString));
    return this.newResponse(null, status ?? 302);
  };
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono = class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  router;
  getPath;
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  errorHandler = errorHandler;
  route(path, app) {
    const subApp = this.basePath(path);
    app.routes.map((r) => {
      let handler;
      if (app.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = async (c, next) => (await compose([], app.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request) => request;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = undefined;
      try {
        executionContext = c.executionCtx;
      } catch {}
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then((resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(new Request(/^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`, requestInit), Env, executionCtx);
  };
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, undefined, event.request.method));
    });
  };
};

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = (method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  };
  this.match = match2;
  return match2(method, path);
}

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class _Node {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== undefined) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some((k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR)) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node;
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some((k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR)) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node;
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node;
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0;; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1;i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1;j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== undefined) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== undefined) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(path === "*" ? "" : `^${path.replace(/\/\*$|([.\\+*[^\]$()])/g, (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)")}$`);
}
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie;
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map((route) => [!/\*|\/:/.test(route[0]), ...route]).sort(([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length);
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length;i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (;paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length;i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length;j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length;k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
function findMiddleware(middleware, path) {
  if (!middleware) {
    return;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach((p) => re.test(p) && routes[m][p].push([handler, paramCount]));
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length;i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = undefined;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]]));
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/router/reg-exp-router/prepared-router.js
var PreparedRegExpRouter = class {
  name = "PreparedRegExpRouter";
  #matchers;
  #relocateMap;
  constructor(matchers, relocateMap) {
    this.#matchers = matchers;
    this.#relocateMap = relocateMap;
  }
  #addWildcard(method, handlerData) {
    const matcher = this.#matchers[method];
    matcher[1].forEach((list6) => list6 && list6.push(handlerData));
    Object.values(matcher[2]).forEach((list6) => list6[0].push(handlerData));
  }
  #addPath(method, path, handler, indexes, map) {
    const matcher = this.#matchers[method];
    if (!map) {
      matcher[2][path][0].push([handler, {}]);
    } else {
      indexes.forEach((index) => {
        if (typeof index === "number") {
          matcher[1][index].push([handler, map]);
        } else {
          matcher[2][index || path][0].push([handler, map]);
        }
      });
    }
  }
  add(method, path, handler) {
    if (!this.#matchers[method]) {
      const all = this.#matchers[METHOD_NAME_ALL];
      const staticMap = {};
      for (const key in all[2]) {
        staticMap[key] = [all[2][key][0].slice(), emptyParam];
      }
      this.#matchers[method] = [
        all[0],
        all[1].map((list6) => Array.isArray(list6) ? list6.slice() : 0),
        staticMap
      ];
    }
    if (path === "/*" || path === "*") {
      const handlerData = [handler, {}];
      if (method === METHOD_NAME_ALL) {
        for (const m in this.#matchers) {
          this.#addWildcard(m, handlerData);
        }
      } else {
        this.#addWildcard(method, handlerData);
      }
      return;
    }
    const data = this.#relocateMap[path];
    if (!data) {
      throw new Error(`Path ${path} is not registered`);
    }
    for (const [indexes, map] of data) {
      if (method === METHOD_NAME_ALL) {
        for (const m in this.#matchers) {
          this.#addPath(m, path, handler, indexes, map);
        }
      } else {
        this.#addPath(method, path, handler, indexes, map);
      }
    }
  }
  buildAllMatchers() {
    return this.#matchers;
  }
  match = match;
};

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (;i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length;i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = undefined;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = (children) => {
  for (const _ in children) {
    return true;
  }
  return false;
};
var Node2 = class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length;i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2;
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length;i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== undefined) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length;i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0;i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length;j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length;k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0;p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(handlerSets, child.#children["*"], method, params, node.#params);
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2;
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length;i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter, new TrieRouter]
    });
  }
};

// ../../node_modules/.bun/hono@4.12.9/node_modules/hono/dist/middleware/cors/index.js
var cors = (options) => {
  const defaults = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: []
  };
  const opts = {
    ...defaults,
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        if (opts.credentials) {
          return (origin) => origin || null;
        }
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*" || opts.credentials) {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*" || opts.credentials) {
      c.header("Vary", "Origin", { append: true });
    }
  };
};

// src/lib/logger.ts
var LEVEL_ORDER = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};
function isValidLevel(level) {
  return level in LEVEL_ORDER;
}

class Logger {
  level;
  levelNum;
  constructor(level) {
    if (level && isValidLevel(level)) {
      this.level = level;
    } else {
      this.level = "info";
    }
    this.levelNum = LEVEL_ORDER[this.level];
  }
  getLevel() {
    return this.level;
  }
  debug(fields) {
    if (this.levelNum > LEVEL_ORDER.debug)
      return;
    console.debug(JSON.stringify({ level: "debug", ts: new Date().toISOString(), ...fields }));
  }
  info(fields) {
    if (this.levelNum > LEVEL_ORDER.info)
      return;
    console.log(JSON.stringify({ level: "info", ts: new Date().toISOString(), ...fields }));
  }
  warn(fields) {
    if (this.levelNum > LEVEL_ORDER.warn)
      return;
    console.warn(JSON.stringify({ level: "warn", ts: new Date().toISOString(), ...fields }));
  }
  error(fields) {
    console.error(JSON.stringify({ level: "error", ts: new Date().toISOString(), ...fields }));
  }
}
var envLevel = typeof process !== "undefined" && process.env?.FORGE_LOG_LEVEL || "info";
var logger = new Logger(envLevel);

// src/routes/sources.ts
function sourceRoutes(services) {
  const app = new Hono2;
  app.post("/sources", async (c) => {
    const body = await c.req.json();
    const result = services.sources.createSource(body);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data }, 201);
  });
  app.get("/sources", (c) => {
    const offset = Math.max(0, parseInt(c.req.query("offset") ?? "0", 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query("limit") ?? "50", 10) || 50));
    const filter = {};
    if (c.req.query("source_type"))
      filter.source_type = c.req.query("source_type");
    if (c.req.query("organization_id"))
      filter.organization_id = c.req.query("organization_id");
    if (c.req.query("status"))
      filter.status = c.req.query("status");
    const result = services.sources.listSources(filter, offset, limit);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data, pagination: result.pagination });
  });
  app.get("/sources/:id", (c) => {
    const result = services.sources.getSource(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.patch("/sources/:id", async (c) => {
    const body = await c.req.json();
    const result = services.sources.updateSource(c.req.param("id"), body);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.delete("/sources/:id", (c) => {
    const result = services.sources.deleteSource(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.body(null, 204);
  });
  app.post("/sources/:id/derive-bullets", async (c) => {
    const result = await services.derivation.deriveBulletsFromSource(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data }, 201);
  });
  return app;
}

// src/routes/bullets.ts
function bulletRoutes(services) {
  const app = new Hono2;
  app.get("/bullets", (c) => {
    const offset = Math.max(0, parseInt(c.req.query("offset") ?? "0", 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query("limit") ?? "50", 10) || 50));
    const filter = {};
    if (c.req.query("source_id"))
      filter.source_id = c.req.query("source_id");
    if (c.req.query("status"))
      filter.status = c.req.query("status");
    if (c.req.query("technology"))
      filter.technology = c.req.query("technology");
    const result = services.bullets.listBullets(filter, offset, limit);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data, pagination: result.pagination });
  });
  app.get("/bullets/:id", (c) => {
    const result = services.bullets.getBullet(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.patch("/bullets/:id", async (c) => {
    const body = await c.req.json();
    const result = services.bullets.updateBullet(c.req.param("id"), body);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.delete("/bullets/:id", (c) => {
    const result = services.bullets.deleteBullet(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.body(null, 204);
  });
  app.patch("/bullets/:id/approve", (c) => {
    const result = services.bullets.approveBullet(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.patch("/bullets/:id/reject", async (c) => {
    const body = await c.req.json();
    const result = services.bullets.rejectBullet(c.req.param("id"), body.rejection_reason ?? "");
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.patch("/bullets/:id/reopen", (c) => {
    const result = services.bullets.reopenBullet(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.post("/bullets/:id/derive-perspectives", async (c) => {
    const body = await c.req.json();
    const result = await services.derivation.derivePerspectivesFromBullet(c.req.param("id"), {
      archetype: body.archetype,
      domain: body.domain,
      framing: body.framing
    });
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data }, 201);
  });
  return app;
}

// src/routes/perspectives.ts
function perspectiveRoutes(services) {
  const app = new Hono2;
  app.get("/perspectives", (c) => {
    const offset = Math.max(0, parseInt(c.req.query("offset") ?? "0", 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query("limit") ?? "50", 10) || 50));
    const filter = {};
    if (c.req.query("bullet_id"))
      filter.bullet_id = c.req.query("bullet_id");
    if (c.req.query("target_archetype"))
      filter.target_archetype = c.req.query("target_archetype");
    if (c.req.query("domain"))
      filter.domain = c.req.query("domain");
    if (c.req.query("framing"))
      filter.framing = c.req.query("framing");
    if (c.req.query("status"))
      filter.status = c.req.query("status");
    const result = services.perspectives.listPerspectives(filter, offset, limit);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data, pagination: result.pagination });
  });
  app.get("/perspectives/:id", (c) => {
    const result = services.perspectives.getPerspectiveWithChain(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.patch("/perspectives/:id", async (c) => {
    const body = await c.req.json();
    const result = services.perspectives.updatePerspective(c.req.param("id"), body);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.delete("/perspectives/:id", (c) => {
    const result = services.perspectives.deletePerspective(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.body(null, 204);
  });
  app.patch("/perspectives/:id/approve", (c) => {
    const result = services.perspectives.approvePerspective(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.patch("/perspectives/:id/reject", async (c) => {
    const body = await c.req.json();
    const result = services.perspectives.rejectPerspective(c.req.param("id"), body.rejection_reason ?? "");
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.patch("/perspectives/:id/reopen", (c) => {
    const result = services.perspectives.reopenPerspective(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  return app;
}

// src/routes/resumes.ts
function resumeRoutes(services) {
  const app = new Hono2;
  app.post("/resumes", async (c) => {
    const body = await c.req.json();
    const result = services.resumes.createResume(body);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data }, 201);
  });
  app.get("/resumes", (c) => {
    const offset = Math.max(0, parseInt(c.req.query("offset") ?? "0", 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query("limit") ?? "50", 10) || 50));
    const result = services.resumes.listResumes(offset, limit);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data, pagination: result.pagination });
  });
  app.get("/resumes/:id", (c) => {
    const result = services.resumes.getResume(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.patch("/resumes/:id", async (c) => {
    const body = await c.req.json();
    const result = services.resumes.updateResume(c.req.param("id"), body);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.delete("/resumes/:id", (c) => {
    const result = services.resumes.deleteResume(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.body(null, 204);
  });
  app.post("/resumes/:id/entries", async (c) => {
    const body = await c.req.json();
    const result = services.resumes.addEntry(c.req.param("id"), body);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data }, 201);
  });
  app.patch("/resumes/:id/entries/:entryId", async (c) => {
    const body = await c.req.json();
    const result = services.resumes.updateEntry(c.req.param("id"), c.req.param("entryId"), body);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.delete("/resumes/:id/entries/:entryId", (c) => {
    const result = services.resumes.removeEntry(c.req.param("id"), c.req.param("entryId"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.body(null, 204);
  });
  app.patch("/resumes/:id/entries/reorder", async (c) => {
    const body = await c.req.json();
    const result = services.resumes.reorderEntries(c.req.param("id"), body.entries);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: null });
  });
  app.get("/resumes/:id/gaps", (c) => {
    const result = services.resumes.analyzeGaps(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.get("/resumes/:id/ir", (c) => {
    const result = services.resumes.getIR(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.patch("/resumes/:id/header", async (c) => {
    const body = await c.req.json();
    const result = services.resumes.updateHeader(c.req.param("id"), body);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.patch("/resumes/:id/markdown-override", async (c) => {
    const body = await c.req.json();
    const result = services.resumes.updateMarkdownOverride(c.req.param("id"), body.content);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.patch("/resumes/:id/latex-override", async (c) => {
    const body = await c.req.json();
    const result = services.resumes.updateLatexOverride(c.req.param("id"), body.content);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.post("/resumes/:id/pdf", async (c) => {
    let latex;
    try {
      const body = await c.req.json();
      latex = body.latex;
    } catch {}
    const result = await services.resumes.generatePDF(c.req.param("id"), latex);
    if (!result.ok) {
      const code = result.error.code;
      const status = code === "TECTONIC_NOT_AVAILABLE" ? 501 : code === "TECTONIC_TIMEOUT" ? 504 : code === "LATEX_COMPILE_ERROR" ? 422 : mapStatusCode(code);
      return c.json({ error: result.error }, status);
    }
    return new Response(result.data, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="resume.pdf"'
      }
    });
  });
  app.post("/resumes/:id/export", (c) => {
    return c.json({ error: { code: "NOT_IMPLEMENTED", message: "Resume export is not yet implemented. Use POST /resumes/:id/pdf instead." } }, 501);
  });
  return app;
}

// src/routes/review.ts
function reviewRoutes(services) {
  const app = new Hono2;
  app.get("/review/pending", (c) => {
    const result = services.review.getPendingReview();
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  return app;
}

// src/db/repositories/skill-repository.ts
function toSkill(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category
  };
}
function create7(db, input) {
  const id = crypto.randomUUID();
  const row = db.query(`INSERT INTO skills (id, name, category)
       VALUES (?, ?, ?)
       RETURNING *`).get(id, input.name, input.category ?? null);
  return toSkill(row);
}
function list6(db, filter) {
  if (filter?.category) {
    return db.query("SELECT * FROM skills WHERE category = ? ORDER BY name ASC").all(filter.category).map(toSkill);
  }
  return db.query("SELECT * FROM skills ORDER BY name ASC").all().map(toSkill);
}

// src/routes/supporting.ts
function supportingRoutes(services, db) {
  const app = new Hono2;
  app.post("/skills", async (c) => {
    const body = await c.req.json();
    if (!body.name || body.name.trim().length === 0) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Name must not be empty" } }, 400);
    }
    const skill = create7(getDb(), body);
    return c.json({ data: skill }, 201);
  });
  app.get("/skills", (c) => {
    const filter = {};
    if (c.req.query("category"))
      filter.category = c.req.query("category");
    const skills = list6(getDb(), filter);
    return c.json({ data: skills });
  });
  return app;
  function getDb() {
    if (db)
      return db;
    throw new Error("Database not available in supporting routes");
  }
}

// src/routes/audit.ts
function auditRoutes(services) {
  const app = new Hono2;
  app.get("/audit/chain/:perspectiveId", (c) => {
    const result = services.audit.traceChain(c.req.param("perspectiveId"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.get("/audit/integrity/:perspectiveId", (c) => {
    const result = services.audit.checkIntegrity(c.req.param("perspectiveId"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  return app;
}

// src/routes/organizations.ts
function organizationRoutes(services) {
  const app = new Hono2;
  app.post("/organizations", async (c) => {
    const body = await c.req.json();
    const result = services.organizations.create(body);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data }, 201);
  });
  app.get("/organizations", (c) => {
    const offset = Math.max(0, parseInt(c.req.query("offset") ?? "0", 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query("limit") ?? "50", 10) || 50));
    const filter = {};
    if (c.req.query("org_type"))
      filter.org_type = c.req.query("org_type");
    if (c.req.query("worked") !== undefined && c.req.query("worked") !== null) {
      filter.worked = parseInt(c.req.query("worked"), 10);
    }
    if (c.req.query("search"))
      filter.search = c.req.query("search");
    if (c.req.query("status"))
      filter.status = c.req.query("status");
    const result = services.organizations.list(filter, offset, limit);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data, pagination: result.pagination });
  });
  app.get("/organizations/:id", (c) => {
    const result = services.organizations.get(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.patch("/organizations/:id", async (c) => {
    const body = await c.req.json();
    const result = services.organizations.update(c.req.param("id"), body);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.delete("/organizations/:id", (c) => {
    const result = services.organizations.delete(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.body(null, 204);
  });
  return app;
}

// src/routes/notes.ts
function noteRoutes(services) {
  const app = new Hono2;
  app.post("/notes", async (c) => {
    const body = await c.req.json();
    const result = services.notes.create(body);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data }, 201);
  });
  app.get("/notes", (c) => {
    const offset = Math.max(0, parseInt(c.req.query("offset") ?? "0", 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query("limit") ?? "50", 10) || 50));
    const search = c.req.query("search");
    const result = services.notes.list(search, offset, limit);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data, pagination: result.pagination });
  });
  app.get("/notes/:id", (c) => {
    const result = services.notes.get(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.patch("/notes/:id", async (c) => {
    const body = await c.req.json();
    const result = services.notes.update(c.req.param("id"), body);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.delete("/notes/:id", (c) => {
    const result = services.notes.delete(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.body(null, 204);
  });
  app.get("/notes/by-entity/:entityType/:entityId", (c) => {
    const result = services.notes.getNotesForEntity(c.req.param("entityType"), c.req.param("entityId"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.post("/notes/:id/references", async (c) => {
    const body = await c.req.json();
    const result = services.notes.addReference(c.req.param("id"), body.entity_type, body.entity_id);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: null }, 201);
  });
  app.delete("/notes/:id/references/:entityType/:entityId", (c) => {
    const result = services.notes.removeReference(c.req.param("id"), c.req.param("entityType"), c.req.param("entityId"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.body(null, 204);
  });
  return app;
}

// src/routes/integrity.ts
function integrityRoutes(services) {
  const app = new Hono2;
  app.get("/integrity/drift", (c) => {
    const result = services.integrity.getDriftedEntities();
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  return app;
}

// src/routes/domains.ts
function domainRoutes(services) {
  const app = new Hono2;
  app.post("/domains", async (c) => {
    const body = await c.req.json();
    const result = services.domains.create(body);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data }, 201);
  });
  app.get("/domains", (c) => {
    const offset = Math.max(0, parseInt(c.req.query("offset") ?? "0", 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query("limit") ?? "50", 10) || 50));
    const result = services.domains.list(offset, limit);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data, pagination: result.pagination });
  });
  app.get("/domains/:id", (c) => {
    const result = services.domains.get(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.patch("/domains/:id", async (c) => {
    const body = await c.req.json();
    const result = services.domains.update(c.req.param("id"), body);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.delete("/domains/:id", (c) => {
    const result = services.domains.delete(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.body(null, 204);
  });
  return app;
}

// src/routes/archetypes.ts
function archetypeRoutes(services) {
  const app = new Hono2;
  app.post("/archetypes", async (c) => {
    const body = await c.req.json();
    const result = services.archetypes.create(body);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data }, 201);
  });
  app.get("/archetypes", (c) => {
    const offset = Math.max(0, parseInt(c.req.query("offset") ?? "0", 10) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(c.req.query("limit") ?? "50", 10) || 50));
    const result = services.archetypes.list(offset, limit);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data, pagination: result.pagination });
  });
  app.get("/archetypes/:id", (c) => {
    const result = services.archetypes.getWithDomains(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.patch("/archetypes/:id", async (c) => {
    const body = await c.req.json();
    const result = services.archetypes.update(c.req.param("id"), body);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.delete("/archetypes/:id", (c) => {
    const result = services.archetypes.delete(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.body(null, 204);
  });
  app.get("/archetypes/:id/domains", (c) => {
    const result = services.archetypes.listDomains(c.req.param("id"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: result.data });
  });
  app.post("/archetypes/:id/domains", async (c) => {
    const body = await c.req.json();
    const result = services.archetypes.addDomain(c.req.param("id"), body.domain_id);
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.json({ data: null }, 201);
  });
  app.delete("/archetypes/:id/domains/:domainId", (c) => {
    const result = services.archetypes.removeDomain(c.req.param("id"), c.req.param("domainId"));
    if (!result.ok)
      return c.json({ error: result.error }, mapStatusCode(result.error.code));
    return c.body(null, 204);
  });
  return app;
}

// src/routes/server.ts
function mapStatusCode(code) {
  switch (code) {
    case "VALIDATION_ERROR":
      return 400;
    case "NOT_FOUND":
      return 404;
    case "CONFLICT":
      return 409;
    case "AI_ERROR":
      return 502;
    case "GATEWAY_TIMEOUT":
      return 504;
    default:
      return 500;
  }
}
function createApp(services, db) {
  const app = new Hono2().basePath("/api");
  app.use("*", cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"]
  }));
  app.use("*", async (c, next) => {
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);
    const start = performance.now();
    await next();
    const duration_ms = Math.round((performance.now() - start) * 10) / 10;
    const fields = {
      method: c.req.method,
      path: c.req.path,
      route: c.req.routePath ?? c.req.path,
      status: c.res.status,
      duration_ms,
      request_id: requestId
    };
    if (c.res.status >= 500) {
      logger.error(fields);
    } else if (c.res.status >= 400 || duration_ms > 500) {
      logger.warn(fields);
    } else {
      logger.info(fields);
    }
  });
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.route("/", sourceRoutes(services));
  app.route("/", bulletRoutes(services));
  app.route("/", perspectiveRoutes(services));
  app.route("/", resumeRoutes(services));
  app.route("/", reviewRoutes(services));
  app.route("/", supportingRoutes(services, db));
  app.route("/", auditRoutes(services));
  app.route("/", organizationRoutes(services));
  app.route("/", noteRoutes(services));
  app.route("/", integrityRoutes(services));
  app.route("/", domainRoutes(services));
  app.route("/", archetypeRoutes(services));
  app.onError((err, c) => {
    logger.error({
      msg: "Unhandled error",
      error: err.message,
      stack: err.stack
    });
    return c.json({
      error: {
        code: "INTERNAL_ERROR",
        message: err.message
      }
    }, 500);
  });
  app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: `Route not found: ${c.req.method} ${c.req.path}` } }, 404));
  return app;
}

// src/index.ts
var PORT = parseInt(process.env.FORGE_PORT ?? "3000", 10);
var DB_PATH = process.env.FORGE_DB_PATH;
if (!DB_PATH) {
  console.error("FORGE_DB_PATH is required. Set it to a path for the SQLite database file.");
  process.exit(1);
}
if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`FORGE_PORT must be a valid port number (1-65535), got: ${process.env.FORGE_PORT}`);
  process.exit(1);
}
var dbPath = resolve(DB_PATH);
mkdirSync(dirname(dbPath), { recursive: true });
var db = getDatabase(dbPath);
logger.info({ msg: "Database connected", path: dbPath });
var migrationsDir = resolve(import.meta.dir, "db/migrations");
runMigrations(db, migrationsDir);
var recovered = DerivationService.recoverStaleLocks(db);
if (recovered > 0) {
  logger.warn({ msg: "Recovered stale deriving locks", count: recovered });
}
var claudePath = process.env.FORGE_CLAUDE_PATH ?? "claude";
try {
  const proc = Bun.spawnSync([claudePath, "--version"], { stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode === 0) {
    const version = proc.stdout.toString().trim();
    logger.info({ msg: "Claude CLI available", version });
  } else {
    logger.warn({ msg: "Claude CLI not found", path: claudePath, note: "AI features will be unavailable" });
  }
} catch {
  logger.warn({ msg: "Claude CLI not found", path: claudePath, note: "AI features will be unavailable" });
}
try {
  const tecProc = Bun.spawnSync(["tectonic", "--version"], { stdout: "pipe", stderr: "pipe" });
  if (tecProc.exitCode === 0) {
    const version = tecProc.stdout.toString().trim();
    logger.info({ msg: "Tectonic available", version });
  } else {
    logger.warn({ msg: "Tectonic not found", note: "PDF generation will be unavailable" });
  }
} catch {
  logger.warn({ msg: "Tectonic not found", note: "PDF generation will be unavailable" });
}
var services = createServices(db);
var app = createApp(services, db);
var src_default = {
  port: PORT,
  fetch: app.fetch
};
logger.info({ msg: "Forge API server listening", url: `http://localhost:${PORT}`, port: PORT, log_level: logger.getLevel() });
export {
  src_default as default
};
