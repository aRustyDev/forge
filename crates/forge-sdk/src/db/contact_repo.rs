//! Repository for contact persistence.
//!
//! Provides CRUD operations, junction table management, and reverse lookups
//! for the `contacts`, `contact_organizations`, `contact_job_descriptions`,
//! and `contact_resumes` tables. All method bodies are `todo!()` stubs.

use forge_core::{
    Contact, ContactFilter, ContactLink, ContactJDRelationship,
    ContactOrgRelationship, ContactResumeRelationship, ContactWithOrg,
    CreateContact, ForgeError, Pagination, UpdateContact,
};

/// Data-access repository for contacts and their junction tables.
pub struct ContactRepo;

impl ContactRepo {
    /// Create a new `ContactRepo` instance.
    pub fn new() -> Self {
        todo!()
    }

    // ── Core CRUD ───────────────────────────────────────────────────

    /// Insert a new contact row.
    pub fn create(&self, input: &CreateContact) -> Result<Contact, ForgeError> {
        todo!()
    }

    /// Fetch a single contact by primary key.
    pub fn get(&self, id: &str) -> Result<Option<Contact>, ForgeError> {
        todo!()
    }

    /// Fetch a contact with its hydrated organization name.
    pub fn get_with_org(&self, id: &str) -> Result<Option<ContactWithOrg>, ForgeError> {
        todo!()
    }

    /// List contacts with optional filtering, search, and pagination.
    pub fn list(
        &self,
        filter: Option<&ContactFilter>,
        offset: i64,
        limit: i64,
    ) -> Result<(Vec<ContactWithOrg>, Pagination), ForgeError> {
        todo!()
    }

    /// Apply a partial update to an existing contact.
    pub fn update(&self, id: &str, input: &UpdateContact) -> Result<(), ForgeError> {
        todo!()
    }

    /// Delete a contact by primary key.
    pub fn delete(&self, id: &str) -> Result<(), ForgeError> {
        todo!()
    }

    // ── Organization junction ───────────────────────────────────────

    /// Link a contact to an organization with a typed relationship (idempotent).
    pub fn link_organization(
        &self,
        contact_id: &str,
        org_id: &str,
        relationship: ContactOrgRelationship,
    ) -> Result<(), ForgeError> {
        todo!()
    }

    /// Remove a contact-organization link by composite key.
    pub fn unlink_organization(
        &self,
        contact_id: &str,
        org_id: &str,
        relationship: ContactOrgRelationship,
    ) -> Result<(), ForgeError> {
        todo!()
    }

    /// List organizations linked to a contact, with relationship type.
    pub fn list_organizations(
        &self,
        contact_id: &str,
    ) -> Result<Vec<(String, String, ContactOrgRelationship)>, ForgeError> {
        todo!()
    }

    // ── Job description junction ────────────────────────────────────

    /// Link a contact to a job description with a typed relationship (idempotent).
    pub fn link_job_description(
        &self,
        contact_id: &str,
        jd_id: &str,
        relationship: ContactJDRelationship,
    ) -> Result<(), ForgeError> {
        todo!()
    }

    /// Remove a contact-job description link by composite key.
    pub fn unlink_job_description(
        &self,
        contact_id: &str,
        jd_id: &str,
        relationship: ContactJDRelationship,
    ) -> Result<(), ForgeError> {
        todo!()
    }

    /// List job descriptions linked to a contact, with relationship type.
    pub fn list_job_descriptions(
        &self,
        contact_id: &str,
    ) -> Result<Vec<(String, String, Option<String>, ContactJDRelationship)>, ForgeError> {
        todo!()
    }

    // ── Resume junction ─────────────────────────────────────────────

    /// Link a contact to a resume with a typed relationship (idempotent).
    pub fn link_resume(
        &self,
        contact_id: &str,
        resume_id: &str,
        relationship: ContactResumeRelationship,
    ) -> Result<(), ForgeError> {
        todo!()
    }

    /// Remove a contact-resume link by composite key.
    pub fn unlink_resume(
        &self,
        contact_id: &str,
        resume_id: &str,
        relationship: ContactResumeRelationship,
    ) -> Result<(), ForgeError> {
        todo!()
    }

    /// List resumes linked to a contact, with relationship type.
    pub fn list_resumes(
        &self,
        contact_id: &str,
    ) -> Result<Vec<(String, String, ContactResumeRelationship)>, ForgeError> {
        todo!()
    }

    // ── Reverse lookups ─────────────────────────────────────────────

    /// List contacts linked to a given organization (reverse lookup).
    pub fn list_by_organization(&self, org_id: &str) -> Result<Vec<ContactLink>, ForgeError> {
        todo!()
    }

    /// List contacts linked to a given job description (reverse lookup).
    pub fn list_by_job_description(&self, jd_id: &str) -> Result<Vec<ContactLink>, ForgeError> {
        todo!()
    }

    /// List contacts linked to a given resume (reverse lookup).
    pub fn list_by_resume(&self, resume_id: &str) -> Result<Vec<ContactLink>, ForgeError> {
        todo!()
    }
}
