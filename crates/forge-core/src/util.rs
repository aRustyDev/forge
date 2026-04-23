//! Common utilities used across Forge crates.

/// Generate a new UUID v4 string for entity IDs.
pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Generate an ISO 8601 UTC timestamp string (e.g. "2026-04-23T12:00:00Z").
pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_id_is_valid_uuid() {
        let id = new_id();
        assert_eq!(id.len(), 36); // 8-4-4-4-12
        assert!(uuid::Uuid::parse_str(&id).is_ok());
    }

    #[test]
    fn new_id_is_unique() {
        let a = new_id();
        let b = new_id();
        assert_ne!(a, b);
    }

    #[test]
    fn now_iso_is_rfc3339() {
        let ts = now_iso();
        assert!(ts.ends_with('Z'));
        assert!(chrono::DateTime::parse_from_rfc3339(&ts).is_ok());
    }
}
