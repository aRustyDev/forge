# Skill Intelligence Architecture

> Status: Design (2026-04-27)
> Epics: forge-ucc2, forge-czgq, forge-etam, forge-0e9z, forge-6r2y
> Initiative: Skills (forge-hl0d) under Core Implementations (forge-nmzv)

## Overview

Skills are the JOIN TABLE of the entire Forge system. They connect JDs to bullets, bullets to certifications, JDs to resumes. Every major relationship passes through skills.

This directory documents the information architecture for skill intelligence: the graphs, extraction pipelines, retrieval/alignment systems, interface seams, and runtime model.

## Directory Structure

```
architecture/
├── README.md                          ← you are here
├── graphs/
│   ├── skills.md                      — Skill Graph (taxonomy, similarity, co-occurrence)
│   ├── provenance.md                  — Provenance Graph (content lineage)
│   ├── organizations.md               — Organization Graph (entities, industries, campuses)
│   ├── domains-archetypes.md          — Domain/Archetype Graph (career navigation, skill clusters)
│   ├── career-target.md               — Career Target Graph (gap analysis, interest weighting)
│   ├── certifications.md              — Certification Graph (pathways, skill validation)
│   └── computed.md                    — Computed/Ephemeral graphs (alignment, job market epistemology)
├── pipelines/
│   └── extraction.md                  — RRF extraction pipeline (4-extractor architecture)
├── retrieval/
│   ├── alignment-scoring.md           — Graph-aware alignment scoring algorithm
│   └── search-modalities.md           — Search type matrix per entity
├── seams.md                           — Interface boundaries between subsystems
├── models/
│   └── runtime.md                     — Server vs browser runtime model, performance targets
└── legacy/
    ├── skills-gap-tracker-design.md   — Predecessor spec (2026-03-24, migrated from job-hunting)
    └── skills-gap-tracker-plan.md     — Predecessor plan (migrated)
```

## Graph Landscape

Forge's information architecture consists of 7 graphs, some persistent and some computed:

| Graph | Type | Purpose | Doc |
|-------|------|---------|-----|
| Skill Graph | Persistent, curated | Taxonomy, similarity, co-occurrence, normalization | [graphs/skills.md](graphs/skills.md) |
| Provenance Graph | Persistent, implicit | Content lineage (Source → Bullet → Perspective → Resume) | [graphs/provenance.md](graphs/provenance.md) |
| Organization Graph | Persistent, to extend | Entity relationships, industry context, locations | [graphs/organizations.md](graphs/organizations.md) |
| Domain/Archetype Graph | Future, persistent | Career navigation, skill clustering, archetype definitions | [graphs/domains-archetypes.md](graphs/domains-archetypes.md) |
| Career Target Graph | Future, computed + snapshots | Strategic gap analysis with interest weighting | [graphs/career-target.md](graphs/career-target.md) |
| Certification Graph | Future, persistent | Credential pathways, skill validation levels | [graphs/certifications.md](graphs/certifications.md) |
| Alignment Graph + Market Stats | Computed, ephemeral | Resume↔JD matching, temporal skill demand | [graphs/computed.md](graphs/computed.md) |

```
                    ┌──────────────────────┐
                    │  DOMAIN / ARCHETYPE  │
                    │  (career navigation) │
                    └──────────┬───────────┘
                               │ expects / typical_skills
                               ▼
┌──────────────┐    ┌──────────────────────┐    ┌──────────────┐
│ CAREER TARGET│◄───│     SKILL GRAPH      │───►│    CERT       │
│ (my gap)     │    │  (backbone)          │    │    GRAPH      │
│              │    │  + temporal weights  │    │ (validation)  │
└──────────────┘    └──────────┬───────────┘    └──────────────┘
                               │
        ┌──────────┬───────────┼───────────┐
        ▼          ▼           ▼           ▼
    Bullets      JDs     Alignment    ORG GRAPH
                         (computed)   + Industry
```

## Deployment Model

**Browser-first, server-optional.** The browser is the primary runtime. The server is an optional enhancement for SaaS users. OSS and SaaS share the same WASM application — SaaS is a superset.

See [models/deployment.md](models/deployment.md) for the full topology, [models/sync.md](models/sync.md) for the CRDT sync protocol, and [migrations/mvp-2.0-browser-first.md](../migrations/mvp-2.0-browser-first.md) for the migration plan.

## Predecessor

This architecture evolves from a Skills Gap Tracker design (2026-03-24) originally in the job-hunting project. That spec defined a two-layer system (skills inventory + per-job gap analysis) that this architecture generalizes into the graph-based approach.

See: [legacy/skills-gap-tracker-design.md](legacy/skills-gap-tracker-design.md)
