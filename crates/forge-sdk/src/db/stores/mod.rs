//! Data access stores for Forge entities.

pub mod bullet;
pub mod contact;
pub mod jd;
pub mod note;
pub mod organization;
pub mod perspective;
pub mod profile;
pub mod resume;
pub mod skill;
pub mod source;
pub mod summary;

pub use bullet::BulletStore;
pub use contact::ContactStore;
pub use jd::JdStore;
pub use note::NoteStore;
pub use organization::OrganizationStore;
pub use perspective::PerspectiveStore;
pub use profile::ProfileStore;
pub use resume::ResumeStore;
pub use skill::SkillStore;
pub use source::SourceStore;
pub use summary::SummaryStore;
