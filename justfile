# Forge Resume Builder

set dotenv-load := true

# Resolve DB path relative to workspace root (bun --filter changes CWD to package dir)
export FORGE_DB_PATH := absolute_path(env("FORGE_DB_PATH", "./data/forge.db"))

# ─── Modules ──────────────────────────────────────────────

mod docker ".docker/justfile"
mod test "packages/justfile"
mod data "data/justfile"

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

# ─── forge-wasm (Rust → WebAssembly) ────────────────────
#
# These recipes build the forge-wasm crate for the wasm32-unknown-unknown
# target. They use the rustup-managed `stable` toolchain explicitly because
# the project's default Rust (Homebrew) lacks the wasm32 sysroot. Install
# requirements:
#
#   rustup install stable
#   rustup target add wasm32-unknown-unknown --toolchain stable
#   cargo install wasm-pack         # only needed for `wasm-pack-build`
#
# Build forge-wasm to wasm32. Use this in CI to catch WASM-only breaks at
# build time rather than at deploy time. forge-server MUST NOT depend on
# forge-wasm (passive guard: forge-wasm is omitted from workspace.dependencies).
wasm-build:
    @echo "Building forge-wasm for wasm32-unknown-unknown..."
    RUSTC=$HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin/rustc \
      $HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin/cargo \
      build -p forge-wasm --target wasm32-unknown-unknown

# Verify forge-wasm's wasm32 dep tree stays free of native-only crates
# (rusqlite, libsqlite3-sys, openssl-sys, etc.). Use this as a CI gate to
# catch accidental imports of native deps from the WASM crate.
wasm-deps-check:
    @echo "Checking forge-wasm wasm32 deps for native-only crates..."
    @if RUSTC=$HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin/rustc \
        $HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin/cargo \
        tree -p forge-wasm --target wasm32-unknown-unknown -i rusqlite >/dev/null 2>&1; \
      then echo "FAIL: rusqlite found in forge-wasm wasm32 deps"; exit 1; \
      else echo "OK: rusqlite is excluded from forge-wasm wasm32 deps"; fi

# Produce a loadable .wasm + JS glue via wasm-pack. Output goes to
# crates/forge-wasm/pkg/. Requires `cargo install wasm-pack`.
wasm-pack-build target="bundler":
    @echo "Running wasm-pack build (target: {{target}})..."
    cd crates/forge-wasm && wasm-pack build --target {{target}}

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
