package store

import (
	"fmt"
	"net/url"
)

// prismaOnlyParams are query parameters Prisma understands and Postgres does not.
// Passing them straight through makes the server reject the connection with
// `unrecognized configuration parameter`, so they are stripped here.
//
// This exists so there is exactly one DATABASE_URL in .env, shared by Prisma
// (migrations, seed, studio) and by this Go service. Two connection strings for
// one database is a bug waiting to happen.
var prismaOnlyParams = map[string]bool{
	"schema":               true, // translated to search_path below
	"connection_limit":     true,
	"pool_timeout":         true,
	"pgbouncer":            true,
	"socket_timeout":       true,
	"sslidentity":          true,
	"sslpassword":          true,
	"sslcert":              true,
	"statement_cache_size": true,
}

// NormaliseDSN rewrites a Prisma-flavoured Postgres URL into one pgx accepts.
// The schema parameter becomes a search_path runtime setting, which is what
// Prisma means by it; everything else Prisma-specific is dropped.
func NormaliseDSN(dsn string) (string, error) {
	u, err := url.Parse(dsn)
	if err != nil {
		return "", fmt.Errorf("parse DATABASE_URL: %w", err)
	}

	q := u.Query()
	schema := q.Get("schema")

	for key := range prismaOnlyParams {
		q.Del(key)
	}
	if schema != "" && q.Get("search_path") == "" {
		q.Set("search_path", schema)
	}

	u.RawQuery = q.Encode()
	return u.String(), nil
}
