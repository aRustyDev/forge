//! Profile service — business logic for user profile management.
//!
//! The `user_profile` table is a singleton: it contains exactly one row,
//! seeded by migration. The service layer enforces the singleton constraint
//! by always fetching the existing row before updates and by never creating
//! new profile rows.
//!
//! Salary-expectation ordering (minimum <= target <= stretch) is validated
//! at the service layer before delegation to the repository.
//!
//! TS source: `packages/core/src/services/profile-service.ts`

use forge_core::{ForgeError, UpdateProfile, UserProfile};

/// Business logic for the singleton user profile, including salary
/// validation and address/URL upsert orchestration.
pub struct ProfileService {
    // repository / ELM handle will be injected here
}

impl ProfileService {
    /// Create a new ProfileService instance.
    pub fn new() -> Self {
        todo!()
    }

    /// Get the single user profile.
    ///
    /// Returns a `NOT_FOUND` error if the profile row has not been seeded.
    pub fn get_profile(&self) -> Result<UserProfile, ForgeError> {
        todo!()
    }

    /// Update the user profile with a partial patch.
    ///
    /// Validates:
    /// - Name must not be null or empty.
    /// - Salary expectations must satisfy: minimum <= target <= stretch.
    /// - URL keys must be unique (no duplicates).
    ///
    /// Handles address upsert: creates a new address when none is linked,
    /// updates the existing address otherwise.
    ///
    /// Handles URL array replacement: deletes existing URLs and inserts
    /// the new set with sequential positions.
    pub fn update_profile(&self, patch: UpdateProfile) -> Result<UserProfile, ForgeError> {
        todo!()
    }
}
