// Package store is the only package that speaks SQL.
//
// The schema is owned by prisma/schema.prisma; these queries are written by hand
// against it because Prisma has no supported Go client. Postgres identifiers are
// camelCase and therefore always quoted.
package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Sentinel errors the services branch on.
var (
	ErrNotFound = errors.New("not found")
	ErrConflict = errors.New("conflict")
)

// DB wraps a connection pool.
type DB struct {
	pool *pgxpool.Pool
}

// Open connects to Postgres and verifies the connection.
func Open(ctx context.Context, dsn string) (*DB, error) {
	// The same DATABASE_URL is used by Prisma, which adds parameters Postgres
	// does not recognise. Strip them before pgx sees them.
	normalised, err := NormaliseDSN(dsn)
	if err != nil {
		return nil, err
	}

	cfg, err := pgxpool.ParseConfig(normalised)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}

	// Sized for a single campus. Raise MaxConns before you raise anything else.
	cfg.MaxConns = 20
	cfg.MinConns = 2
	cfg.MaxConnLifetime = time.Hour
	cfg.MaxConnIdleTime = 15 * time.Minute
	cfg.HealthCheckPeriod = 30 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("connect to postgres: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	return &DB{pool: pool}, nil
}

// Pool exposes the underlying pool for the rare caller that needs it.
func (db *DB) Pool() *pgxpool.Pool { return db.pool }

// Close releases every connection.
func (db *DB) Close() { db.pool.Close() }

// Ping is the readiness probe.
func (db *DB) Ping(ctx context.Context) error { return db.pool.Ping(ctx) }

// SchemaReady reports whether prisma migrate has been run. Booting an API
// against an empty database produces a confusing pile of 500s otherwise.
func (db *DB) SchemaReady(ctx context.Context) error {
	var exists bool
	err := db.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM information_schema.tables
		 WHERE table_schema = current_schema() AND table_name = 'users')`).Scan(&exists)
	if err != nil {
		return fmt.Errorf("check schema: %w", err)
	}
	if !exists {
		return errors.New("database has no schema — run: npm run db:deploy")
	}
	return nil
}

// InTx runs fn inside a transaction, rolling back on error or panic.
func (db *DB) InTx(ctx context.Context, fn func(pgx.Tx) error) error {
	tx, err := db.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback(context.WithoutCancel(ctx))
			panic(p)
		}
	}()

	if err := fn(tx); err != nil {
		if rbErr := tx.Rollback(context.WithoutCancel(ctx)); rbErr != nil && !errors.Is(rbErr, pgx.ErrTxClosed) {
			return errors.Join(err, fmt.Errorf("rollback: %w", rbErr))
		}
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}

// mapErr converts driver errors into the sentinels above.
func mapErr(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505": // unique_violation
			return fmt.Errorf("%w: %s", ErrConflict, pgErr.ConstraintName)
		case "23503": // foreign_key_violation
			return fmt.Errorf("%w: referenced row does not exist (%s)", ErrNotFound, pgErr.ConstraintName)
		}
	}
	return err
}

// IsUniqueViolation reports whether err is a duplicate-key error, optionally on
// a specific constraint.
func IsUniqueViolation(err error, constraint string) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "23505" {
		return false
	}
	return constraint == "" || pgErr.ConstraintName == constraint
}

// nullString turns "" into a SQL NULL, so optional text columns stay NULL
// instead of filling up with empty strings.
func nullString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func derefInt(i *int32) int {
	if i == nil {
		return 0
	}
	return int(*i)
}

// clampLimit keeps page sizes sane whatever the client asks for.
func clampLimit(limit, def, max int) int {
	if limit <= 0 {
		return def
	}
	if limit > max {
		return max
	}
	return limit
}

// CampusIDs lists every campus, used by the nightly Owl Board snapshot job.
func (db *DB) CampusIDs(ctx context.Context) ([]string, error) {
	rows, err := db.pool.Query(ctx, `SELECT "id" FROM "campuses" ORDER BY "createdAt" ASC`)
	if err != nil {
		return nil, mapErr(err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, mapErr(err)
		}
		ids = append(ids, id)
	}
	return ids, mapErr(rows.Err())
}
