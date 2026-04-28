# Certification Graph

> Type: Future, persistent
> Status: Design

## Purpose

Credential pathways, skill validation levels, certification recommendations. Certs are HIGH-CONFIDENCE skill signals — a cert authoritatively validates skills at specific levels.

## Structure

```
GIAC (vendor)
  ├── GMLE (ML Engineer)
  │   └── validates → [ML Engineering (expert), Python (advanced)]
  ├── GCFA (Certified Forensic Analyst)
  │   └── validates → [Digital Forensics (expert), Incident Response (advanced)]
  ├── GCIH (Certified Incident Handler)
  │   └── validates → [Incident Response (intermediate)]
  └── GCIH → GCFA (prerequisite path / progression)

AWS (vendor)
  ├── SA Associate → SA Professional → DevOps Professional (progression)
  ├── ML Engineer
  │   └── validates → [AWS ML (advanced), SageMaker (intermediate), Python (intermediate)]
  └── AI Practitioner → ML Engineer (progression)
```

## Edge Types

| Type | Semantics | Example |
|------|-----------|---------|
| `validates` | Cert → Skill at level | CKAD validates Kubernetes (practitioner) |
| `prerequisite` | Cert → Cert (ordering) | CKA → CKAD |
| `progression` | Cert → Cert (career path) | AWS SA Associate → SA Professional |
| `vendor` | Cert → Vendor | GMLE → GIAC |

## Alignment Integration

Cert matches bypass normal alignment scoring:
- Cert validates Skill X at level Y → alignment score 0.95 (near-direct match)
- This is stronger than bullet-inferred skill evidence
- Cert alignment doesn't require level adjustment (the cert IS the level evidence)

## What This Powers

- "What cert should I get next?" — traverse progression paths from current certs
- "Does this cert cover this JD requirement?" — cert → validated skills → JD required skills
- "What's the most efficient cert for closing my gaps?" — Career Target gaps × cert validation coverage
- Cert-based alignment scoring in Epic 3

## Current State

Partially exists: `certification_skills` junction table links certs to skills. Missing: progression paths, prerequisite relationships, vendor hierarchy, validation levels.
