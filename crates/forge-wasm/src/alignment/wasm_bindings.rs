//! JS-callable wrapper for AlignmentEngine. Mirrors afyg's
//! SkillGraphRuntimeJs convention: takes a wrapped runtime, returns
//! AlignmentResult as a JSON string.

use wasm_bindgen::prelude::*;

use crate::skill_graph::SkillGraphRuntime;

use super::config::AlignmentConfig;
use super::engine::{AlignmentEngine, JdAlignmentInput, ResumeAlignmentInput};

#[wasm_bindgen]
pub struct AlignmentEngineJs {
    runtime: SkillGraphRuntime,
    config: AlignmentConfig,
}

#[wasm_bindgen]
impl AlignmentEngineJs {
    /// Construct from snapshot bytes. Ownership of the runtime stays with
    /// the wrapper.
    #[wasm_bindgen(js_name = fromSnapshot)]
    pub fn from_snapshot(snapshot: &[u8]) -> Result<AlignmentEngineJs, JsValue> {
        let runtime = SkillGraphRuntime::from_snapshot(snapshot)
            .map_err(|e| JsValue::from_str(&format!("{e:?}")))?;
        Ok(AlignmentEngineJs {
            runtime,
            config: AlignmentConfig::default(),
        })
    }

    /// Run alignment. Inputs are JSON strings of ResumeAlignmentInput +
    /// JdAlignmentInput. Returns an AlignmentResult as a JSON string.
    #[wasm_bindgen(js_name = align)]
    pub fn align(&self, resume_json: &str, jd_json: &str) -> Result<String, JsValue> {
        let resume: ResumeAlignmentInput = serde_json::from_str(resume_json)
            .map_err(|e| JsValue::from_str(&format!("parse resume: {e}")))?;
        let jd: JdAlignmentInput = serde_json::from_str(jd_json)
            .map_err(|e| JsValue::from_str(&format!("parse jd: {e}")))?;
        let engine = AlignmentEngine::new(&self.runtime, &self.runtime).with_config(self.config);
        let result = engine
            .align(&resume, &jd)
            .map_err(|e| JsValue::from_str(&format!("{e:?}")))?;
        serde_json::to_string(&result).map_err(|e| JsValue::from_str(&format!("serialize: {e}")))
    }
}
