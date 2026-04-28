//! WaSqliteAdapter — a.k.a. BrowserStore. Owns a wa-sqlite-backed
//! Database, runs migrations on open, exposes `&Database` to stores.
//!
//! No trait abstraction. The rusqlite stores in forge-sdk stay
//! unchanged; this is purely additive for the wasm32 target.

use forge_core::ForgeError;
use wasm_bindgen::prelude::*;

use crate::database::Database;
use crate::migrate::run_migrations;

/// The browser-side data layer entry point. Construct via `open()`.
pub struct WaSqliteAdapter {
    db: Database,
}

impl WaSqliteAdapter {
    /// Open (or create) the IDB-backed database, run all pending
    /// migrations, return the adapter ready for store use.
    pub async fn open(filename: &str) -> Result<Self, ForgeError> {
        let db = Database::open(filename).await?;
        let _applied = run_migrations(&db).await?;
        Ok(Self { db })
    }

    /// Borrow the underlying Database. Stores call this to issue queries.
    pub fn db(&self) -> &Database {
        &self.db
    }
}

// JS-facing wrapper. Allows the harness to call this directly without
// the JS side reaching through ForgeRuntime.
#[wasm_bindgen]
pub struct WaSqliteAdapterJs(WaSqliteAdapter);

#[wasm_bindgen]
impl WaSqliteAdapterJs {
    /// Open + run migrations. Resolves to the adapter handle.
    #[wasm_bindgen(js_name = "open")]
    pub async fn open_js(filename: String) -> Result<WaSqliteAdapterJs, JsValue> {
        let inner = WaSqliteAdapter::open(&filename)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(WaSqliteAdapterJs(inner))
    }

    /// Fire-and-forget: create a skill and return its id.
    #[wasm_bindgen(js_name = "createSkill")]
    pub async fn create_skill(&self, name: String, category: Option<String>) -> Result<String, JsValue> {
        use forge_core::SkillCategory;
        let cat = category.map(|c| c.parse::<SkillCategory>().unwrap_or(SkillCategory::Other));
        let skill = crate::stores::SkillStore::create(self.0.db(), &name, cat)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(skill.id)
    }

    /// Returns a JSON string of all skills, name-sorted.
    #[wasm_bindgen(js_name = "listSkills")]
    pub async fn list_skills(&self) -> Result<String, JsValue> {
        let skills = crate::stores::SkillStore::list(self.0.db(), None, None)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        serde_json::to_string(&skills).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    /// Delete a skill by id. Returns rows affected (0 or 1).
    #[wasm_bindgen(js_name = "deleteSkill")]
    pub async fn delete_skill(&self, id: String) -> Result<u32, JsValue> {
        let rows = crate::stores::SkillStore::delete(self.0.db(), &id)
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        Ok(rows as u32)
    }

    /// JSON of all skill categories.
    #[wasm_bindgen(js_name = "listCategories")]
    pub async fn list_categories(&self) -> Result<String, JsValue> {
        let cats = crate::stores::SkillStore::list_categories(self.0.db())
            .await
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        serde_json::to_string(&cats).map_err(|e| JsValue::from_str(&e.to_string()))
    }
}
