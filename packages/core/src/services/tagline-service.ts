/**
 * TaglineService — programmatic tagline generation via TF-IDF keyword
 * extraction from job description text.
 *
 * Phase 92 introduces this service to replace the static tagline field on
 * summaries with an auto-generated tagline per resume. The tagline is
 * computed from all JDs linked to the resume and is regenerated whenever
 * JD links change.
 *
 * ## Algorithm
 *
 * 1. Tokenize each JD's raw_text into lowercased alphanumeric terms.
 * 2. Strip stop words (common English + job-description noise).
 * 3. For each term, compute TF-IDF across the JD corpus:
 *      tf     = term frequency in a single JD (0-1 normalized)
 *      idf    = log(N / df + 1), where N is # JDs and df is # JDs containing the term
 *      tfidf  = tf * idf
 * 4. Aggregate scores across all JDs (sum).
 * 5. Boost terms that match user skills by `SKILL_MATCH_BOOST` (case-insensitive).
 * 6. Return the top-K terms by score.
 *
 * The output is deterministic: ties are broken by alphabetical order so tests
 * can assert exact output.
 *
 * ## Non-goals
 *
 * - LLM-based generation (this is pure statistical extraction)
 * - Stemming / lemmatization (naive lowercase match only — "engineers" and
 *   "engineer" are distinct terms)
 * - Multi-word phrases (unigrams only)
 *
 * The service is stateless: all state lives in the inputs. Callers pass the
 * JD texts, user skills, and options. This makes it trivial to unit test and
 * call from both the API layer and ad-hoc scripts.
 */

import type { Skill } from '../types'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default number of keywords returned. */
export const DEFAULT_TOP_K = 3

/** Boost multiplier applied when an extracted term matches a user skill. */
export const SKILL_MATCH_BOOST = 2.0

/**
 * Stop words — common English function words plus job-description filler.
 * Kept conservative; favor recall over precision so that TF-IDF has room to
 * down-weight genuinely noisy terms.
 */
const STOP_WORDS = new Set([
  // Common English
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'have', 'had', 'he', 'her', 'his', 'i', 'if', 'in', 'into',
  'is', 'it', 'its', 'of', 'on', 'or', 'our', 'out', 'over', 'so',
  'such', 'that', 'the', 'their', 'then', 'there', 'these', 'they',
  'this', 'those', 'to', 'was', 'we', 'were', 'what', 'when', 'where',
  'which', 'while', 'who', 'will', 'with', 'would', 'you', 'your',
  'but', 'not', 'no', 'any', 'all', 'can', 'should', 'may', 'must',
  'do', 'does', 'done', 'been', 'am', 'us', 'me', 'my', 'him', 'she',
  // Job-description filler
  'job', 'role', 'work', 'working', 'company', 'team', 'teams',
  'experience', 'years', 'year', 'skills', 'skill', 'ability', 'abilities',
  'opportunity', 'opportunities', 'position', 'positions', 'candidate',
  'candidates', 'responsibilities', 'requirements', 'required', 'preferred',
  'strong', 'excellent', 'ideal', 'ideal', 'looking', 'seeking', 'join',
  'about', 'us', 'you', 'we', 'our', 'help', 'helping', 'make', 'making',
  'using', 'use', 'used', 'include', 'includes', 'including', 'across',
  'within', 'through', 'throughout', 'more', 'than', 'other', 'others',
  'also', 'both', 'well', 'very', 'most', 'some', 'each', 'every',
  'new', 'great', 'good', 'better', 'best', 'high', 'highly', 'one',
  'two', 'three', 'plus', 'etc', 'eg', 'ie',
])

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A ranked keyword with its aggregated TF-IDF score. */
export interface RankedKeyword {
  term: string
  score: number
  /** True if the term matched a user skill and received the boost. */
  matchedSkill: boolean
}

export interface GenerateTaglineOptions {
  /** Number of keywords to include in the tagline (default: 3). */
  topK?: number
  /**
   * Optional prefix for the tagline (usually the target role or a JD title).
   * Rendered as `<prefix> -- keyword1 + keyword2 + keyword3`.
   * If omitted, the tagline is just `keyword1 + keyword2 + keyword3`.
   */
  prefix?: string
}

export interface GenerateTaglineResult {
  /** The formatted tagline string. Empty if no keywords could be extracted. */
  tagline: string
  /** Ranked keywords used to build the tagline, top-K only. */
  keywords: RankedKeyword[]
}

// ---------------------------------------------------------------------------
// Tokenization
// ---------------------------------------------------------------------------

/**
 * Tokenize a string into lowercased alphanumeric-plus-hyphen terms.
 * Terms under 2 characters or in the stop list are dropped.
 *
 * Hyphens and `+` are preserved within terms so labels like "c++",
 * "front-end", "ci-cd" survive. Leading/trailing punctuation is stripped.
 */
export function tokenize(text: string): string[] {
  if (!text) return []

  // Split on whitespace + common separators, but keep `+` and `-` inside words
  const raw = text
    .toLowerCase()
    .split(/[\s,;.!?()[\]{}"'/\\|<>]+/u)
    .map((t) => t.replace(/^[^a-z0-9]+|[^a-z0-9+\-#]+$/g, ''))
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t) && /[a-z]/.test(t))

  return raw
}

// ---------------------------------------------------------------------------
// TF-IDF
// ---------------------------------------------------------------------------

/**
 * Compute TF-IDF scores for all terms across a corpus of JD texts.
 *
 * Returns a Map keyed by term with aggregated (summed) TF-IDF scores across
 * the corpus. If a term appears in multiple JDs, its scores add up so
 * multi-JD repetition is rewarded.
 *
 * `tf` is 0-1 normalized against the longest JD in the corpus.
 * `idf = log((N + 1) / (df + 1)) + 1` (smoothed, always > 0).
 */
export function computeTfIdf(jdTexts: string[]): Map<string, number> {
  const aggregate = new Map<string, number>()
  if (jdTexts.length === 0) return aggregate

  // Tokenize each JD once; keep raw term arrays.
  const tokenized = jdTexts.map((t) => tokenize(t))

  // Document frequency: how many JDs contain each term
  const docFreq = new Map<string, number>()
  for (const tokens of tokenized) {
    const unique = new Set(tokens)
    for (const term of unique) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1)
    }
  }

  const N = tokenized.length

  for (const tokens of tokenized) {
    if (tokens.length === 0) continue

    // Term frequency within this JD
    const tf = new Map<string, number>()
    for (const term of tokens) {
      tf.set(term, (tf.get(term) ?? 0) + 1)
    }

    // Normalize TF by the max term frequency in this JD (range-safe, favors
    // the dominant term without penalizing longer documents).
    let maxCount = 0
    for (const count of tf.values()) {
      if (count > maxCount) maxCount = count
    }

    for (const [term, count] of tf.entries()) {
      const normalizedTf = count / maxCount
      const df = docFreq.get(term) ?? 1
      // Smoothed IDF: always positive, never -Infinity.
      const idf = Math.log((N + 1) / (df + 1)) + 1
      const score = normalizedTf * idf
      aggregate.set(term, (aggregate.get(term) ?? 0) + score)
    }
  }

  return aggregate
}

// ---------------------------------------------------------------------------
// Skill-match boost + ranking
// ---------------------------------------------------------------------------

/**
 * Rank keywords from a TF-IDF score map, applying the skill-match boost for
 * terms that case-insensitively match any user skill name.
 *
 * Ties are broken alphabetically (ascending) so output is deterministic.
 */
export function rankKeywords(
  scores: Map<string, number>,
  userSkills: Skill[],
): RankedKeyword[] {
  const skillSet = new Set(userSkills.map((s) => s.name.toLowerCase()))

  const ranked: RankedKeyword[] = []
  for (const [term, baseScore] of scores.entries()) {
    const matched = skillSet.has(term)
    const score = matched ? baseScore * SKILL_MATCH_BOOST : baseScore
    ranked.push({ term, score, matchedSkill: matched })
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.term.localeCompare(b.term)
  })

  return ranked
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a tagline from one or more JD texts and the user's skill library.
 *
 * Returns the formatted tagline plus the top-K ranked keywords. An empty
 * corpus or a corpus with no extractable terms yields an empty tagline.
 *
 * Example (with prefix):
 *   generateTagline(['JD text about python and terraform...'], skills, {
 *     topK: 3,
 *     prefix: 'Senior DevOps',
 *   })
 *   => { tagline: 'Senior DevOps -- python + terraform + ansible', ... }
 */
export function generateTagline(
  jdTexts: string[],
  userSkills: Skill[],
  options: GenerateTaglineOptions = {},
): GenerateTaglineResult {
  const topK = options.topK ?? DEFAULT_TOP_K
  const nonEmptyTexts = jdTexts.filter((t) => t && t.trim().length > 0)

  if (nonEmptyTexts.length === 0) {
    return { tagline: '', keywords: [] }
  }

  const scores = computeTfIdf(nonEmptyTexts)
  const ranked = rankKeywords(scores, userSkills).slice(0, topK)

  if (ranked.length === 0) {
    return { tagline: '', keywords: [] }
  }

  const joined = ranked.map((k) => k.term).join(' + ')
  const tagline = options.prefix ? `${options.prefix} -- ${joined}` : joined

  return { tagline, keywords: ranked }
}
