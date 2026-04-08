/**
 * @forge/core AI module — public interface.
 *
 * Re-exports prompt templates and output validators.
 */

// Prompt templates
export {
  renderSourceToBulletPrompt,
  renderBulletToPerspectivePrompt,
  renderJDSkillExtractionPrompt,
  SOURCE_TO_BULLET_TEMPLATE_VERSION,
  BULLET_TO_PERSPECTIVE_TEMPLATE_VERSION,
  JD_SKILL_EXTRACTION_TEMPLATE_VERSION,
} from './prompts'

// Output validators
export {
  validateBulletDerivation,
  validatePerspectiveDerivation,
  validateSkillExtraction,
} from './validator'
export type {
  BulletDerivationResponse,
  PerspectiveDerivationResponse,
  SkillExtractionResponse,
  ValidationResult,
} from './validator'
