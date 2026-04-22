# Forge Resume Builder

set dotenv-load := true

# Resolve DB path relative to workspace root (bun --filter changes CWD to package dir)
export FORGE_DB_PATH := absolute_path(env("FORGE_DB_PATH", "./data/forge.db"))

# ─── Modules ──────────────────────────────────────────────

# mod docker ".docker/justfile"   # TODO: add when Docker infra is set up
# mod test "packages/justfile"     # TODO: add when test justfile exists
# mod data "data/justfile"         # TODO: add when data justfile exists

# ─── Local development ───────────────────────────────────

# Start core API + MCP server + WebUI locally (SQLite)
dev:
    @echo "Starting Forge API (:3000) + MCP (:5174) + WebUI (:5173)..."
    @echo "Database: {{FORGE_DB_PATH}}"
    bun run --filter '@forge/core' dev &
    sleep 1
    bun run --filter '@forge/mcp' dev &
    sleep 1
    bun run --filter '@forge/webui' dev

# Start dev + MCP Inspector for debugging
debug:
    @echo "Starting Forge + MCP Inspector..."
    @echo "Database: {{FORGE_DB_PATH}}"
    bun run --filter '@forge/core' dev &
    sleep 1
    bun run --filter '@forge/mcp' dev &
    sleep 1
    bun run --filter '@forge/webui' dev &
    sleep 1
    bun run --filter '@forge/mcp' inspect:http

# Build distributable artifacts
release *package="":
    @if [ -z "{{package}}" ]; then \
        bun run --filter '*' build; \
    else \
        bun run --filter "@forge/{{package}}" build; \
    fi

# ─── Individual services (local) ─────────────────────────

# Start only the core API server
api:
    bun run --filter '@forge/core' dev

# Start only the WebUI dev server (needs 'just api' in another tab)
webui:
    @echo "Note: API server must be running on :3000 (run 'just api' in another tab)"
    bun run --filter '@forge/webui' dev

# Start the MCP server on STDIO
mcp:
    bun run packages/mcp/src/index.ts

# ─── Setup & utilities ───────────────────────────────────

# Install dependencies and set up env
setup:
    bun install
    @test -f .env || cp .env.example .env && echo "Created .env from .env.example"
    @mkdir -p data
    @echo "Done. Run 'just dev' to start."

# Check Rust stubs compile
check-rust:
    cargo check --workspace

# ─── Telemetry (mitmproxy → MLFlow) ─────────────────────

# Start mitmproxy telemetry capture for Claude Code
telemetry:
    @echo "Starting mitmproxy telemetry proxy on :8888..."
    @echo "Use with: HTTPS_PROXY=http://localhost:8888 NODE_EXTRA_CA_CERTS=~/.mitmproxy/mitmproxy-ca-cert.pem claude"
    mitmdump --listen-port 8888 -s scripts/claude-telemetry-addon.py

# Ingest captured telemetry into MLFlow
telemetry-ingest:
    MLFLOW_TRACKING_URI=http://127.0.0.1:5000 python3 scripts/ingest-telemetry.py

# Stop the telemetry proxy
telemetry-stop:
    pkill -f mitmdump || true
    @echo "Telemetry proxy stopped."

# ─── Extension packaging ────────────────────────────────

# Package extension for store submission (both browsers)
pack-extension:
    cd packages/extension && bun run build
    @mkdir -p dist
    cd packages/extension/dist/chrome && zip -r ../../../../dist/forge-job-tools-chrome-v$(cd ../.. && jq -r .version manifest.json).zip .
    cd packages/extension/dist/firefox && zip -r ../../../../dist/forge-job-tools-firefox-v$(cd ../.. && jq -r .version manifest.firefox.json).zip .
    @echo "Packaged:"
    @ls -la dist/forge-job-tools-*.zip

# Package source for Firefox AMO review (required for bundled code)
pack-extension-source:
    git archive HEAD --prefix=forge-source/ -o dist/forge-job-tools-source.zip
    @echo "Source archive: dist/forge-job-tools-source.zip"
