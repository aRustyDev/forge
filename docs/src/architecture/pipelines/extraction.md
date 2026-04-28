# Extraction Pipeline

> Epic: forge-czgq (Skill Extraction Pipeline)
> Status: Design

## Overview

Four extractors run in parallel on input text, results fused via Reciprocal Rank Fusion (RRF). Must work without LLM at inference time — targeting in-browser/CPU-only execution.

## Architecture

```
Input text
  ├──→ [1] Embedding Similarity (HNSW lookup)
  ├──→ [2] Dictionary/Alias Matcher (exact + fuzzy string)
  ├──→ [3] Pattern Extractor (regex for level/skill mentions)
  └──→ [4] Graph Contextual (traverse graph from found skills)
         │
         ▼
    RRF Fusion: score(skill) = Σ 1/(k + rank_i)
         │
         ▼
    Ranked skill candidates with confidence + level signals
```

## Extractors

### 1. Embedding Similarity
- Embed input text chunks using small model (all-MiniLM-L6-v2, 384-dim)
- HNSW lookup against skill graph embeddings → top-k per chunk
- **Catches:** semantic matches, paraphrasing, related concepts
- **Misses:** exact acronyms, hierarchy confusion

### 2. Dictionary/Alias Matcher
- Exact + fuzzy string match against all skill canonical names + aliases
- Trigram similarity or Levenshtein for fuzzy matching
- **Catches:** abbreviations (K8s), exact mentions, misspellings
- **Misses:** paraphrasing, implied skills

### 3. Pattern Extractor
- Regex/grammar for skill-level mentions in natural text
- Patterns: `N years (of|with|in) X`, `experience (with|in) X`, `proficient in X`, `expert-level X`, `familiar with X`
- **Catches:** level/experience info, explicit mentions with context
- **Misses:** implied skills, mentions without level context

### 4. Graph Contextual
- Given skills found by extractors 1-3, traverse the Skill Graph
- Example: {Kubernetes, AWS} found → graph edge platform-for → propose EKS
- Example: {Python, pandas} found → co-occurrence edge → propose data-science context
- **Catches:** implied skills, disambiguation, hierarchy completion
- **Misses:** cold start (needs other extractors to seed)

## RRF Fusion

```
score(skill) = Σ 1/(k + rank_i) for each extractor where skill appears
k = 60 (standard constant, configurable)
```

Each extractor has different failure modes. RRF is robust to any single extractor failing because it requires multiple independent signals to rank a skill highly.

| Signal | What it catches | Where it fails |
|--------|-----------------|----------------|
| Semantic (embedding) | Fuzzy matches, related concepts | Synonyms not equivalent, hierarchy confusion |
| Lexical (dictionary) | Abbreviations, exact mentions | Misses paraphrasing, implied skills |
| Pattern (regex) | Level info, explicit mentions | Misses implied skills |
| Graph (traversal) | Implied skills, disambiguation | Cold start |

## Entity-Specific Strategies

The RRF framework is shared, but text chunking and pattern strategies differ by entity type:

### JD Extraction
- Pre-processing: section identification (Requirements, Preferences, Description, Benefits)
- Requirements sections get higher extraction weight
- Industry context from Org Graph disambiguates skills
- Level signals: "required" vs "preferred" vs "nice to have"

### Bullet Extraction
- Single sentence, dense with implicit skills
- "Managed production K8s clusters serving 10M req/day" implies: Kubernetes, production ops, high-scale, SRE
- Heavy reliance on semantic search (embedding extractor) for latent skills
- Only explicitly tagged skills are certain; others are candidates

### Certification Extraction
- High-confidence skill signals — a cert authoritatively validates skills
- Pattern: cert name → vendor lookup → validated skill list from Cert Graph
- Bypasses normal confidence thresholds (cert = authoritative)

### Raw Experience / Free Text
- Least structured, most ambiguous
- Heavier reliance on embedding similarity and co-occurrence context
- Produces more candidates for human review (lower auto-accept threshold)

## Output

For each extracted skill:
- `skill_id` (or `candidate_string` if new)
- `confidence` (RRF fused score)
- `level_signal` (if detected: years, expertise descriptor)
- `match_type` (which extractors contributed)
- `is_new_candidate` (HNSW miss — needs curation review)

## Performance Target

< 500ms for a typical JD on CPU (browser or server).
