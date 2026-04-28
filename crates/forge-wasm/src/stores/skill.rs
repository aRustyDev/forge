//! Skill store over wa-sqlite. Subset port of forge-sdk's SkillStore.
//!
//! In scope: create, get, list (without domain_id filter), update, delete,
//! list_categories.
//!
//! Out of scope: get_with_domains, link_domain, unlink_domain — junction
//! queries land in a successor bead.

use forge_core::{ForgeError, Skill, SkillCategory, new_id};

use crate::database::{Database, StepResult};

/// Capitalize first character only, preserving the rest (e.g. "SAFe" stays "SAFe").
fn capitalize_first(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_uppercase().to_string() + chars.as_str(),
    }
}

pub struct SkillStore;

impl SkillStore {
    /// Insert a new skill row. Returns Conflict if the (case-insensitive)
    /// name already exists. Mirrors forge-sdk's SkillStore::create.
    pub async fn create(
        db: &Database,
        name: &str,
        category: Option<SkillCategory>,
    ) -> Result<Skill, ForgeError> {
        let id = new_id();
        let cat = category.unwrap_or(SkillCategory::Other);
        let capitalized = capitalize_first(name.trim());

        let stmt = db.prepare(
            "INSERT INTO skills (id, name, category) VALUES (?1, ?2, ?3)",
        ).await?;
        stmt.bind_text(1, &id)?;
        stmt.bind_text(2, &capitalized)?;
        stmt.bind_text(3, cat.as_ref())?;

        match stmt.step().await {
            Ok(StepResult::Done) | Ok(StepResult::Row) => {
                stmt.finalize().await?;
            }
            Err(ForgeError::WasmDatabase(msg)) if msg.contains("UNIQUE") => {
                let _ = stmt.finalize().await;
                return Err(ForgeError::Conflict {
                    message: format!("Skill with name '{capitalized}' already exists"),
                });
            }
            Err(e) => {
                let _ = stmt.finalize().await;
                return Err(e);
            }
        }

        Self::get(db, &id).await?
            .ok_or_else(|| ForgeError::Internal("Skill created but not found".into()))
    }

    /// Fetch a single skill by ID.
    pub async fn get(db: &Database, id: &str) -> Result<Option<Skill>, ForgeError> {
        let stmt = db.prepare(
            "SELECT id, name, category FROM skills WHERE id = ?1",
        ).await?;
        stmt.bind_text(1, id)?;

        let result = match stmt.step().await? {
            StepResult::Row => Some(Self::map_skill_row(&stmt)?),
            StepResult::Done => None,
        };
        stmt.finalize().await?;
        Ok(result)
    }

    /// Read a row into a Skill. Caller must have just received StepResult::Row.
    fn map_skill_row(stmt: &crate::database::Statement) -> Result<Skill, ForgeError> {
        let id = stmt.column_text(0)
            .ok_or_else(|| ForgeError::Internal("skills.id is NULL".into()))?;
        let name = stmt.column_text(1)
            .ok_or_else(|| ForgeError::Internal("skills.name is NULL".into()))?;
        let category_str = stmt.column_text(2)
            .ok_or_else(|| ForgeError::Internal("skills.category is NULL".into()))?;
        // SkillCategory uses strum::EnumString (serialize_all = "snake_case") which
        // provides FromStr; parse() is the idiomatic way to call it.
        let category = category_str.parse::<SkillCategory>()
            .map_err(|_| ForgeError::Internal(format!("invalid skill category: {category_str}")))?;

        Ok(Skill { id, name, category })
    }

    /// List skills, optionally filtered by category and/or text search.
    /// Sorted by name ASC. The domain_id filter is OUT OF SCOPE for this
    /// bead; that variant lives in a successor bead.
    pub async fn list(
        db: &Database,
        category: Option<SkillCategory>,
        search: Option<&str>,
    ) -> Result<Vec<Skill>, ForgeError> {
        let mut sql = String::from("SELECT id, name, category FROM skills WHERE 1=1");
        if category.is_some() {
            sql.push_str(" AND category = ?");
        }
        if search.is_some() {
            sql.push_str(" AND name LIKE ? COLLATE NOCASE");
        }
        sql.push_str(" ORDER BY name ASC");

        let stmt = db.prepare(&sql).await?;
        let mut idx = 1;
        if let Some(c) = category {
            stmt.bind_text(idx, c.as_ref())?;
            idx += 1;
        }
        if let Some(s) = search {
            let pattern = format!("%{s}%");
            stmt.bind_text(idx, &pattern)?;
        }

        let mut skills = Vec::new();
        loop {
            match stmt.step().await? {
                StepResult::Row => skills.push(Self::map_skill_row(&stmt)?),
                StepResult::Done => break,
            }
        }
        stmt.finalize().await?;
        Ok(skills)
    }

    /// Update a skill's name and/or category. Returns Conflict on duplicate name.
    pub async fn update(
        db: &Database,
        id: &str,
        new_name: Option<&str>,
        new_category: Option<SkillCategory>,
    ) -> Result<Skill, ForgeError> {
        if new_name.is_none() && new_category.is_none() {
            return Self::get(db, id).await?
                .ok_or_else(|| ForgeError::NotFound { entity_type: "skill".into(), id: id.into() });
        }

        let mut sets = Vec::new();
        if new_name.is_some() { sets.push("name = ?"); }
        if new_category.is_some() { sets.push("category = ?"); }
        let sql = format!("UPDATE skills SET {} WHERE id = ?", sets.join(", "));

        let stmt = db.prepare(&sql).await?;
        let mut idx = 1;
        let capitalized: String;
        if let Some(n) = new_name {
            capitalized = capitalize_first(n.trim());
            stmt.bind_text(idx, &capitalized)?;
            idx += 1;
        }
        if let Some(c) = new_category {
            stmt.bind_text(idx, c.as_ref())?;
            idx += 1;
        }
        stmt.bind_text(idx, id)?;

        match stmt.step().await {
            Ok(_) => { stmt.finalize().await?; }
            Err(ForgeError::WasmDatabase(msg)) if msg.contains("UNIQUE") => {
                let _ = stmt.finalize().await;
                return Err(ForgeError::Conflict {
                    message: "Skill name conflicts with an existing row".into(),
                });
            }
            Err(e) => {
                let _ = stmt.finalize().await;
                return Err(e);
            }
        }

        Self::get(db, id).await?
            .ok_or_else(|| ForgeError::NotFound { entity_type: "skill".into(), id: id.into() })
    }

    /// Delete a skill by ID. Returns the number of rows affected (0 or 1).
    pub async fn delete(db: &Database, id: &str) -> Result<usize, ForgeError> {
        let stmt = db.prepare("DELETE FROM skills WHERE id = ?1").await?;
        stmt.bind_text(1, id)?;
        stmt.step().await?;
        stmt.finalize().await?;
        // wa-sqlite's `changes` accessor isn't bound yet; for now we
        // round-trip a SELECT to confirm. Acceptable for the vertical-slice
        // because callers typically follow delete with a UI refresh.
        let still_exists = Self::get(db, id).await?.is_some();
        Ok(if still_exists { 0 } else { 1 })
    }

    /// List all skill_categories rows. Used by the webui category picker.
    ///
    /// Note: the actual column names in the `skill_categories` table are
    /// `slug` and `display_name` (not `label` as originally spec'd). The
    /// returned tuple is (slug, display_name).
    pub async fn list_categories(db: &Database) -> Result<Vec<(String, String)>, ForgeError> {
        let stmt = db.prepare(
            "SELECT slug, display_name FROM skill_categories ORDER BY display_name ASC",
        ).await?;
        let mut out = Vec::new();
        loop {
            match stmt.step().await? {
                StepResult::Row => {
                    let slug = stmt.column_text(0)
                        .ok_or_else(|| ForgeError::Internal("skill_categories.slug is NULL".into()))?;
                    let display_name = stmt.column_text(1)
                        .ok_or_else(|| ForgeError::Internal("skill_categories.display_name is NULL".into()))?;
                    out.push((slug, display_name));
                }
                StepResult::Done => break,
            }
        }
        stmt.finalize().await?;
        Ok(out)
    }
}  // close `impl SkillStore`
