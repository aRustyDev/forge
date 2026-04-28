//! Error-mapping helpers for the WASM↔JS boundary.
//!
//! All wasm-bindgen extern functions that can fail return
//! `Result<JsValue, JsValue>` — the `Err` arm carries a JS `Error` object
//! (or any other thrown value). This module converts those into the
//! `forge_core::ForgeError::WasmDatabase(String)` variant gated by the
//! `wasm` feature on forge-core (added in forge-nst6 step 1).

use forge_core::ForgeError;
use wasm_bindgen::JsValue;

/// Convert a JsValue thrown from a wa-sqlite extern call into a
/// `ForgeError::WasmDatabase` carrying the JS-side message string.
///
/// Falls back to a generic placeholder when the JsValue can't be coerced
/// to a String (e.g. a thrown number or undefined).
pub fn js_value_into_forge_error(value: JsValue) -> ForgeError {
    let message = match value.as_string() {
        Some(s) => s,
        None => {
            // Try to read a `.message` property if it's an Error-shaped
            // object. js_sys::Reflect avoids pulling in extra web-sys
            // features for this single fallback path.
            js_sys::Reflect::get(&value, &JsValue::from_str("message"))
                .ok()
                .and_then(|v| v.as_string())
                .unwrap_or_else(|| format!("{value:?}"))
        }
    };
    ForgeError::WasmDatabase(message)
}

/// Convenience trait for `Result<T, JsValue>` returned by extern shims.
/// Lets callers write `.map_jsvalue_err()?` instead of an explicit closure.
pub trait MapJsValueErr<T> {
    fn map_jsvalue_err(self) -> Result<T, ForgeError>;
}

impl<T> MapJsValueErr<T> for Result<T, JsValue> {
    fn map_jsvalue_err(self) -> Result<T, ForgeError> {
        self.map_err(js_value_into_forge_error)
    }
}
