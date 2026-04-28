# Search Modalities

> Status: Design

## Overview

Each entity type has different search needs. No single approach works for everything. This matrix defines which search modality applies to which entity.

## Matrix

| Entity | Semantic (embedding) | Fuzzy (string) | Pattern (regex) | Indexed (exact) | Graph traversal |
|--------|---------------------|----------------|-----------------|-----------------|-----------------|
| **Skills** | Similar skills, HNSW lookup | Alias matching (K8s→Kubernetes) | Level extraction ("5yr of X") | By ID, category, name | Taxonomy, co-occurrence |
| **Bullets** | Find bullets demonstrating a skill without explicit tag | — | Extract metrics/skills from text | By source, by skill tag | Provenance chain |
| **JDs** | Find similar JDs, match against resume | Org name matching | Section extraction (reqs, benefits, salary) | By org, status, location | Alignment (via skills) |
| **Organizations** | — | Name disambiguation ("Amazon" vs "AWS") | — | By industry, type | Subsidiaries, campuses |
| **Summaries** | Best summary for JD/archetype | — | — | By archetype, domain | — |
| **Certifications** | Relevant certs for a skill cluster | Cert name variants | — | By vendor, by skill | Validated skills, progression |
| **Perspectives** | Closest perspective to JD framing | — | — | By bullet, by resume | Provenance chain |
| **Notes** | Search by topic/content | — | — | By entity link | Linked entities |

## Modality Descriptions

### Semantic Search (embedding-based)
- **How:** Embed query text → nearest-neighbor lookup in vector space (HNSW)
- **When:** Finding conceptually similar entities, fuzzy matching beyond string similarity
- **Model:** all-MiniLM-L6-v2 (384-dim), runs in browser via transformers.js
- **Index:** HNSW (usearch or hnswlib), pre-built and distributed via snapshot

### Fuzzy Search (string-based)
- **How:** Trigram similarity, Levenshtein distance, phonetic matching
- **When:** Name disambiguation, alias matching, typo tolerance
- **Libraries:** fuse.js (browser), pg_trgm (server)

### Pattern Search (regex/grammar)
- **How:** Compiled regex patterns, grammar-based extractors
- **When:** Structured data extraction from unstructured text (level signals, section headers, salary ranges)
- **Performance:** Sub-millisecond per pattern

### Indexed Search (exact lookup)
- **How:** B-tree or hash index on specific columns
- **When:** Known-key lookups, filtered queries, pagination
- **Storage:** SQLite indexes, HelixDB native indexes

### Graph Traversal
- **How:** BFS/DFS from a starting node along typed edges
- **When:** Finding related entities, computing alignment, tracing provenance
- **Implementation:** In-memory adjacency list (browser) or SQL recursive CTEs (server)
