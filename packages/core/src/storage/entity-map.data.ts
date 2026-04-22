/**
 * Entity map runtime data — the concrete relationship map for all 47 Forge
 * entities.
 *
 * Hand-maintained from the actual SQLite schema (PRAGMA table_info + PRAGMA
 * foreign_key_list at migration 047). Validated by
 * __tests__/entity-map.test.ts which compares this file against the live
 * schema.
 *
 * Organization: one entry per entity, alphabetical. Each entry has:
 *   - fields: column definitions with type/required/default/fk/enum/boolean/lazy
 *   - cascade: CHILD tables whose rows are deleted when THIS entity is deleted
 *   - restrict: CHILD tables whose presence BLOCKS deleting this entity
 *   - setNull: CHILD tables whose FK to THIS entity is nulled on delete
 *   - hooks: optional lifecycle callbacks (before/after CRUD)
 *
 * The cascade/restrict/setNull rules are INVERTED from the raw FK
 * declarations: a FK on table T with `ON DELETE CASCADE` referencing
 * parent P becomes a cascade rule on P pointing at T.
 */

import type { EntityDefinition, EntityMap, EntityMapDeps } from './entity-map'
import {
  captureBulletSnapshotHook,
  captureSnapshotHook,
  createEmbedHook,
  isoNow,
  setUpdatedAt,
} from './hooks/common'

// ─── Shared enum literals ─────────────────────────────────────────────────

const BULLET_PERSPECTIVE_STATUSES = [
  'draft',
  'in_review',
  'approved',
  'rejected',
  'archived',
] as const

const SOURCE_STATUSES = [
  'draft',
  'in_review',
  'approved',
  'rejected',
  'archived',
  'deriving',
] as const

const SOURCE_TYPES = [
  'role',
  'project',
  'education',
  'general',
  'presentation',
] as const

const RESUME_STATUSES = BULLET_PERSPECTIVE_STATUSES

const JD_STATUSES = [
  'discovered',
  'analyzing',
  'applying',
  'applied',
  'interviewing',
  'offered',
  'rejected',
  'withdrawn',
  'closed',
] as const

const ORG_TYPES = [
  'company',
  'nonprofit',
  'government',
  'military',
  'education',
  'volunteer',
  'freelance',
  'other',
] as const

const EMPLOYMENT_TYPES = [
  'civilian',
  'contractor',
  'military_active',
  'military_reserve',
  'volunteer',
  'intern',
] as const

const ORG_STATUSES = [
  'backlog',
  'researching',
  'exciting',
  'interested',
  'acceptable',
  'excluded',
] as const

const ORG_TAG_VALUES = [
  'company',
  'vendor',
  'platform',
  'university',
  'school',
  'nonprofit',
  'government',
  'military',
  'conference',
  'volunteer',
  'freelance',
  'other',
] as const

const MODALITIES = ['in_person', 'remote', 'hybrid'] as const

const EDUCATION_TYPES = ['degree', 'certificate', 'course', 'self_taught'] as const

const DEGREE_LEVELS = [
  'associate',
  'bachelors',
  'masters',
  'doctoral',
  'graduate_certificate',
] as const

const CERTIFICATE_SUBTYPES = ['professional', 'vendor', 'completion'] as const

const PRESENTATION_TYPES = [
  'conference_talk',
  'workshop',
  'poster',
  'webinar',
  'lightning_talk',
  'panel',
  'internal',
] as const

const CREDENTIAL_TYPES = [
  'clearance',
  'drivers_license',
  'bar_admission',
  'medical_license',
] as const

const CREDENTIAL_STATUSES = ['active', 'inactive', 'expired'] as const

const CONTACT_ORG_RELATIONSHIPS = [
  'recruiter',
  'hr',
  'referral',
  'peer',
  'manager',
  'other',
] as const

const CONTACT_JD_RELATIONSHIPS = [
  'hiring_manager',
  'recruiter',
  'interviewer',
  'referral',
  'other',
] as const

const CONTACT_RESUME_RELATIONSHIPS = ['reference', 'recommender', 'other'] as const

const PROMPT_LOG_ENTITY_TYPES = [
  'bullet',
  'perspective',
  'job_description',
] as const

const EMBEDDING_ENTITY_TYPES = [
  'bullet',
  'perspective',
  'jd_requirement',
  'source',
] as const

const NOTE_REF_ENTITY_TYPES = [
  'source',
  'bullet',
  'perspective',
  'resume_entry',
  'resume',
  'skill',
  'organization',
  'job_description',
  'contact',
  'credential',
  'certification',
] as const

const PENDING_DERIVATION_TYPES = ['source', 'bullet'] as const

const SECTION_ENTRY_TYPES = [
  'experience',
  'skills',
  'education',
  'projects',
  'clearance',
  'presentations',
  'certifications',
  'awards',
  'freeform',
] as const

const PERSPECTIVE_FRAMINGS = ['accomplishment', 'responsibility', 'context'] as const

const UPDATED_BY_VALUES = ['human', 'ai'] as const

// ─── Common field fragments ────────────────────────────────────────────────

const ID_FIELD = { type: 'text' as const, required: true }

const CREATED_AT = {
  type: 'text' as const,
  required: true,
  default: () => isoNow(),
}

const UPDATED_AT = {
  type: 'text' as const,
  required: true,
  default: () => isoNow(),
}

// ─── Static shape (no hooks) — used for type inference ─────────────────────
//
// This object contains the full field + relationship schema for every
// entity. Hooks are attached inside buildEntityMap() so they can close
// over injected services. TypeScript infers entity types from this shape
// (see entity-types.ts).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ENTITY_MAP_SHAPE = {

  // ══════════════════════════════════════════════════════════════════════
  // CORE CONTENT
  // ══════════════════════════════════════════════════════════════════════

  sources: {
    fields: {
      id: ID_FIELD,
      title: { type: 'text', required: true },
      description: { type: 'text', required: true },
      source_type: {
        type: 'text', required: true, default: 'general', enum: SOURCE_TYPES,
      },
      start_date: { type: 'text' },
      end_date: { type: 'text' },
      status: {
        type: 'text', required: true, default: 'draft', enum: SOURCE_STATUSES,
      },
      updated_by: {
        type: 'text', required: true, default: 'human', enum: UPDATED_BY_VALUES,
      },
      last_derived_at: { type: 'text' },
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    },
    cascade: [
      { entity: 'source_roles', field: 'source_id' },
      { entity: 'source_projects', field: 'source_id' },
      { entity: 'source_education', field: 'source_id' },
      { entity: 'source_presentations', field: 'source_id' },
      { entity: 'bullet_sources', field: 'source_id' },
      { entity: 'source_skills', field: 'source_id' },
    ],
    restrict: [],
    setNull: [
      { entity: 'resume_entries', field: 'source_id' },
    ],
  },

  source_roles: {
    fields: {
      source_id: {
        type: 'text', required: true,
        fk: { entity: 'sources', field: 'id' },
      },
      organization_id: {
        type: 'text',
        fk: { entity: 'organizations', field: 'id', nullable: true },
      },
      start_date: { type: 'text' },
      end_date: { type: 'text' },
      is_current: { type: 'integer', required: true, default: 0, boolean: true },
      work_arrangement: { type: 'text' },
      base_salary: { type: 'integer' },
      total_comp_notes: { type: 'text' },
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['source_id'],
  },

  source_projects: {
    fields: {
      source_id: {
        type: 'text', required: true,
        fk: { entity: 'sources', field: 'id' },
      },
      organization_id: {
        type: 'text',
        fk: { entity: 'organizations', field: 'id', nullable: true },
      },
      is_personal: { type: 'integer', required: true, default: 0, boolean: true },
      url: { type: 'text' },
      start_date: { type: 'text' },
      end_date: { type: 'text' },
      open_source: { type: 'integer', required: true, default: 0, boolean: true },
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['source_id'],
  },

  source_education: {
    fields: {
      source_id: {
        type: 'text', required: true,
        fk: { entity: 'sources', field: 'id' },
      },
      education_type: { type: 'text', required: true, enum: EDUCATION_TYPES },
      organization_id: {
        type: 'text',
        fk: { entity: 'organizations', field: 'id', nullable: true },
      },
      campus_id: {
        type: 'text',
        fk: { entity: 'org_locations', field: 'id', nullable: true },
      },
      field: { type: 'text' },
      start_date: { type: 'text' },
      end_date: { type: 'text' },
      is_in_progress: { type: 'integer', required: true, default: 0, boolean: true },
      credential_id: { type: 'text' },
      expiration_date: { type: 'text' },
      url: { type: 'text' },
      degree_level: { type: 'text', enum: DEGREE_LEVELS },
      degree_type: { type: 'text' },
      certificate_subtype: { type: 'text', enum: CERTIFICATE_SUBTYPES },
      gpa: { type: 'text' },
      location: { type: 'text' },
      edu_description: { type: 'text' },
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['source_id'],
  },

  source_presentations: {
    fields: {
      source_id: {
        type: 'text', required: true,
        fk: { entity: 'sources', field: 'id' },
      },
      venue: { type: 'text' },
      presentation_type: {
        type: 'text', required: true, default: 'conference_talk', enum: PRESENTATION_TYPES,
      },
      url: { type: 'text' },
      coauthors: { type: 'text' },
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['source_id'],
  },

  bullets: {
    fields: {
      id: ID_FIELD,
      content: { type: 'text', required: true },
      source_content_snapshot: { type: 'text', required: true },
      metrics: { type: 'text' },
      status: {
        type: 'text', required: true, default: 'in_review',
        enum: BULLET_PERSPECTIVE_STATUSES,
      },
      rejection_reason: { type: 'text' },
      prompt_log_id: {
        type: 'text',
        fk: { entity: 'prompt_logs', field: 'id', nullable: true },
      },
      approved_at: { type: 'text' },
      approved_by: { type: 'text' },
      domain: { type: 'text' },
      created_at: CREATED_AT,
    },
    cascade: [
      { entity: 'bullet_sources', field: 'bullet_id' },
      { entity: 'bullet_skills', field: 'bullet_id' },
    ],
    restrict: [
      {
        entity: 'perspectives', field: 'bullet_id',
        message: 'Cannot delete bullet: {count} perspective(s) depend on it',
      },
    ],
    setNull: [],
  },

  perspectives: {
    fields: {
      id: ID_FIELD,
      bullet_id: {
        type: 'text', required: true,
        fk: { entity: 'bullets', field: 'id' },
      },
      content: { type: 'text', required: true },
      bullet_content_snapshot: { type: 'text', required: true },
      target_archetype: { type: 'text' },
      domain: { type: 'text' },
      framing: { type: 'text', required: true, enum: PERSPECTIVE_FRAMINGS },
      status: {
        type: 'text', required: true, default: 'in_review',
        enum: BULLET_PERSPECTIVE_STATUSES,
      },
      rejection_reason: { type: 'text' },
      prompt_log_id: {
        type: 'text',
        fk: { entity: 'prompt_logs', field: 'id', nullable: true },
      },
      approved_at: { type: 'text' },
      approved_by: { type: 'text' },
      created_at: CREATED_AT,
    },
    cascade: [
      { entity: 'perspective_skills', field: 'perspective_id' },
    ],
    restrict: [
      {
        entity: 'resume_entries', field: 'perspective_id',
        message: 'Cannot delete perspective: used in {count} resume entry/entries',
      },
    ],
    setNull: [],
  },

  // ══════════════════════════════════════════════════════════════════════
  // SKILLS & TAXONOMY
  // ══════════════════════════════════════════════════════════════════════

  skills: {
    fields: {
      id: ID_FIELD,
      name: { type: 'text', required: true, unique: true },
      category: {
        type: 'text', required: true, default: 'other',
        fk: { entity: 'skill_categories', field: 'slug' },
      },
      created_at: CREATED_AT,
    },
    cascade: [
      { entity: 'bullet_skills', field: 'skill_id' },
      { entity: 'perspective_skills', field: 'skill_id' },
      { entity: 'source_skills', field: 'skill_id' },
      { entity: 'job_description_skills', field: 'skill_id' },
      { entity: 'resume_skills', field: 'skill_id' },
      { entity: 'skill_domains', field: 'skill_id' },
      { entity: 'summary_skills', field: 'skill_id' },
      { entity: 'certification_skills', field: 'skill_id' },
    ],
    restrict: [],
    setNull: [],
  },

  skill_categories: {
    fields: {
      id: ID_FIELD,
      slug: { type: 'text', required: true, unique: true },
      display_name: { type: 'text', required: true },
      position: { type: 'integer', required: true, default: 0 },
    },
    cascade: [],
    restrict: [],
    setNull: [],
  },

  domains: {
    fields: {
      id: ID_FIELD,
      name: { type: 'text', required: true, unique: true },
      description: { type: 'text' },
      created_at: CREATED_AT,
    },
    cascade: [
      { entity: 'archetype_domains', field: 'domain_id' },
      { entity: 'skill_domains', field: 'domain_id' },
    ],
    restrict: [],
    setNull: [],
  },

  archetypes: {
    fields: {
      id: ID_FIELD,
      name: { type: 'text', required: true, unique: true },
      description: { type: 'text' },
      created_at: CREATED_AT,
    },
    cascade: [
      { entity: 'archetype_domains', field: 'archetype_id' },
    ],
    restrict: [],
    setNull: [],
  },

  industries: {
    fields: {
      id: ID_FIELD,
      name: { type: 'text', required: true, unique: true },
      description: { type: 'text' },
      created_at: CREATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [
      { entity: 'organizations', field: 'industry_id' },
      { entity: 'summaries', field: 'industry_id' },
    ],
  },

  role_types: {
    fields: {
      id: ID_FIELD,
      name: { type: 'text', required: true, unique: true },
      description: { type: 'text' },
      created_at: CREATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [
      { entity: 'summaries', field: 'role_type_id' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // ORGANIZATIONS & CONTACTS
  // ══════════════════════════════════════════════════════════════════════

  organizations: {
    fields: {
      id: ID_FIELD,
      name: { type: 'text', required: true },
      org_type: { type: 'text', default: 'company', enum: ORG_TYPES },
      industry: { type: 'text' },
      size: { type: 'text' },
      worked: { type: 'integer', required: true, default: 0, boolean: true },
      employment_type: { type: 'text', enum: EMPLOYMENT_TYPES },
      website: { type: 'text' },
      linkedin_url: { type: 'text' },
      glassdoor_url: { type: 'text' },
      glassdoor_rating: { type: 'real' },
      status: { type: 'text', enum: ORG_STATUSES },
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
      industry_id: {
        type: 'text',
        fk: { entity: 'industries', field: 'id', nullable: true },
      },
    },
    cascade: [
      { entity: 'org_tags', field: 'organization_id' },
      { entity: 'org_locations', field: 'organization_id' },
      { entity: 'org_aliases', field: 'organization_id' },
      { entity: 'contact_organizations', field: 'organization_id' },
    ],
    restrict: [],
    setNull: [
      { entity: 'source_roles', field: 'organization_id' },
      { entity: 'source_projects', field: 'organization_id' },
      { entity: 'source_education', field: 'organization_id' },
      { entity: 'contacts', field: 'organization_id' },
      { entity: 'job_descriptions', field: 'organization_id' },
      { entity: 'credentials', field: 'organization_id' },
      { entity: 'certifications', field: 'issuer_id' },
    ],
  },

  org_locations: {
    fields: {
      id: ID_FIELD,
      organization_id: {
        type: 'text', required: true,
        fk: { entity: 'organizations', field: 'id' },
      },
      name: { type: 'text', required: true },
      modality: { type: 'text', required: true, default: 'in_person', enum: MODALITIES },
      address_id: {
        type: 'text',
        fk: { entity: 'addresses', field: 'id', nullable: true },
      },
      is_headquarters: { type: 'integer', required: true, default: 0, boolean: true },
      created_at: CREATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [
      { entity: 'source_education', field: 'campus_id' },
    ],
  },

  org_tags: {
    fields: {
      organization_id: {
        type: 'text', required: true,
        fk: { entity: 'organizations', field: 'id' },
      },
      tag: { type: 'text', required: true, enum: ORG_TAG_VALUES },
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['organization_id', 'tag'],
  },

  org_aliases: {
    fields: {
      id: ID_FIELD,
      organization_id: {
        type: 'text', required: true,
        fk: { entity: 'organizations', field: 'id' },
      },
      alias: { type: 'text', required: true },
    },
    cascade: [],
    restrict: [],
    setNull: [],
  },

  contacts: {
    fields: {
      id: ID_FIELD,
      name: { type: 'text', required: true },
      title: { type: 'text' },
      email: { type: 'text' },
      phone: { type: 'text' },
      linkedin: { type: 'text' },
      team: { type: 'text' },
      dept: { type: 'text' },
      notes: { type: 'text' },
      organization_id: {
        type: 'text',
        fk: { entity: 'organizations', field: 'id', nullable: true },
      },
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    },
    cascade: [
      { entity: 'contact_organizations', field: 'contact_id' },
      { entity: 'contact_job_descriptions', field: 'contact_id' },
      { entity: 'contact_resumes', field: 'contact_id' },
    ],
    restrict: [],
    setNull: [],
  },

  // ══════════════════════════════════════════════════════════════════════
  // RESUMES & SECTIONS
  // ══════════════════════════════════════════════════════════════════════

  resumes: {
    fields: {
      id: ID_FIELD,
      name: { type: 'text', required: true },
      target_role: { type: 'text', required: true },
      target_employer: { type: 'text', required: true },
      archetype: { type: 'text', required: true },
      status: {
        type: 'text', required: true, default: 'draft', enum: RESUME_STATUSES,
      },
      header: { type: 'json', lazy: true },
      summary_id: {
        type: 'text',
        fk: { entity: 'summaries', field: 'id', nullable: true },
      },
      markdown_override: { type: 'text', lazy: true },
      markdown_override_updated_at: { type: 'text' },
      latex_override: { type: 'text', lazy: true },
      latex_override_updated_at: { type: 'text' },
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
      generated_tagline: { type: 'text' },
      tagline_override: { type: 'text' },
      summary_override: { type: 'text', lazy: true },
      summary_override_updated_at: { type: 'text' },
      show_clearance_in_header: {
        type: 'integer', required: true, default: 1, boolean: true,
      },
    },
    cascade: [
      { entity: 'resume_sections', field: 'resume_id' },
      { entity: 'resume_entries', field: 'resume_id' },
      { entity: 'resume_certifications', field: 'resume_id' },
      { entity: 'job_description_resumes', field: 'resume_id' },
      { entity: 'contact_resumes', field: 'resume_id' },
    ],
    restrict: [],
    setNull: [],
  },

  resume_sections: {
    fields: {
      id: ID_FIELD,
      resume_id: {
        type: 'text', required: true,
        fk: { entity: 'resumes', field: 'id' },
      },
      title: { type: 'text', required: true },
      entry_type: { type: 'text', required: true, enum: SECTION_ENTRY_TYPES },
      position: { type: 'integer', required: true, default: 0 },
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    },
    cascade: [
      { entity: 'resume_entries', field: 'section_id' },
      { entity: 'resume_skills', field: 'section_id' },
      { entity: 'resume_certifications', field: 'section_id' },
    ],
    restrict: [],
    setNull: [],
  },

  resume_entries: {
    fields: {
      id: ID_FIELD,
      resume_id: {
        type: 'text', required: true,
        fk: { entity: 'resumes', field: 'id' },
      },
      section_id: {
        type: 'text', required: true,
        fk: { entity: 'resume_sections', field: 'id' },
      },
      perspective_id: {
        type: 'text',
        fk: { entity: 'perspectives', field: 'id', nullable: true },
      },
      content: { type: 'text' },
      perspective_content_snapshot: { type: 'text' },
      position: { type: 'integer', required: true, default: 0 },
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
      source_id: {
        type: 'text',
        fk: { entity: 'sources', field: 'id', nullable: true },
      },
    },
    cascade: [],
    restrict: [],
    setNull: [],
  },

  resume_skills: {
    fields: {
      id: ID_FIELD,
      section_id: {
        type: 'text', required: true,
        fk: { entity: 'resume_sections', field: 'id' },
      },
      skill_id: {
        type: 'text', required: true,
        fk: { entity: 'skills', field: 'id' },
      },
      position: { type: 'integer', required: true, default: 0 },
      created_at: CREATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [],
  },

  resume_certifications: {
    fields: {
      id: ID_FIELD,
      resume_id: {
        type: 'text', required: true,
        fk: { entity: 'resumes', field: 'id' },
      },
      certification_id: {
        type: 'text', required: true,
        fk: { entity: 'certifications', field: 'id' },
      },
      section_id: {
        type: 'text', required: true,
        fk: { entity: 'resume_sections', field: 'id' },
      },
      position: { type: 'integer', required: true, default: 0 },
      created_at: CREATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [],
  },

  resume_templates: {
    fields: {
      id: ID_FIELD,
      name: { type: 'text', required: true },
      description: { type: 'text' },
      sections: { type: 'json', required: true, lazy: true },
      is_builtin: { type: 'integer', required: true, default: 0, boolean: true },
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [],
  },

  // ══════════════════════════════════════════════════════════════════════
  // SUMMARIES
  // ══════════════════════════════════════════════════════════════════════

  summaries: {
    fields: {
      id: ID_FIELD,
      title: { type: 'text', required: true },
      role: { type: 'text' },
      description: { type: 'text' },
      is_template: { type: 'integer', required: true, default: 0, boolean: true },
      industry_id: {
        type: 'text',
        fk: { entity: 'industries', field: 'id', nullable: true },
      },
      role_type_id: {
        type: 'text',
        fk: { entity: 'role_types', field: 'id', nullable: true },
      },
      notes: { type: 'text' },
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    },
    cascade: [
      { entity: 'summary_skills', field: 'summary_id' },
    ],
    restrict: [],
    setNull: [
      { entity: 'resumes', field: 'summary_id' },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // JOB DESCRIPTIONS
  // ══════════════════════════════════════════════════════════════════════

  job_descriptions: {
    fields: {
      id: ID_FIELD,
      organization_id: {
        type: 'text',
        fk: { entity: 'organizations', field: 'id', nullable: true },
      },
      title: { type: 'text', required: true },
      url: { type: 'text' },
      raw_text: { type: 'text', required: true },
      status: {
        type: 'text', required: true, default: 'discovered', enum: JD_STATUSES,
      },
      salary_range: { type: 'text' },
      salary_min: { type: 'integer' },
      salary_max: { type: 'integer' },
      location: { type: 'text' },
      parsed_sections: { type: 'text' },
      work_posture: { type: 'text' },
      parsed_locations: { type: 'text' },
      salary_period: { type: 'text' },
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    },
    cascade: [
      { entity: 'job_description_skills', field: 'job_description_id' },
      { entity: 'job_description_resumes', field: 'job_description_id' },
      { entity: 'contact_job_descriptions', field: 'job_description_id' },
    ],
    restrict: [],
    setNull: [],
  },

  // ══════════════════════════════════════════════════════════════════════
  // QUALIFICATIONS
  // ══════════════════════════════════════════════════════════════════════

  credentials: {
    fields: {
      id: ID_FIELD,
      credential_type: { type: 'text', required: true, enum: CREDENTIAL_TYPES },
      label: { type: 'text', required: true },
      status: {
        type: 'text', required: true, default: 'active', enum: CREDENTIAL_STATUSES,
      },
      organization_id: {
        type: 'text',
        fk: { entity: 'organizations', field: 'id', nullable: true },
      },
      details: { type: 'json', required: true, default: () => ({}), lazy: true },
      issued_date: { type: 'text' },
      expiry_date: { type: 'text' },
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [],
  },

  certifications: {
    fields: {
      id: ID_FIELD,
      short_name: { type: 'text', required: true },
      long_name: { type: 'text', required: true },
      cert_id: { type: 'text' },
      issuer_id: {
        type: 'text',
        fk: { entity: 'organizations', field: 'id', nullable: true },
      },
      date_earned: { type: 'text' },
      expiry_date: { type: 'text' },
      credential_id: { type: 'text' },
      credential_url: { type: 'text' },
      credly_url: { type: 'text' },
      in_progress: { type: 'integer', required: true, default: 0, boolean: true },
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    },
    cascade: [
      { entity: 'certification_skills', field: 'certification_id' },
      { entity: 'resume_certifications', field: 'certification_id' },
    ],
    restrict: [],
    setNull: [],
  },

  // ══════════════════════════════════════════════════════════════════════
  // USER PROFILE & NOTES
  // ══════════════════════════════════════════════════════════════════════

  addresses: {
    fields: {
      id: ID_FIELD,
      name: { type: 'text', required: true },
      street_1: { type: 'text' },
      street_2: { type: 'text' },
      city: { type: 'text' },
      state: { type: 'text' },
      zip: { type: 'text' },
      country_code: { type: 'text', default: 'US' },
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [
      { entity: 'org_locations', field: 'address_id' },
    ],
  },

  profile_urls: {
    fields: {
      id: ID_FIELD,
      profile_id: {
        type: 'text', required: true,
        fk: { entity: 'user_profile', field: 'id' },
      },
      key: { type: 'text', required: true },
      url: { type: 'text', required: true },
      position: { type: 'integer', required: true, default: 0 },
      created_at: CREATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [],
  },

  user_profile: {
    fields: {
      id: ID_FIELD,
      name: { type: 'text', required: true },
      email: { type: 'text' },
      phone: { type: 'text' },
      address_id: {
        type: 'text',
        fk: { entity: 'addresses', field: 'id', nullable: true },
      },
      salary_minimum: { type: 'integer' },
      salary_target: { type: 'integer' },
      salary_stretch: { type: 'integer' },
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    },
    cascade: [
      { entity: 'profile_urls', field: 'profile_id' },
    ],
    restrict: [],
    setNull: [],
  },

  answer_bank: {
    fields: {
      id: ID_FIELD,
      field_kind: { type: 'text', required: true, unique: true },
      label: { type: 'text', required: true },
      value: { type: 'text', required: true },
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [],
  },

  extension_logs: {
    fields: {
      id: ID_FIELD,
      error_code: { type: 'text', required: true },
      message: { type: 'text', required: true },
      layer: { type: 'text', required: true },
      plugin: { type: 'text' },
      url: { type: 'text' },
      context: { type: 'text' },
      created_at: CREATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [],
  },

  user_notes: {
    fields: {
      id: ID_FIELD,
      title: { type: 'text' },
      content: { type: 'text', required: true },
      created_at: CREATED_AT,
      updated_at: UPDATED_AT,
    },
    cascade: [
      { entity: 'note_references', field: 'note_id' },
    ],
    restrict: [],
    setNull: [],
  },

  note_references: {
    fields: {
      note_id: {
        type: 'text', required: true,
        fk: { entity: 'user_notes', field: 'id' },
      },
      entity_type: { type: 'text', required: true, enum: NOTE_REF_ENTITY_TYPES },
      entity_id: { type: 'text', required: true },
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['note_id', 'entity_type', 'entity_id'],
  },

  // ══════════════════════════════════════════════════════════════════════
  // LOGGING & SYSTEM
  // ══════════════════════════════════════════════════════════════════════

  prompt_logs: {
    fields: {
      id: ID_FIELD,
      entity_type: {
        type: 'text', required: true, enum: PROMPT_LOG_ENTITY_TYPES,
      },
      entity_id: { type: 'text', required: true },
      prompt_template: { type: 'text', required: true },
      prompt_input: { type: 'text', required: true, lazy: true },
      raw_response: { type: 'text', required: true, lazy: true },
      created_at: CREATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [
      { entity: 'bullets', field: 'prompt_log_id' },
      { entity: 'perspectives', field: 'prompt_log_id' },
    ],
  },

  embeddings: {
    fields: {
      id: ID_FIELD,
      entity_type: {
        type: 'text', required: true, enum: EMBEDDING_ENTITY_TYPES,
      },
      entity_id: { type: 'text', required: true },
      content_hash: { type: 'text', required: true },
      vector: { type: 'blob', required: true, lazy: true },
      created_at: CREATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [],
  },

  pending_derivations: {
    fields: {
      id: ID_FIELD,
      entity_type: {
        type: 'text', required: true, enum: PENDING_DERIVATION_TYPES,
      },
      entity_id: { type: 'text', required: true },
      client_id: { type: 'text', required: true },
      prompt: { type: 'text', required: true, lazy: true },
      snapshot: { type: 'text', required: true, lazy: true },
      derivation_params: { type: 'text' },
      locked_at: { type: 'text', required: true, default: () => isoNow() },
      expires_at: { type: 'text', required: true },
      created_at: CREATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [],
  },

  // ══════════════════════════════════════════════════════════════════════
  // JUNCTION TABLES (pure many-to-many links)
  // ══════════════════════════════════════════════════════════════════════

  archetype_domains: {
    fields: {
      archetype_id: {
        type: 'text', required: true,
        fk: { entity: 'archetypes', field: 'id' },
      },
      domain_id: {
        type: 'text', required: true,
        fk: { entity: 'domains', field: 'id' },
      },
      created_at: CREATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['archetype_id', 'domain_id'],
  },

  bullet_skills: {
    fields: {
      bullet_id: {
        type: 'text', required: true,
        fk: { entity: 'bullets', field: 'id' },
      },
      skill_id: {
        type: 'text', required: true,
        fk: { entity: 'skills', field: 'id' },
      },
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['bullet_id', 'skill_id'],
  },

  bullet_sources: {
    fields: {
      bullet_id: {
        type: 'text', required: true,
        fk: { entity: 'bullets', field: 'id' },
      },
      source_id: {
        type: 'text', required: true,
        fk: { entity: 'sources', field: 'id' },
      },
      is_primary: { type: 'integer', required: true, default: 0, boolean: true },
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['bullet_id', 'source_id'],
  },

  perspective_skills: {
    fields: {
      perspective_id: {
        type: 'text', required: true,
        fk: { entity: 'perspectives', field: 'id' },
      },
      skill_id: {
        type: 'text', required: true,
        fk: { entity: 'skills', field: 'id' },
      },
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['perspective_id', 'skill_id'],
  },

  source_skills: {
    fields: {
      source_id: {
        type: 'text', required: true,
        fk: { entity: 'sources', field: 'id' },
      },
      skill_id: {
        type: 'text', required: true,
        fk: { entity: 'skills', field: 'id' },
      },
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['source_id', 'skill_id'],
  },

  skill_domains: {
    fields: {
      skill_id: {
        type: 'text', required: true,
        fk: { entity: 'skills', field: 'id' },
      },
      domain_id: {
        type: 'text', required: true,
        fk: { entity: 'domains', field: 'id' },
      },
      created_at: CREATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['skill_id', 'domain_id'],
  },

  job_description_skills: {
    fields: {
      job_description_id: {
        type: 'text', required: true,
        fk: { entity: 'job_descriptions', field: 'id' },
      },
      skill_id: {
        type: 'text', required: true,
        fk: { entity: 'skills', field: 'id' },
      },
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['job_description_id', 'skill_id'],
  },

  job_description_resumes: {
    fields: {
      job_description_id: {
        type: 'text', required: true,
        fk: { entity: 'job_descriptions', field: 'id' },
      },
      resume_id: {
        type: 'text', required: true,
        fk: { entity: 'resumes', field: 'id' },
      },
      created_at: CREATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['job_description_id', 'resume_id'],
  },

  summary_skills: {
    fields: {
      summary_id: {
        type: 'text', required: true,
        fk: { entity: 'summaries', field: 'id' },
      },
      skill_id: {
        type: 'text', required: true,
        fk: { entity: 'skills', field: 'id' },
      },
      created_at: CREATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['summary_id', 'skill_id'],
  },

  certification_skills: {
    fields: {
      certification_id: {
        type: 'text', required: true,
        fk: { entity: 'certifications', field: 'id' },
      },
      skill_id: {
        type: 'text', required: true,
        fk: { entity: 'skills', field: 'id' },
      },
      created_at: CREATED_AT,
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['certification_id', 'skill_id'],
  },

  contact_organizations: {
    fields: {
      contact_id: {
        type: 'text', required: true,
        fk: { entity: 'contacts', field: 'id' },
      },
      organization_id: {
        type: 'text', required: true,
        fk: { entity: 'organizations', field: 'id' },
      },
      relationship: {
        type: 'text', required: true, enum: CONTACT_ORG_RELATIONSHIPS,
      },
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['contact_id', 'organization_id', 'relationship'],
  },

  contact_job_descriptions: {
    fields: {
      contact_id: {
        type: 'text', required: true,
        fk: { entity: 'contacts', field: 'id' },
      },
      job_description_id: {
        type: 'text', required: true,
        fk: { entity: 'job_descriptions', field: 'id' },
      },
      relationship: {
        type: 'text', required: true, enum: CONTACT_JD_RELATIONSHIPS,
      },
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['contact_id', 'job_description_id', 'relationship'],
  },

  contact_resumes: {
    fields: {
      contact_id: {
        type: 'text', required: true,
        fk: { entity: 'contacts', field: 'id' },
      },
      resume_id: {
        type: 'text', required: true,
        fk: { entity: 'resumes', field: 'id' },
      },
      relationship: {
        type: 'text', required: true, enum: CONTACT_RESUME_RELATIONSHIPS,
      },
    },
    cascade: [],
    restrict: [],
    setNull: [],
    primaryKey: ['contact_id', 'resume_id', 'relationship'],
  },

} as const satisfies Record<string, EntityDefinition>

// ─── Factory: buildEntityMap(deps) ─────────────────────────────────────────
//
// Attaches lifecycle hooks (which close over injected services) to the
// static ENTITY_MAP_SHAPE. Services get wired in at app startup; tests
// can pass mocks or undefined for hook-less behavior.

export function buildEntityMap(deps: EntityMapDeps): EntityMap {
  // Shallow-clone the shape so we can add hooks per entity without
  // mutating the const-asserted source.
  const map: EntityMap = {}

  for (const [name, def] of Object.entries(ENTITY_MAP_SHAPE)) {
    map[name] = {
      fields: def.fields as EntityDefinition['fields'],
      cascade: [...def.cascade],
      restrict: [...def.restrict],
      setNull: [...def.setNull],
      primaryKey: 'primaryKey' in def ? [...(def.primaryKey as string[])] : undefined,
      hooks: {},
    }
  }

  // ─── Attach hooks ───

  // sources: updated_at on update, embedding on create
  map.sources.hooks = {
    beforeUpdate: [setUpdatedAt],
    afterCreate: [createEmbedHook(deps.embeddingService, 'source', 'description')],
  }

  // bullets: embedding on create
  map.bullets.hooks = {
    afterCreate: [createEmbedHook(deps.embeddingService, 'bullet')],
  }

  // perspectives: snapshot bullet content on create, embedding on create
  map.perspectives.hooks = {
    beforeCreate: [captureBulletSnapshotHook],
    afterCreate: [createEmbedHook(deps.embeddingService, 'perspective')],
  }

  // resume_entries: snapshot perspective content, updated_at
  map.resume_entries.hooks = {
    beforeCreate: [captureSnapshotHook],
    beforeUpdate: [setUpdatedAt, captureSnapshotHook],
  }

  // Entities with updated_at only
  for (const name of [
    'organizations', 'contacts', 'resumes', 'resume_sections',
    'summaries', 'job_descriptions', 'credentials', 'certifications',
    'user_profile', 'user_notes', 'resume_templates', 'answer_bank',
  ]) {
    const existing = map[name].hooks ?? {}
    map[name].hooks = {
      ...existing,
      beforeUpdate: [...(existing.beforeUpdate ?? []), setUpdatedAt],
    }
  }

  // job_descriptions: NO generic embedding hook. JD embedding is
  // "parse raw_text → requirements → embed each as '{jd_id}:{i}'",
  // which the generic createEmbedHook cannot express (single row +
  // single content field). The service owns this via queueMicrotask
  // → EmbeddingService.onJDCreated / onJDUpdated. See Phase 1.3.1
  // notes in HOWTO-migrate-service.md.

  return map
}
