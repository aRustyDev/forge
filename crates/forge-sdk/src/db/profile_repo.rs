//! Profile repository — data access for the singleton user profile.
//!
//! The `user_profile` table is a singleton: it contains exactly one row,
//! seeded by migration. The repository enforces this by always fetching
//! the first row and never exposing a `create` method.
//!
//! TS source: `packages/core/src/services/profile-service.ts` (data access portions)

use forge_core::{
    Address, CreateAddress, ForgeError, ProfileUrl, ProfileUrlInput, UpdateProfile, UserProfile,
};

/// Data access layer for the singleton user profile and related entities
/// (addresses, profile URLs).
pub struct ProfileRepo {
    // database handle will be injected here
}

impl ProfileRepo {
    /// Create a new ProfileRepo instance.
    pub fn new() -> Self {
        todo!()
    }

    // ── Profile ─────────────────────────────────────────────────────

    /// Fetch the singleton user profile row.
    ///
    /// Returns `None` if the profile has not been seeded (migration not
    /// yet applied or test DB without the seed row).
    pub fn get_profile(&self) -> Result<Option<UserProfile>, ForgeError> {
        todo!()
    }

    /// Update the singleton profile with the provided patch fields.
    ///
    /// Only the fields present in `UpdateProfile` are written; absent
    /// fields are left unchanged. Returns the updated profile.
    pub fn update_profile(&self, patch: &UpdateProfile) -> Result<UserProfile, ForgeError> {
        todo!()
    }

    // ── Address ─────────────────────────────────────────────────────

    /// Fetch an address by ID.
    pub fn get_address(&self, address_id: &str) -> Result<Option<Address>, ForgeError> {
        todo!()
    }

    /// Create a new address row and return the generated ID.
    pub fn create_address(&self, input: &CreateAddress) -> Result<String, ForgeError> {
        todo!()
    }

    /// Update an existing address by ID with the provided fields.
    pub fn update_address(
        &self,
        address_id: &str,
        input: &CreateAddress,
    ) -> Result<(), ForgeError> {
        todo!()
    }

    // ── Profile URLs ────────────────────────────────────────────────

    /// List all profile URLs for the given profile, ordered by position.
    pub fn list_profile_urls(&self, profile_id: &str) -> Result<Vec<ProfileUrl>, ForgeError> {
        todo!()
    }

    /// Replace all profile URLs for the given profile with a new set.
    ///
    /// Deletes existing URLs and inserts the new ones with sequential
    /// positions. The caller must validate for duplicate keys before
    /// calling this method.
    pub fn replace_profile_urls(
        &self,
        profile_id: &str,
        urls: &[ProfileUrlInput],
    ) -> Result<(), ForgeError> {
        todo!()
    }
}
