# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS build

WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json vitest.config.ts ./
COPY packages/core/package.json packages/core/package.json
COPY packages/runtime/package.json packages/runtime/package.json
COPY packages/adapters/package.json packages/adapters/package.json
COPY packages/cli/package.json packages/cli/package.json

RUN pnpm install --frozen-lockfile

COPY packages ./packages

RUN pnpm build && pnpm prune --prod

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl docker.io git gpg openssh-client \
  && curl -fsSL https://packages.gitlab.com/gitlab/gitlab-cli/gpgkey \
    | gpg --dearmor -o /usr/share/keyrings/gitlab-cli.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/gitlab-cli.gpg] https://packages.gitlab.com/gitlab/gitlab-cli/debian/ bookworm main" \
    > /etc/apt/sources.list.d/gitlab-cli.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends glab \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages

RUN ln -s /app/packages/cli/dist/index.mjs /usr/local/bin/morpheus

WORKDIR /workspace

ENTRYPOINT ["morpheus"]
CMD ["--help"]
