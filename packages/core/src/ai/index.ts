/**
 * @forge/core AI module — public interface.
 *
 * Re-exports the Claude CLI wrapper, prompt templates, and output validators.
 */

// Claude CLI wrapper
export { invokeClaude, parseClaudeEnvelope, stripCodeFences } from './claude-cli'
export type { ClaudeOptions, ClaudeResult } from './claude-cli'

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
