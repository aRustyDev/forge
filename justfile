# Forge Resume Builder

set dotenv-load := true

# Resolve DB path relative to workspace root (bun --filter changes CWD to package dir)
export FORGE_DB_PATH := absolute_path(env("FORGE_DB_PATH", "./data/forge.db"))

# Start core API + MCP server + webui together
dev:
    @echo "Starting Forge API (:3000) + MCP (:5174) + WebUI (:5173)..."
    @echo "Database: {{FORGE_DB_PATH}}"
    bun run --filter '@forge/core' dev &
    sleep 1
    bun run --filter '@forge/mcp' dev &
    sleep 1
    bun run --filter '@forge/webui' dev

# Start only the core API server
api:
    bun run --filter '@forge/core' dev

# Start only the webui dev server (needs 'just api' running in another tab)
webui:
    @echo "Note: API server must be running on :3000 (run 'just api' in another tab)"
    bun run --filter '@forge/webui' dev

# Run all unit tests (core + sdk + webui)
test:
    bun run --filter '@forge/core' test
    bun run --filter '@forge/sdk' test
    bun test packages/webui/src/__tests__/

# Run only core tests
test-core:
    bun run --filter '@forge/core' test

# Run only webui unit tests (adoption, layout, navigation, content, interactive, visualization)
test-webui:
    bun test packages/webui/src/__tests__/

# Run Playwright E2E tests (requires dev server running)
test-e2e:
    cd packages/webui && npx playwright test

# Check Rust stubs compile
check-rust:
    cargo check --workspace

# Run database migrations
migrate:
    bun run --filter '@forge/core' migrate

# Dump Forge database for backup
dump:
    sqlite3 ${FORGE_DB_PATH:-./data/forge.db} .dump > data/forge-dump-$(date +%Y%m%d).sql

# Open SQLite shell
shell:
    sqlite3 ${FORGE_DB_PATH:-./data/forge.db}

# Start the MCP server on STDIO
mcp:
    bun run packages/mcp/src/index.ts

# Build all TypeScript packages + webui
build:
    bun run --filter '*' build

# Build everything including Rust
build-all: build check-rust

# Install dependencies and set up env
setup:
    bun install
    @test -f .env || cp .env.example .env && echo "Created .env from .env.example"
    @mkdir -p data
    @echo "Done. Run 'just dev' to start the API server."
