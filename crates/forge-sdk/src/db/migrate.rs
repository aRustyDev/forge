//! Migration runner — embeds SQL migration files from the TS codebase
//! and applies them in order, tracking state in `_migrations`.

use rusqlite::Connection;
use forge_core::ForgeError;

/// Embedded SQL migrations in filename-sorted order.
/// Source: `packages/core/src/db/migrations/*.sql`
const MIGRATIONS: &[(&str, &str)] = &[
    ("001_initial", include_str!("../../../../packages/core/src/db/migrations/001_initial.sql")),
    ("002_schema_evolution", include_str!("../../../../packages/core/src/db/migrations/002_schema_evolution.sql")),
    ("003_renderer_and_entities", include_str!("../../../../packages/core/src/db/migrations/003_renderer_and_entities.sql")),
    ("004_resume_sections", include_str!("../../../../packages/core/src/db/migrations/004_resume_sections.sql")),
    ("005_user_profile", include_str!("../../../../packages/core/src/db/migrations/005_user_profile.sql")),
    ("006_summaries", include_str!("../../../../packages/core/src/db/migrations/006_summaries.sql")),
    ("007_job_descriptions", include_str!("../../../../packages/core/src/db/migrations/007_job_descriptions.sql")),
    ("008_resume_templates", include_str!("../../../../packages/core/src/db/migrations/008_resume_templates.sql")),
    ("009_education_subtype_fields", include_str!("../../../../packages/core/src/db/migrations/009_education_subtype_fields.sql")),
    ("010_education_org_fk", include_str!("../../../../packages/core/src/db/migrations/010_education_org_fk.sql")),
    ("011_org_tags", include_str!("../../../../packages/core/src/db/migrations/011_org_tags.sql")),
    ("012_org_kanban_statuses", include_str!("../../../../packages/core/src/db/migrations/012_org_kanban_statuses.sql")),
    ("013_org_campuses", include_str!("../../../../packages/core/src/db/migrations/013_org_campuses.sql")),
    ("014_campus_zipcode_hq", include_str!("../../../../packages/core/src/db/migrations/014_campus_zipcode_hq.sql")),
    ("015_org_aliases", include_str!("../../../../packages/core/src/db/migrations/015_org_aliases.sql")),
    ("016_source_skills", include_str!("../../../../packages/core/src/db/migrations/016_source_skills.sql")),
    ("018_job_description_skills", include_str!("../../../../packages/core/src/db/migrations/018_job_description_skills.sql")),
    ("019_clearance_structured_data", include_str!("../../../../packages/core/src/db/migrations/019_clearance_structured_data.sql")),
    ("020_stale_education_text_cleanup", include_str!("../../../../packages/core/src/db/migrations/020_stale_education_text_cleanup.sql")),
    ("021_drop_legacy_education_columns", include_str!("../../../../packages/core/src/db/migrations/021_drop_legacy_education_columns.sql")),
    ("022_drop_legacy_org_location_columns", include_str!("../../../../packages/core/src/db/migrations/022_drop_legacy_org_location_columns.sql")),
    ("023_contacts", include_str!("../../../../packages/core/src/db/migrations/023_contacts.sql")),
    ("024_unified_kanban_statuses", include_str!("../../../../packages/core/src/db/migrations/024_unified_kanban_statuses.sql")),
    ("025_embeddings", include_str!("../../../../packages/core/src/db/migrations/025_embeddings.sql")),
    ("026_job_description_resumes", include_str!("../../../../packages/core/src/db/migrations/026_job_description_resumes.sql")),
    ("027_salary_structured_fields", include_str!("../../../../packages/core/src/db/migrations/027_salary_structured_fields.sql")),
    ("028_jd_pipeline_statuses", include_str!("../../../../packages/core/src/db/migrations/028_jd_pipeline_statuses.sql")),
    ("029_prompt_logs_jd_entity_type", include_str!("../../../../packages/core/src/db/migrations/029_prompt_logs_jd_entity_type.sql")),
    ("031_skills_expansion", include_str!("../../../../packages/core/src/db/migrations/031_skills_expansion.sql")),
    ("032_industries_role_types", include_str!("../../../../packages/core/src/db/migrations/032_industries_role_types.sql")),
    ("033_summary_structured_fields", include_str!("../../../../packages/core/src/db/migrations/033_summary_structured_fields.sql")),
    ("034_resume_entry_source_id", include_str!("../../../../packages/core/src/db/migrations/034_resume_entry_source_id.sql")),
    ("035_resume_tagline_engine", include_str!("../../../../packages/core/src/db/migrations/035_resume_tagline_engine.sql")),
    ("036_null_auto_content_on_direct_source_entries", include_str!("../../../../packages/core/src/db/migrations/036_null_auto_content_on_direct_source_entries.sql")),
    ("037_qualifications", include_str!("../../../../packages/core/src/db/migrations/037_qualifications.sql")),
    ("038_resume_summary_override", include_str!("../../../../packages/core/src/db/migrations/038_resume_summary_override.sql")),
    ("039_presentations", include_str!("../../../../packages/core/src/db/migrations/039_presentations.sql")),
    ("040_resume_show_clearance_header", include_str!("../../../../packages/core/src/db/migrations/040_resume_show_clearance_header.sql")),
    ("041_skill_categories_and_seeds", include_str!("../../../../packages/core/src/db/migrations/041_skill_categories_and_seeds.sql")),
    ("042_project_open_source", include_str!("../../../../packages/core/src/db/migrations/042_project_open_source.sql")),
    ("043_cert_schema_rework", include_str!("../../../../packages/core/src/db/migrations/043_cert_schema_rework.sql")),
    ("044_skill_categories", include_str!("../../../../packages/core/src/db/migrations/044_skill_categories.sql")),
    ("045_pending_derivations", include_str!("../../../../packages/core/src/db/migrations/045_pending_derivations.sql")),
    ("046_profile_addresses_urls", include_str!("../../../../packages/core/src/db/migrations/046_profile_addresses_urls.sql")),
    ("047_org_locations", include_str!("../../../../packages/core/src/db/migrations/047_org_locations.sql")),
    ("048_notes_normalization", include_str!("../../../../packages/core/src/db/migrations/048_notes_normalization.sql")),
    ("049_jd_parsed_fields", include_str!("../../../../packages/core/src/db/migrations/049_jd_parsed_fields.sql")),
    ("050_answer_bank", include_str!("../../../../packages/core/src/db/migrations/050_answer_bank.sql")),
    ("051_extension_infra", include_str!("../../../../packages/core/src/db/migrations/051_extension_infra.sql")),
];

/// Run all pending migrations against the given connection.
///
/// Each migration runs in its own transaction. Migrations that contain
/// `PRAGMA foreign_keys = OFF` get that pragma set outside the transaction
/// (SQLite ignores it inside BEGIN/COMMIT).
pub fn run_migrations(conn: &Connection) -> Result<usize, ForgeError> {
    let applied = get_applied(conn)?;
    let mut count = 0;

    for &(name, sql) in MIGRATIONS {
        if applied.contains(&name.to_string()) {
            continue;
        }

        let needs_fk_off = sql.contains("PRAGMA foreign_keys = OFF");
        if needs_fk_off {
            conn.execute_batch("PRAGMA foreign_keys = OFF")?;
        }

        conn.execute_batch("BEGIN")?;
        match conn.execute_batch(sql) {
            Ok(()) => {
                conn.execute(
                    "INSERT OR IGNORE INTO _migrations (name) VALUES (?1)",
                    rusqlite::params![name],
                )?;
                conn.execute_batch("COMMIT")?;
            }
            Err(e) => {
                let _ = conn.execute_batch("ROLLBACK");
                if needs_fk_off {
                    let _ = conn.execute_batch("PRAGMA foreign_keys = ON");
                }
                return Err(e.into());
            }
        }

        if needs_fk_off {
            conn.execute_batch("PRAGMA foreign_keys = ON")?;
        }
        count += 1;
    }

    Ok(count)
}

/// Get the set of migration names already applied.
fn get_applied(conn: &Connection) -> Result<Vec<String>, ForgeError> {
    // Check if _migrations table exists
    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='_migrations')",
        [],
        |row| row.get(0),
    )?;

    if !exists {
        return Ok(Vec::new());
    }

    let mut stmt = conn.prepare("SELECT name FROM _migrations")?;
    let names = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(names)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_run_on_empty_db() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON").unwrap();
        let count = run_migrations(&conn).unwrap();
        assert_eq!(count, MIGRATIONS.len());

        // Verify _migrations table has all entries
        let applied = get_applied(&conn).unwrap();
        assert_eq!(applied.len(), MIGRATIONS.len());
    }

    #[test]
    fn migrations_are_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON").unwrap();

        let first = run_migrations(&conn).unwrap();
        assert_eq!(first, MIGRATIONS.len());

        let second = run_migrations(&conn).unwrap();
        assert_eq!(second, 0);
    }

    #[test]
    fn sources_table_exists_after_migration() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON").unwrap();
        run_migrations(&conn).unwrap();

        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='sources')",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(exists);
    }
}
