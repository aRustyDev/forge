import type { ForgeClient } from '@forge/sdk'

export interface FeatureFlags {
  /** Phase 60: JD-resume linkage SDK methods */
  jdResumeLinkage: boolean
  /** Phase 62: JD skill extraction SDK methods */
  jdSkillExtraction: boolean
  /** SDK has reorderEntries method */
  reorderEntries: boolean
  /** sdk.review resource is available */
  reviewAvailable: boolean
  /** sdk.integrity resource is available */
  integrityAvailable: boolean
  /** sdk.notes resource is available */
  notesAvailable: boolean
}

/**
 * Detect which optional SDK methods are available.
 *
 * Checks for method existence on the SDK resource instances.
 * Methods added by Phase 60 and Phase 62 may not be present
 * if those phases have not been implemented yet.
 */
export function detectFeatures(sdk: ForgeClient): FeatureFlags {
  const flags: FeatureFlags = {
    jdResumeLinkage:
      typeof (sdk.jobDescriptions as any).linkResume === 'function' &&
      typeof (sdk.jobDescriptions as any).unlinkResume === 'function',

    jdSkillExtraction:
      typeof (sdk.jobDescriptions as any).extractSkills === 'function' &&
      typeof (sdk.jobDescriptions as any).addSkill === 'function' &&
      typeof (sdk.jobDescriptions as any).removeSkill === 'function',

    reorderEntries:
      typeof (sdk.resumes as any).reorderEntries === 'function',

    reviewAvailable:
      typeof (sdk as any).review !== 'undefined' &&
      typeof (sdk as any).review?.pending === 'function',

    integrityAvailable:
      typeof (sdk as any).integrity !== 'undefined' &&
      typeof (sdk as any).integrity?.drift === 'function',

    notesAvailable:
      typeof (sdk as any).notes !== 'undefined' &&
      typeof (sdk as any).notes?.create === 'function',
  }

  // Log feature flag state at startup
  const flagged: string[] = []
  if (!flags.jdResumeLinkage) {
    flagged.push('forge_link_resume_to_jd, forge_unlink_resume_from_jd (Phase 60)')
  }
  if (!flags.jdSkillExtraction) {
    flagged.push(
      'forge_extract_jd_skills, forge_tag_jd_skill, forge_untag_jd_skill (Phase 62)',
    )
  }
  if (!flags.reorderEntries) {
    flagged.push('forge_reorder_resume_entries (SDK missing reorderEntries — feature-flagged off)')
  }
  if (!flags.reviewAvailable) {
    flagged.push('forge_review_pending (sdk.review not available)')
  }
  if (!flags.integrityAvailable) {
    flagged.push('forge_check_drift (sdk.integrity not available)')
  }
  if (!flags.notesAvailable) {
    flagged.push('forge_create_note, forge_search_notes (sdk.notes not available)')
  }

  if (flagged.length > 0) {
    console.error(
      `[forge:mcp] Feature-flagged tools (not registered):\n` +
      flagged.map((t) => `  - ${t}`).join('\n'),
    )
  } else {
    console.error('[forge:mcp] All 57 tools registered (no feature flags active)')
  }

  return flags
}
