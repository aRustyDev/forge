//! SQL migration manifest — single source of truth for the Forge schema.
//!
//! The slice contents are pure data (`include_str!` against
//! `packages/core/src/db/migrations/*.sql`), with no DB-runtime dependency.
//! Native consumers (forge-sdk) apply via rusqlite; WASM consumers
//! (forge-wasm) apply via wa-sqlite.

/// Embedded SQL migrations in filename-sorted order.
/// Source: `packages/core/src/db/migrations/*.sql`.
pub const MIGRATIONS: &[(&str, &str)] = &[
    ("001_initial", include_str!("../../../packages/core/src/db/migrations/001_initial.sql")),
    ("002_schema_evolution", include_str!("../../../packages/core/src/db/migrations/002_schema_evolution.sql")),
    ("003_renderer_and_entities", include_str!("../../../packages/core/src/db/migrations/003_renderer_and_entities.sql")),
    ("004_resume_sections", include_str!("../../../packages/core/src/db/migrations/004_resume_sections.sql")),
    ("005_user_profile", include_str!("../../../packages/core/src/db/migrations/005_user_profile.sql")),
    ("006_summaries", include_str!("../../../packages/core/src/db/migrations/006_summaries.sql")),
    ("007_job_descriptions", include_str!("../../../packages/core/src/db/migrations/007_job_descriptions.sql")),
    ("008_resume_templates", include_str!("../../../packages/core/src/db/migrations/008_resume_templates.sql")),
    ("009_education_subtype_fields", include_str!("../../../packages/core/src/db/migrations/009_education_subtype_fields.sql")),
    ("010_education_org_fk", include_str!("../../../packages/core/src/db/migrations/010_education_org_fk.sql")),
    ("011_org_tags", include_str!("../../../packages/core/src/db/migrations/011_org_tags.sql")),
    ("012_org_kanban_statuses", include_str!("../../../packages/core/src/db/migrations/012_org_kanban_statuses.sql")),
    ("013_org_campuses", include_str!("../../../packages/core/src/db/migrations/013_org_campuses.sql")),
    ("014_campus_zipcode_hq", include_str!("../../../packages/core/src/db/migrations/014_campus_zipcode_hq.sql")),
    ("015_org_aliases", include_str!("../../../packages/core/src/db/migrations/015_org_aliases.sql")),
    ("016_source_skills", include_str!("../../../packages/core/src/db/migrations/016_source_skills.sql")),
    ("018_job_description_skills", include_str!("../../../packages/core/src/db/migrations/018_job_description_skills.sql")),
    ("019_clearance_structured_data", include_str!("../../../packages/core/src/db/migrations/019_clearance_structured_data.sql")),
    ("020_stale_education_text_cleanup", include_str!("../../../packages/core/src/db/migrations/020_stale_education_text_cleanup.sql")),
    ("021_drop_legacy_education_columns", include_str!("../../../packages/core/src/db/migrations/021_drop_legacy_education_columns.sql")),
    ("022_drop_legacy_org_location_columns", include_str!("../../../packages/core/src/db/migrations/022_drop_legacy_org_location_columns.sql")),
    ("023_contacts", include_str!("../../../packages/core/src/db/migrations/023_contacts.sql")),
    ("024_unified_kanban_statuses", include_str!("../../../packages/core/src/db/migrations/024_unified_kanban_statuses.sql")),
    ("025_embeddings", include_str!("../../../packages/core/src/db/migrations/025_embeddings.sql")),
    ("026_job_description_resumes", include_str!("../../../packages/core/src/db/migrations/026_job_description_resumes.sql")),
    ("027_salary_structured_fields", include_str!("../../../packages/core/src/db/migrations/027_salary_structured_fields.sql")),
    ("028_jd_pipeline_statuses", include_str!("../../../packages/core/src/db/migrations/028_jd_pipeline_statuses.sql")),
    ("029_prompt_logs_jd_entity_type", include_str!("../../../packages/core/src/db/migrations/029_prompt_logs_jd_entity_type.sql")),
    ("031_skills_expansion", include_str!("../../../packages/core/src/db/migrations/031_skills_expansion.sql")),
    ("032_industries_role_types", include_str!("../../../packages/core/src/db/migrations/032_industries_role_types.sql")),
    ("033_summary_structured_fields", include_str!("../../../packages/core/src/db/migrations/033_summary_structured_fields.sql")),
    ("034_resume_entry_source_id", include_str!("../../../packages/core/src/db/migrations/034_resume_entry_source_id.sql")),
    ("035_resume_tagline_engine", include_str!("../../../packages/core/src/db/migrations/035_resume_tagline_engine.sql")),
    ("036_null_auto_content_on_direct_source_entries", include_str!("../../../packages/core/src/db/migrations/036_null_auto_content_on_direct_source_entries.sql")),
    ("037_qualifications", include_str!("../../../packages/core/src/db/migrations/037_qualifications.sql")),
    ("038_resume_summary_override", include_str!("../../../packages/core/src/db/migrations/038_resume_summary_override.sql")),
    ("039_presentations", include_str!("../../../packages/core/src/db/migrations/039_presentations.sql")),
    ("040_resume_show_clearance_header", include_str!("../../../packages/core/src/db/migrations/040_resume_show_clearance_header.sql")),
    ("041_skill_categories_and_seeds", include_str!("../../../packages/core/src/db/migrations/041_skill_categories_and_seeds.sql")),
    ("042_project_open_source", include_str!("../../../packages/core/src/db/migrations/042_project_open_source.sql")),
    ("043_cert_schema_rework", include_str!("../../../packages/core/src/db/migrations/043_cert_schema_rework.sql")),
    ("044_skill_categories", include_str!("../../../packages/core/src/db/migrations/044_skill_categories.sql")),
    ("045_pending_derivations", include_str!("../../../packages/core/src/db/migrations/045_pending_derivations.sql")),
    ("046_profile_addresses_urls", include_str!("../../../packages/core/src/db/migrations/046_profile_addresses_urls.sql")),
    ("047_org_locations", include_str!("../../../packages/core/src/db/migrations/047_org_locations.sql")),
    ("048_notes_normalization", include_str!("../../../packages/core/src/db/migrations/048_notes_normalization.sql")),
    ("049_jd_parsed_fields", include_str!("../../../packages/core/src/db/migrations/049_jd_parsed_fields.sql")),
    ("050_answer_bank", include_str!("../../../packages/core/src/db/migrations/050_answer_bank.sql")),
    ("051_extension_infra", include_str!("../../../packages/core/src/db/migrations/051_extension_infra.sql")),
    ("052_skill_graph_schema", include_str!("../../../packages/core/src/db/migrations/052_skill_graph_schema.sql")),
    ("053_skill_graph_initial_population", include_str!("../../../packages/core/src/db/migrations/053_skill_graph_initial_population.sql")),
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_slice_is_populated_and_named() {
        assert!(MIGRATIONS.len() >= 51, "expected at least 51 migrations, got {}", MIGRATIONS.len());

        // Every entry must have a non-empty name and non-empty SQL body.
        for (name, sql) in MIGRATIONS {
            assert!(!name.is_empty(), "migration with empty name");
            assert!(!sql.trim().is_empty(), "migration {} has empty SQL", name);
        }

        // First migration must be the canonical bootstrap.
        let (first_name, _) = MIGRATIONS.first().expect("MIGRATIONS must be non-empty");
        assert_eq!(*first_name, "001_initial");
    }

    #[test]
    fn migrations_are_filename_sorted() {
        let names: Vec<&str> = MIGRATIONS.iter().map(|(n, _)| *n).collect();
        let mut sorted = names.clone();
        sorted.sort();
        assert_eq!(names, sorted, "MIGRATIONS slice must be in filename-sorted order");
    }
}
