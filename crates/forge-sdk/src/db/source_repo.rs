//! Source repository — CRUD + extension table management.
//!
//! Sources are polymorphic: the `sources` table stores common fields,
//! `source_type` discriminates among four extension tables
//! (`source_roles`, `source_projects`, `source_education`,
//! `source_presentations`). Type `general` has no extension row.

use rusqlite::{params, Connection, OptionalExtension};

use forge_core::{
    CreateSource, ForgeError, Pagination, PaginationParams, Source, SourceEducation,
    SourceExtension, SourceFilter, SourcePresentation, SourceProject, SourceRole, SourceStatus,
    SourceType, SourceWithExtension, UpdateSource, UpdatedBy, new_id, now_iso,
};

pub struct SourceRepository;

impl SourceRepository {
    // ── Create ───────────────────────────────────────────────────────

    /// Insert a source base row + extension row. Returns the full hydrated source.
    pub fn create(conn: &Connection, input: &CreateSource) -> Result<SourceWithExtension, ForgeError> {
        let id = new_id();
        let now = now_iso();
        let source_type = input.source_type.unwrap_or(SourceType::General);

        conn.execute(
            "INSERT INTO sources (id, title, description, source_type, start_date, end_date, status, updated_by, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'draft', 'human', ?7, ?7)",
            params![
                id,
                input.title,
                input.description,
                source_type.as_ref(),
                input.start_date,
                input.end_date,
                now,
            ],
        )?;

        Self::insert_extension(conn, &id, source_type, input)?;

        Self::get_hydrated(conn, &id)?
            .ok_or_else(|| ForgeError::Internal("Source created but not found".into()))
    }

    // ── Read ─────────────────────────────────────────────────────────

    /// Get a source by ID without extension data.
    pub fn get(conn: &Connection, id: &str) -> Result<Option<Source>, ForgeError> {
        let mut stmt = conn.prepare(
            "SELECT id, title, description, source_type, start_date, end_date,
                    status, updated_by, last_derived_at, created_at, updated_at
             FROM sources WHERE id = ?1",
        )?;

        let result = stmt.query_row(params![id], Self::map_source).optional()?;
        Ok(result)
    }

    /// Get a source by ID with its extension data.
    pub fn get_hydrated(conn: &Connection, id: &str) -> Result<Option<SourceWithExtension>, ForgeError> {
        let source = match Self::get(conn, id)? {
            Some(s) => s,
            None => return Ok(None),
        };
        let extension = Self::get_extension(conn, &source.id, &source.source_type)?;
        Ok(Some(SourceWithExtension { base: source, extension }))
    }

    /// List sources with optional filters and pagination.
    pub fn list(
        conn: &Connection,
        filter: &SourceFilter,
        pg: &PaginationParams,
    ) -> Result<(Vec<SourceWithExtension>, Pagination), ForgeError> {
        let offset = pg.offset.unwrap_or(0);
        let limit = pg.limit.unwrap_or(50);

        let mut conditions = Vec::new();
        let mut bind_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref st) = filter.source_type {
            conditions.push(format!("source_type = ?{}", bind_values.len() + 1));
            bind_values.push(Box::new(st.to_string()));
        }
        if let Some(ref status) = filter.status {
            conditions.push(format!("status = ?{}", bind_values.len() + 1));
            bind_values.push(Box::new(status.to_string()));
        }
        if let Some(ref search) = filter.search {
            let param_idx = bind_values.len() + 1;
            conditions.push(format!(
                "(title LIKE ?{param_idx} OR description LIKE ?{param_idx})"
            ));
            bind_values.push(Box::new(format!("%{search}%")));
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        // Count
        let count_sql = format!("SELECT COUNT(*) FROM sources {where_clause}");
        let total: i64 = conn.query_row(
            &count_sql,
            rusqlite::params_from_iter(bind_values.iter().map(|b| b.as_ref())),
            |row| row.get(0),
        )?;

        // Fetch page
        let query_sql = format!(
            "SELECT id, title, description, source_type, start_date, end_date,
                    status, updated_by, last_derived_at, created_at, updated_at
             FROM sources {where_clause}
             ORDER BY created_at DESC
             LIMIT ?{} OFFSET ?{}",
            bind_values.len() + 1,
            bind_values.len() + 2
        );
        bind_values.push(Box::new(limit));
        bind_values.push(Box::new(offset));

        let mut stmt = conn.prepare(&query_sql)?;
        let sources: Vec<Source> = stmt
            .query_map(
                rusqlite::params_from_iter(bind_values.iter().map(|b| b.as_ref())),
                Self::map_source,
            )?
            .collect::<Result<_, _>>()?;

        // Hydrate extensions
        let mut hydrated = Vec::with_capacity(sources.len());
        for source in sources {
            let extension = Self::get_extension(conn, &source.id, &source.source_type)?;
            hydrated.push(SourceWithExtension { base: source, extension });
        }

        Ok((hydrated, Pagination { total, offset, limit }))
    }

    // ── Update ───────────────────────────────────────────────────────

    /// Update a source's base row and extension row.
    pub fn update(conn: &Connection, id: &str, input: &UpdateSource) -> Result<SourceWithExtension, ForgeError> {
        let source = Self::get(conn, id)?
            .ok_or_else(|| ForgeError::NotFound { entity_type: "source".into(), id: id.into() })?;

        let mut sets = Vec::new();
        let mut bind_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref v) = input.title {
            sets.push(format!("title = ?{}", bind_values.len() + 1));
            bind_values.push(Box::new(v.clone()));
        }
        if let Some(ref v) = input.description {
            sets.push(format!("description = ?{}", bind_values.len() + 1));
            bind_values.push(Box::new(v.clone()));
        }
        if let Some(ref sd) = input.start_date {
            sets.push(format!("start_date = ?{}", bind_values.len() + 1));
            bind_values.push(Box::new(sd.clone()));
        }
        if let Some(ref ed) = input.end_date {
            sets.push(format!("end_date = ?{}", bind_values.len() + 1));
            bind_values.push(Box::new(ed.clone()));
        }

        if !sets.is_empty() {
            let now = now_iso();
            sets.push(format!("updated_at = ?{}", bind_values.len() + 1));
            bind_values.push(Box::new(now));

            let sql = format!(
                "UPDATE sources SET {} WHERE id = ?{}",
                sets.join(", "),
                bind_values.len() + 1
            );
            bind_values.push(Box::new(id.to_string()));

            conn.execute(
                &sql,
                rusqlite::params_from_iter(bind_values.iter().map(|b| b.as_ref())),
            )?;
        }

        Self::get_hydrated(conn, id)?
            .ok_or_else(|| ForgeError::Internal("Source updated but not found".into()))
    }

    // ── Delete ───────────────────────────────────────────────────────

    /// Delete a source and its extension row (cascade via FK).
    pub fn delete(conn: &Connection, id: &str) -> Result<(), ForgeError> {
        let deleted = conn.execute("DELETE FROM sources WHERE id = ?1", params![id])?;
        if deleted == 0 {
            return Err(ForgeError::NotFound { entity_type: "source".into(), id: id.into() });
        }
        Ok(())
    }

    // ── Extension helpers ────────────────────────────────────────────

    fn get_extension(conn: &Connection, source_id: &str, source_type: &SourceType) -> Result<Option<SourceExtension>, ForgeError> {
        match source_type {
            SourceType::Role => {
                let mut stmt = conn.prepare(
                    "SELECT source_id, organization_id, start_date, end_date, is_current,
                            work_arrangement, base_salary, total_comp_notes
                     FROM source_roles WHERE source_id = ?1"
                )?;
                let role = stmt.query_row(params![source_id], |row| {
                    Ok(SourceRole {
                        source_id: row.get(0)?,
                        organization_id: row.get(1)?,
                        start_date: row.get(2)?,
                        end_date: row.get(3)?,
                        is_current: row.get(4)?,
                        work_arrangement: row.get(5)?,
                        base_salary: row.get(6)?,
                        total_comp_notes: row.get(7)?,
                    })
                }).optional()?;
                Ok(role.map(SourceExtension::Role))
            }
            SourceType::Project => {
                let mut stmt = conn.prepare(
                    "SELECT source_id, organization_id, is_personal, open_source, url, start_date, end_date
                     FROM source_projects WHERE source_id = ?1"
                )?;
                let proj = stmt.query_row(params![source_id], |row| {
                    Ok(SourceProject {
                        source_id: row.get(0)?,
                        organization_id: row.get(1)?,
                        is_personal: row.get(2)?,
                        open_source: row.get(3)?,
                        url: row.get(4)?,
                        start_date: row.get(5)?,
                        end_date: row.get(6)?,
                    })
                }).optional()?;
                Ok(proj.map(SourceExtension::Project))
            }
            SourceType::Education => {
                let mut stmt = conn.prepare(
                    "SELECT source_id, education_type, organization_id, campus_id, edu_description,
                            location, start_date, end_date, url, degree_level, degree_type,
                            field, gpa, is_in_progress, certificate_subtype, credential_id, expiration_date
                     FROM source_education WHERE source_id = ?1"
                )?;
                let edu = stmt.query_row(params![source_id], |row| {
                    Ok(SourceEducation {
                        source_id: row.get(0)?,
                        education_type: row.get::<_, String>(1)?.parse().unwrap_or(forge_core::EducationType::Certificate),
                        organization_id: row.get(2)?,
                        campus_id: row.get(3)?,
                        edu_description: row.get(4)?,
                        location: row.get(5)?,
                        start_date: row.get(6)?,
                        end_date: row.get(7)?,
                        url: row.get(8)?,
                        degree_level: row.get::<_, Option<String>>(9)?.and_then(|s| s.parse().ok()),
                        degree_type: row.get(10)?,
                        field: row.get(11)?,
                        gpa: row.get(12)?,
                        is_in_progress: row.get(13)?,
                        certificate_subtype: row.get::<_, Option<String>>(14)?.and_then(|s| s.parse().ok()),
                        credential_id: row.get(15)?,
                        expiration_date: row.get(16)?,
                    })
                }).optional()?;
                Ok(edu.map(SourceExtension::Education))
            }
            SourceType::Presentation => {
                let mut stmt = conn.prepare(
                    "SELECT source_id, venue, presentation_type, url, coauthors
                     FROM source_presentations WHERE source_id = ?1"
                )?;
                let pres = stmt.query_row(params![source_id], |row| {
                    Ok(SourcePresentation {
                        source_id: row.get(0)?,
                        venue: row.get(1)?,
                        presentation_type: row.get::<_, String>(2)?.parse().unwrap_or(forge_core::PresentationType::ConferenceTalk),
                        url: row.get(3)?,
                        coauthors: row.get(4)?,
                    })
                }).optional()?;
                Ok(pres.map(SourceExtension::Presentation))
            }
            SourceType::General => Ok(None),
        }
    }

    fn insert_extension(conn: &Connection, source_id: &str, source_type: SourceType, input: &CreateSource) -> Result<(), ForgeError> {
        match source_type {
            SourceType::Role => {
                conn.execute(
                    "INSERT INTO source_roles (source_id, organization_id, start_date, end_date, is_current, work_arrangement, base_salary, total_comp_notes)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        source_id,
                        input.organization_id,
                        input.start_date,
                        input.end_date,
                        input.is_current.unwrap_or(0),
                        input.work_arrangement,
                        input.base_salary,
                        input.total_comp_notes,
                    ],
                )?;
            }
            SourceType::Project => {
                conn.execute(
                    "INSERT INTO source_projects (source_id, organization_id, is_personal, open_source, url, start_date, end_date)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        source_id,
                        input.organization_id,
                        input.is_personal.unwrap_or(0),
                        input.open_source.unwrap_or(0),
                        input.url,
                        input.start_date,
                        input.end_date,
                    ],
                )?;
            }
            SourceType::Education => {
                conn.execute(
                    "INSERT INTO source_education (source_id, education_type, organization_id, campus_id, field, start_date, end_date, is_in_progress, credential_id, expiration_date, url, degree_level, degree_type, certificate_subtype, gpa, location, edu_description)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
                    params![
                        source_id,
                        input.education_type.map(|e| e.to_string()).unwrap_or_else(|| "certificate".into()),
                        input.education_organization_id,
                        input.campus_id,
                        input.field,
                        input.start_date,
                        input.end_date,
                        input.is_in_progress.unwrap_or(0),
                        input.credential_id,
                        input.expiration_date,
                        input.url,
                        input.degree_level.map(|d| d.to_string()),
                        input.degree_type,
                        input.certificate_subtype.map(|c| c.to_string()),
                        input.gpa,
                        input.location,
                        input.edu_description,
                    ],
                )?;
            }
            SourceType::Presentation => {
                conn.execute(
                    "INSERT INTO source_presentations (source_id, venue, presentation_type, url, coauthors)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        source_id,
                        input.venue,
                        input.presentation_type.map(|p| p.to_string()).unwrap_or_else(|| "conference_talk".into()),
                        input.url,
                        input.coauthors,
                    ],
                )?;
            }
            SourceType::General => {}
        }
        Ok(())
    }

    // ── Row mapping ──────────────────────────────────────────────────

    fn map_source(row: &rusqlite::Row) -> rusqlite::Result<Source> {
        Ok(Source {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            source_type: row.get::<_, String>(3)?.parse().unwrap_or(SourceType::General),
            start_date: row.get(4)?,
            end_date: row.get(5)?,
            status: row.get::<_, String>(6)?.parse().unwrap_or(SourceStatus::Draft),
            updated_by: row.get::<_, String>(7)?.parse().unwrap_or(UpdatedBy::Human),
            last_derived_at: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::forge::Forge;

    fn setup() -> Forge {
        Forge::open_memory().unwrap()
    }

    #[test]
    fn create_general_source() {
        let forge = setup();
        let input = CreateSource {
            title: "Backend Engineer at Acme".into(),
            description: "Built REST APIs and microservices".into(),
            source_type: None,
            ..Default::default()
        };
        let source = SourceRepository::create(forge.conn(), &input).unwrap();
        assert_eq!(source.base.title, "Backend Engineer at Acme");
        assert_eq!(source.base.source_type, SourceType::General);
        assert_eq!(source.base.status, SourceStatus::Draft);
        assert!(source.extension.is_none());
    }

    #[test]
    fn create_role_source_with_extension() {
        let forge = setup();
        let input = CreateSource {
            title: "Senior Dev".into(),
            description: "Led team".into(),
            source_type: Some(SourceType::Role),
            is_current: Some(1),
            work_arrangement: Some("remote".into()),
            ..Default::default()
        };
        let source = SourceRepository::create(forge.conn(), &input).unwrap();
        assert_eq!(source.base.source_type, SourceType::Role);
        match source.extension {
            Some(SourceExtension::Role(role)) => {
                assert_eq!(role.is_current, 1);
                assert_eq!(role.work_arrangement, Some("remote".into()));
            }
            other => panic!("Expected Role extension, got {:?}", other),
        }
    }

    #[test]
    fn get_returns_none_for_missing() {
        let forge = setup();
        let result = SourceRepository::get(forge.conn(), "nonexistent").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn list_empty() {
        let forge = setup();
        let (sources, pagination) = SourceRepository::list(
            forge.conn(),
            &SourceFilter::default(),
            &PaginationParams::default(),
        ).unwrap();
        assert!(sources.is_empty());
        assert_eq!(pagination.total, 0);
    }

    #[test]
    fn list_with_type_filter() {
        let forge = setup();
        SourceRepository::create(forge.conn(), &CreateSource {
            title: "Role".into(),
            description: "d".into(),
            source_type: Some(SourceType::Role),
            ..Default::default()
        }).unwrap();
        SourceRepository::create(forge.conn(), &CreateSource {
            title: "General".into(),
            description: "d".into(),
            source_type: None,
            ..Default::default()
        }).unwrap();

        let (sources, _) = SourceRepository::list(
            forge.conn(),
            &SourceFilter { source_type: Some(SourceType::Role), ..Default::default() },
            &PaginationParams::default(),
        ).unwrap();
        assert_eq!(sources.len(), 1);
        assert_eq!(sources[0].base.title, "Role");
    }

    #[test]
    fn update_source_title() {
        let forge = setup();
        let created = SourceRepository::create(forge.conn(), &CreateSource {
            title: "Old Title".into(),
            description: "desc".into(),
            ..Default::default()
        }).unwrap();

        let updated = SourceRepository::update(forge.conn(), &created.base.id, &UpdateSource {
            title: Some("New Title".into()),
            ..Default::default()
        }).unwrap();
        assert_eq!(updated.base.title, "New Title");
    }

    #[test]
    fn delete_source() {
        let forge = setup();
        let created = SourceRepository::create(forge.conn(), &CreateSource {
            title: "To Delete".into(),
            description: "desc".into(),
            ..Default::default()
        }).unwrap();

        SourceRepository::delete(forge.conn(), &created.base.id).unwrap();
        assert!(SourceRepository::get(forge.conn(), &created.base.id).unwrap().is_none());
    }

    #[test]
    fn delete_missing_returns_not_found() {
        let forge = setup();
        let result = SourceRepository::delete(forge.conn(), "nonexistent");
        assert!(matches!(result, Err(ForgeError::NotFound { .. })));
    }

    #[test]
    fn search_filter() {
        let forge = setup();
        SourceRepository::create(forge.conn(), &CreateSource {
            title: "Rust Developer".into(),
            description: "Systems programming".into(),
            ..Default::default()
        }).unwrap();
        SourceRepository::create(forge.conn(), &CreateSource {
            title: "Python Dev".into(),
            description: "Data science".into(),
            ..Default::default()
        }).unwrap();

        let (sources, _) = SourceRepository::list(
            forge.conn(),
            &SourceFilter { search: Some("rust".into()), ..Default::default() },
            &PaginationParams::default(),
        ).unwrap();
        assert_eq!(sources.len(), 1);
        assert_eq!(sources[0].base.title, "Rust Developer");
    }
}
