# Runs prisma migrate deploy + seed against the DATABASE_URL it is given.
# Used by docker compose (profile: migrate) and by the Kubernetes Job.
FROM node:24-alpine

WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json tsconfig.json prisma.config.ts ./
RUN npm ci --omit=dev --ignore-scripts && npm i --no-save prisma@^7.10.0 tsx@^4.20.0

COPY prisma ./prisma

# `prisma generate` only reads schema.prisma — it never dials a database —
# but prisma.config.ts's env("DATABASE_URL") throws if the variable isn't
# resolvable at all, and no real one exists yet at build time (docker-compose
# supplies the real one as a run-time `environment:`, which overrides this).
# A syntactically valid placeholder satisfies that check without pretending
# to be a reachable database.
RUN DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder" npx prisma generate

CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts"]
