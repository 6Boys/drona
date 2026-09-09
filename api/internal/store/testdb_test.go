package store

import (
	"context"
	"crypto/rand"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/aniketrathour/dronasphere/api/internal/domain"
)

// testDB connects to the same database the rest of the project uses locally
// (DATABASE_URL from .env). Tests skip cleanly when no database is reachable —
// so `go test ./...` still passes with no Postgres running — and run for real
// whenever `npm run infra:up && npm run db:deploy` has been done.
//
// Store methods take *DB, not a transaction handle, so tests clean up with
// explicit deletes (via t.Cleanup) rather than a rolled-back transaction. Every
// row a test creates uses a fresh UUID and a "store-test-" campus/email prefix,
// so a test run can never collide with or corrupt the seeded demo data.
func testDB(t *testing.T) *DB {
	t.Helper()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgresql://drona:drona_dev_password@localhost:5432/dronasphere?schema=public"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db, err := Open(ctx, dsn)
	if err != nil {
		t.Skipf("no database reachable (start it with `npm run infra:up`): %v", err)
	}
	if err := db.SchemaReady(ctx); err != nil {
		db.Close()
		t.Skipf("database has no schema (`npm run db:deploy`): %v", err)
	}

	t.Cleanup(db.Close)
	return db
}

// newID returns a fresh UUID for a row this test owns.
func newID(t *testing.T) string {
	t.Helper()
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		t.Fatalf("read random bytes: %v", err)
	}
	buf[6] = (buf[6] & 0x0f) | 0x40 // version 4
	buf[8] = (buf[8] & 0x3f) | 0x80 // variant 10
	return fmt.Sprintf("%x-%x-%x-%x-%x", buf[0:4], buf[4:6], buf[6:8], buf[8:10], buf[10:16])
}

// testCampus creates a throw-away campus and registers its teardown. Every
// test that needs a user starts here, so no test ever touches the seeded
// "Dronacharya College of Engineering" campus from prisma/seed.ts.
func testCampus(t *testing.T, db *DB) string {
	t.Helper()
	ctx := context.Background()

	id := newID(t)
	suffix := id[:8]
	domain := "store-test-" + suffix + ".example"

	if _, err := db.pool.Exec(ctx, `
		INSERT INTO "campuses" ("id", "name", "slug", "emailDomain", "createdAt")
		VALUES ($1, $2, $3, $4, now())`,
		id, "Store Test Campus "+suffix, "store-test-"+suffix, domain); err != nil {
		t.Fatalf("create test campus: %v", err)
	}

	t.Cleanup(func() {
		// ON DELETE CASCADE on users takes every dependent row (follows,
		// posts, threads, ...) down with it.
		if _, err := db.pool.Exec(context.Background(),
			`DELETE FROM "campuses" WHERE "id" = $1`, id); err != nil {
			t.Logf("cleanup: could not delete test campus %s: %v", id, err)
		}
	})
	return id
}

// testUserRow is a minimal helper around CreateUser for store tests that just
// need *a* verified account and do not care about the auth flow around it.
// The caller's campus (from testCampus) cascades the user away on cleanup.
func testUserRow(t *testing.T, db *DB, campusID, handle string) *domain.UserPrivate {
	t.Helper()
	u, err := db.CreateUser(context.Background(), CreateUserParams{
		CampusID:           campusID,
		Email:              handle + "@" + campusID[:8] + ".store-test.example",
		Handle:             handle,
		DisplayName:        handle,
		VerificationMethod: "EMAIL_DOMAIN",
		Verified:           true,
	})
	if err != nil {
		t.Fatalf("create test user %s: %v", handle, err)
	}
	return u
}
