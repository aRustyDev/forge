# Alignment Scoring

> Epic: forge-etam (Skill Alignment & Matching)
> Status: Design

## Overview

Graph-aware alignment scoring transforms binary "have it / don't have it" into continuous scores accounting for transferable skills, hierarchy, and level gaps. Traverses the Skill Graph to find matches at different relationship depths.

## Match Types

Ordered by strength:

| Type | Score | Mechanism | Example |
|------|-------|-----------|---------|
| Direct match | 1.0 | Resume has exact skill | JD: Kubernetes → Resume: Kubernetes |
| Alias match | 1.0 | Resume has alias | JD: K8s → Resume: Kubernetes |
| Cert validation | 0.95 | Cert validates skill | JD: Kubernetes → Resume: CKAD cert |
| Child match | 0.9 | Resume has more specific | JD: Container Orchestration → Resume: Kubernetes |
| Parent match | 0.5 | Resume has broader | JD: Kubernetes → Resume: Container Orchestration |
| Sibling match | 0.4 | Resume has related alternative | JD: Terraform → Resume: Pulumi |
| Embedding proximity | 1 - dist | Nearest within threshold | JD: Kubernetes → Resume: Docker (close in embedding space) |
| Co-occurrence | 0.3 | Skills that co-occur | JD: Helm → Resume: Kubernetes (co-occurs) |

## Level Adjustment

Level matching multiplies the match score:

| Condition | Multiplier |
|-----------|------------|
| Exceeds requirement (7yr when 5yr needed) | 1.0 |
| Meets requirement | 1.0 |
| Partial (3yr when 5yr needed) | proportional (0.6) |
| No level info available | 0.8 (assume moderate) |

Level sources (in confidence order):
1. Cert validation level (authoritative)
2. Explicit annotation on resume skill
3. Pattern-extracted from bullet text ("5 years of X")
4. Inferred from role duration at relevant org

## Aggregate Scores

```
per_skill_alignment = max(all match scores) × level_adjustment
overall_alignment = weighted_mean(all per_skill_alignments)
```

## Output Reports

### Gap Report
JD skills with per-skill alignment below threshold:
- Skill name, required level, best match found, match type, score
- Actionable: "You're missing Python (3yr required). Closest: JavaScript (sibling, 0.4)"

### Strength Report
Resume skills with no JD match:
- Shows transferable skills the JD didn't explicitly request but the candidate has
- "You have Threat Hunting (10yr) — not in the JD but relevant to the Security domain"

### Coverage Report
Percentage of JD requirements covered at each confidence tier:
- Strong (>0.8): 60% of requirements
- Moderate (0.4-0.8): 25% of requirements
- Weak (<0.4): 10% of requirements
- Gap: 5% of requirements

### Provenance Trace
For each matched skill, trace back to evidence:
- Skill → Bullet → Source/Role → Organization
- "Kubernetes (5yr, 0.95): evidenced by 'Managed production K8s clusters' at Cisco (2025-2026)"

## Performance Target

< 100ms for typical resume vs JD comparison.
