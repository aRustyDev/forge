# Organization Graph

> Type: Persistent, to extend
> Status: Partially exists (orgs, campuses, industries as flat entities)

## Purpose

Entity relationships, industry context, location intelligence. Industry context disambiguates skills during extraction.

## Structure

```
Org → Industry → Domain
Org → Campus → Address
Org → Division (subsidiary)
Role → Org (employment relationship)
```

## Disambiguation Role

Industry context changes extraction semantics:
- "Python" at Goldman Sachs (finance) → quant/data science
- "Python" at CrowdStrike (security) → automation/tooling
- "Python" at Netflix (streaming) → backend services

This context feeds into Extractor 4 (graph contextual) in the extraction pipeline.

## Extension: Industry → Domain → Archetype

Currently industries are flat lookups. To extend:
- Industry → Domain edges (e.g., "Cybersecurity Vendors" → "Cybersecurity" domain)
- Domain → Archetype edges (via Domain/Archetype Graph)
- This connects org context all the way to skill prioritization

## Entities

- Organizations (companies, schools, government agencies)
- Industries (cybersecurity, fintech, healthcare, defense/IC)
- Campuses / Locations (with addresses, work mode: remote/hybrid/on-site)
- Divisions / Subsidiaries (Cisco TALOS → Cisco)
