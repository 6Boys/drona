# The Go API, built static and shipped on a base image with nothing else in it.
#
#   docker compose --profile full up --build
#
# Two stages: the toolchain never ships. What lands in the final image is one
# statically linked binary, the CA bundle it needs to talk SMTP over TLS, and
# the timezone database — that last one is not optional here, because the Owl
# Board's night window is defined in a named zone (NIGHT_TIMEZONE, default
# Asia/Kolkata) and time.LoadLocation on a distroless-style image with no
# zoneinfo would fail config validation at boot.

# ---------------------------------------------------------------- build ----
FROM golang:1.25-alpine AS build

WORKDIR /src

# Dependencies first: this layer is only invalidated when go.mod/go.sum move,
# so ordinary code changes reuse the module cache.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO off so the result is genuinely static; trimpath and -s -w keep the
# binary small and free of local filesystem paths.
ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

# ----------------------------------------------------------------- run ----
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata \
    && adduser -D -u 10001 drona

# Uploaded pictures live here. docker-compose.yml mounts a named volume over
# it; without one, uploads persist only as long as the container does.
RUN mkdir -p /data/media && chown -R drona:drona /data

COPY --from=build /out/api /app/api

USER drona
WORKDIR /app

ENV API_PORT=8080 \
    MEDIA_DIR=/data/media

EXPOSE 8080
VOLUME ["/data/media"]

# Uses the binary's own probe (cmd/api/main.go -healthcheck) rather than
# adding curl to the image just to ask it whether it is alive.
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=5 \
    CMD ["/app/api", "-healthcheck"]

ENTRYPOINT ["/app/api"]
