# packages/core/src/storage/adapters/helix/db/Dockerfile
FROM rust:slim AS builder
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
RUN curl -sSL https://install.helix-db.com | bash
WORKDIR /app
COPY dist/schema.hx dist/queries.hx ./db/
RUN helix build

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/helix-server /usr/local/bin/helixdb
EXPOSE 6969
CMD ["helixdb"]
