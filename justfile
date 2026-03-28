# Resume Database Management
# Location: /Users/adam/notes/job-hunting/

set dotenv-load := false

# Default recipe - show available commands
default:
    @just --list

# Job tracking paths
jobs_dir := "/Users/adam/notes/zettelkasten/proj/job-hunting/jobs"
list_script := "/Users/adam/notes/zettelkasten/proj/job-hunting/scripts/list_jobs.py"
scripts_dir := "/Users/adam/notes/zettelkasten/proj/job-hunting/scripts"
apps_dir := "/Users/adam/notes/zettelkasten/proj/job-hunting/applications"

# =====================
# JOB TRACKING
# =====================

# List all tracked jobs (filter: all, new, applied, closed, or org name)
list-jobs filter="all":
    @python3 {{list_script}} {{filter}}

# Short hash of org/role path for unique filenames (8 chars)
_hash dir:
    @echo -n "{{dir}}" | shasum -a 256 | cut -c1-8

# Export resume from MD to PDF via mdq + mustache + pdflatex
# Output: adam-smith-resume-<hash>.pdf
# Usage: just export-resume anthropic/forward-deployed-engineer-federal
export-resume dir:
    #!/usr/bin/env bash
    set -euo pipefail
    hash=$(echo -n "{{dir}}" | shasum -a 256 | cut -c1-8)
    outname="adam-smith-resume-${hash}"
    echo "Exporting {{dir}}/resume.md → ${outname}.pdf..."
    cat {{apps_dir}}/{{dir}}/resume.md | mdq --output json '#' | python3 {{scripts_dir}}/md2json.py > /tmp/_resume_export.json
    mustache /tmp/_resume_export.json {{scripts_dir}}/resume.tex.mustache > {{apps_dir}}/{{dir}}/resume.tex
    docker run --rm -v "{{apps_dir}}/{{dir}}:/workspace" -w /workspace texlive/texlive:latest pdflatex -interaction=nonstopmode resume.tex > /dev/null 2>&1
    mv {{apps_dir}}/{{dir}}/resume.pdf {{apps_dir}}/{{dir}}/${outname}.pdf
    rm -f {{apps_dir}}/{{dir}}/resume.aux {{apps_dir}}/{{dir}}/resume.log {{apps_dir}}/{{dir}}/resume.out /tmp/_resume_export.json
    echo "Done: {{apps_dir}}/{{dir}}/${outname}.pdf"

# Export cover letter from MD to LaTeX to PDF
# Output: adam-smith-coverletter-<hash>.pdf
# Usage: just export-coverletter trm-labs/applied-ai-eng
export-coverletter dir:
    #!/usr/bin/env bash
    set -euo pipefail
    hash=$(echo -n "{{dir}}" | shasum -a 256 | cut -c1-8)
    outname="adam-smith-coverletter-${hash}"
    echo "Exporting {{dir}}/cover-letter.md → ${outname}.pdf..."
    # Cover letter uses hand-crafted .tex (not mustache pipeline)
    # Ensure .tex exists before compiling
    if [[ ! -f {{apps_dir}}/{{dir}}/cover-letter.tex ]]; then
        echo "ERROR: {{apps_dir}}/{{dir}}/cover-letter.tex not found. Create it first."
        exit 1
    fi
    docker run --rm -v "{{apps_dir}}/{{dir}}:/workspace" -w /workspace texlive/texlive:latest pdflatex -interaction=nonstopmode cover-letter.tex > /dev/null 2>&1
    mv {{apps_dir}}/{{dir}}/cover-letter.pdf {{apps_dir}}/{{dir}}/${outname}.pdf
    rm -f {{apps_dir}}/{{dir}}/cover-letter.aux {{apps_dir}}/{{dir}}/cover-letter.log {{apps_dir}}/{{dir}}/cover-letter.out
    echo "Done: {{apps_dir}}/{{dir}}/${outname}.pdf"

# Export both resume and cover letter for a job
# Usage: just export-all trm-labs/applied-ai-eng
export-all dir:
    just export-resume {{dir}}
    just export-coverletter {{dir}}

# =====================
# PROSE RHYTHM ANALYSIS
# =====================

# Analyze prose rhythm for AI signal detection
# Usage: just prose-rhythm trm-labs/applied-ai-eng/cover-letter.md
prose-rhythm file:
    @cat {{apps_dir}}/{{file}} | python3 {{scripts_dir}}/prose_rhythm.py

# Analyze prose rhythm with JSON output
prose-rhythm-json file:
    @cat {{apps_dir}}/{{file}} | python3 {{scripts_dir}}/prose_rhythm.py --json

# Compare prose rhythm against the accepted cybersec-rl baseline
prose-rhythm-baseline file:
    @cat {{apps_dir}}/{{file}} | python3 {{scripts_dir}}/prose_rhythm.py --baseline {{apps_dir}}/anthropic/cybersec-rl/cover-letter.md

# Database paths
db := "data/resume.sqlite.db"
schema := "data/schema.sql"
seed := "data/seed.sql"
dump_dir := "data/dumps"
bullets_dump := dump_dir / "bullets.sql"
full_dump := dump_dir / "full_dump.sql"

# =====================
# DATABASE DUMPS (for git version control)
# =====================

# Dump bullets table to SQL (INSERT statements)
dump-bullets:
    @mkdir -p {{dump_dir}}
    @echo "-- Bullets dump generated: $(date -Iseconds)" > {{bullets_dump}}
    @echo "-- Run after schema.sql and seed.sql to restore bullets" >> {{bullets_dump}}
    @echo "" >> {{bullets_dump}}
    @sqlite3 {{db}} ".mode insert bullets" ".output /dev/stdout" "SELECT * FROM bullets;" >> {{bullets_dump}}
    @echo "" >> {{bullets_dump}}
    @echo "-- Bullet-skill associations" >> {{bullets_dump}}
    @sqlite3 {{db}} ".mode insert bullet_skills" ".output /dev/stdout" "SELECT * FROM bullet_skills;" >> {{bullets_dump}}
    @echo "" >> {{bullets_dump}}
    @echo "-- Bullet-role associations" >> {{bullets_dump}}
    @sqlite3 {{db}} ".mode insert bullet_roles" ".output /dev/stdout" "SELECT * FROM bullet_roles;" >> {{bullets_dump}}
    @echo "Bullets dumped to {{bullets_dump}}"

# Dump entire database to SQL
dump-full:
    @mkdir -p {{dump_dir}}
    @sqlite3 {{db}} .dump > {{full_dump}}
    @echo "Full database dumped to {{full_dump}}"

# Dump all tables as separate SQL files
dump-all:
    @mkdir -p {{dump_dir}}
    @echo "Dumping all tables..."
    @sqlite3 {{db}} ".mode insert employers" ".output {{dump_dir}}/employers.sql" "SELECT * FROM employers;"
    @sqlite3 {{db}} ".mode insert roles" ".output {{dump_dir}}/roles.sql" "SELECT * FROM roles;"
    @sqlite3 {{db}} ".mode insert education" ".output {{dump_dir}}/education.sql" "SELECT * FROM education;"
    @sqlite3 {{db}} ".mode insert skills" ".output {{dump_dir}}/skills.sql" "SELECT * FROM skills;"
    @sqlite3 {{db}} ".mode insert bullets" ".output {{dump_dir}}/bullets.sql" "SELECT * FROM bullets;"
    @sqlite3 {{db}} ".mode insert bullet_skills" ".output {{dump_dir}}/bullet_skills.sql" "SELECT * FROM bullet_skills;"
    @sqlite3 {{db}} ".mode insert bullet_roles" ".output {{dump_dir}}/bullet_roles.sql" "SELECT * FROM bullet_roles;"
    @sqlite3 {{db}} ".mode insert clearances" ".output {{dump_dir}}/clearances.sql" "SELECT * FROM clearances;"
    @sqlite3 {{db}} ".mode insert clearance_roles" ".output {{dump_dir}}/clearance_roles.sql" "SELECT * FROM clearance_roles;"
    @sqlite3 {{db}} ".mode insert languages" ".output {{dump_dir}}/languages.sql" "SELECT * FROM languages;"
    @sqlite3 {{db}} ".mode insert research" ".output {{dump_dir}}/research.sql" "SELECT * FROM research;"
    @sqlite3 {{db}} ".mode insert resumes" ".output {{dump_dir}}/resumes.sql" "SELECT * FROM resumes;"
    @sqlite3 {{db}} ".mode insert resume_bullets" ".output {{dump_dir}}/resume_bullets.sql" "SELECT * FROM resume_bullets;"
    @echo "All tables dumped to {{dump_dir}}/"

# =====================
# DATABASE REBUILD
# =====================

# Rebuild database from schema and seed (WARNING: destroys existing data)
rebuild:
    @echo "WARNING: This will destroy the existing database!"
    @read -p "Type 'yes' to confirm: " confirm && [ "$$confirm" = "yes" ] || exit 1
    @rm -f {{db}}
    @sqlite3 {{db}} < {{schema}}
    @sqlite3 {{db}} < {{seed}}
    @echo "Database rebuilt from schema.sql and seed.sql"

# Rebuild and restore from dumps
rebuild-from-dumps:
    @echo "WARNING: This will destroy and rebuild the database from dumps!"
    @read -p "Type 'yes' to confirm: " confirm && [ "$$confirm" = "yes" ] || exit 1
    @rm -f {{db}}
    @sqlite3 {{db}} < {{schema}}
    @sqlite3 {{db}} < {{seed}}
    @for f in {{dump_dir}}/*.sql; do sqlite3 {{db}} < "$$f" 2>/dev/null || true; done
    @echo "Database rebuilt from dumps"

# =====================
# DATABASE INFO
# =====================

# Show database statistics
stats:
    @echo "=== Database Statistics ==="
    @echo ""
    @echo "Bullets by status:"
    @sqlite3 -header -column {{db}} "SELECT status, COUNT(*) as count FROM bullets GROUP BY status ORDER BY count DESC;"
    @echo ""
    @echo "Bullets by framing:"
    @sqlite3 -header -column {{db}} "SELECT framing, COUNT(*) as count FROM bullets WHERE framing IS NOT NULL GROUP BY framing ORDER BY count DESC;"
    @echo ""
    @echo "Skills coverage (top 10):"
    @sqlite3 -header -column {{db}} "SELECT * FROM skill_bullet_coverage LIMIT 10;"
    @echo ""
    @echo "Total counts:"
    @sqlite3 {{db}} "SELECT 'bullets' as table_name, COUNT(*) as count FROM bullets UNION ALL SELECT 'skills', COUNT(*) FROM skills UNION ALL SELECT 'roles', COUNT(*) FROM roles UNION ALL SELECT 'employers', COUNT(*) FROM employers;"

# Show draft bullets
drafts:
    @sqlite3 -header -column {{db}} "SELECT id, framing, substr(content, 1, 80) || '...' as content_preview FROM bullets WHERE status = 'draft';"

# Show unused bullets (not in any resume)
unused:
    @sqlite3 -header -column {{db}} "SELECT id, framing, status, substr(content, 1, 80) || '...' as content_preview FROM unused_bullets;"

# =====================
# GIT INTEGRATION
# =====================

# Dump and stage for git commit
save:
    @just dump-bullets
    @git add {{dump_dir}}/bullets.sql {{schema}} {{seed}}
    @echo "Database changes staged for commit"
    @echo "Run: git commit -m 'Update resume database'"

# Pre-commit hook helper - dump before committing
pre-commit:
    @just dump-bullets
    @just dump-all

# =====================
# QUERIES
# =====================

# Run a custom SQL query
query sql:
    @sqlite3 -header -column {{db}} "{{sql}}"

# Interactive SQLite shell
shell:
    @sqlite3 -header -column {{db}}

# =====================
# MAINTENANCE
# =====================

# Vacuum and analyze for performance
optimize:
    @sqlite3 {{db}} "VACUUM; ANALYZE;"
    @echo "Database optimized"

# Run once to enable WAL mode on your database
enable-wal:
    @sqlite3 /Users/adam/notes/job-hunting/data/resume.sqlite.db "PRAGMA journal_mode=WAL;"

# Check database integrity
check:
    @sqlite3 {{db}} "PRAGMA integrity_check;"
