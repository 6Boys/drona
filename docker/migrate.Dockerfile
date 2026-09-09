# Runs prisma migrate deploy + seed against the DATABASE_URL it is given.
# Used by docker compose (profile: migrate) and by the Kubernetes Job.
FROM node:24-alpine

WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json tsconfig.json prisma.config.ts ./
RUN npm ci --omit=dev --ignore-scripts && npm i --no-save prisma@^7.10.0 tsx@^4.20.0

COPY prisma ./prisma
RUN npx prisma generate

CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts"]
