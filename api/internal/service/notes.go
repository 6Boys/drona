package service

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/aniketrathour/dronasphere/api/internal/config"
	"github.com/aniketrathour/dronasphere/api/internal/domain"
	"github.com/aniketrathour/dronasphere/api/internal/httpx"
	"github.com/aniketrathour/dronasphere/api/internal/store"
)

// Stardust paid for contributing to the Note Locker (PRD 7.4, 7.9).
const (
	stardustPerUpload = 40
	stardustPerUpvote = 5
)

// NoteService owns the Note Locker: PYQs, notes and lab files by subject and
// semester. PRD 7.4 calls this the most useful thing in the app, and the reason
// someone opens it on a dead Tuesday — so it is a launch feature, not a nice-to-have.
type NoteService struct {
	cfg *config.Config
	db  *store.DB
	log *slog.Logger
	now func() time.Time
}

// NewNoteService wires the service.
func NewNoteService(cfg *config.Config, db *store.DB, log *slog.Logger, now func() time.Time) *NoteService {
	if now == nil {
		now = time.Now
	}
	return &NoteService{cfg: cfg, db: db, log: log, now: now}
}

// NoteQuery filters a listing.
type NoteQuery struct {
	Subject  string
	Semester int
	Kind     string
	Sort     string
	Cursor   string
	Limit    int
}

// List returns a page of the locker.
func (s *NoteService) List(ctx context.Context, viewerID string, q NoteQuery) (domain.Page[domain.Note], error) {
	var empty domain.Page[domain.Note]

	cursor, err := domain.DecodeCursor(q.Cursor)
	if err != nil {
		return empty, httpx.BadRequest("that page cursor is not valid")
	}

	notes, err := s.db.ListNotes(ctx, store.NoteFilter{
		ViewerID: viewerID,
		Subject:  q.Subject,
		Semester: q.Semester,
		Kind:     strings.ToUpper(strings.TrimSpace(q.Kind)),
		Sort:     q.Sort,
		Cursor:   cursor,
		Limit:    q.Limit,
	})
	if err != nil {
		return empty, httpx.Internal("could not load the Note Locker").WithCause(err)
	}

	limit := q.Limit
	if limit <= 0 {
		limit = 20
	}
	return domain.NewPage(notes, limit, func(n domain.Note) domain.Cursor {
		return domain.Cursor{Time: n.CreatedAt, Score: float64(n.Score), ID: n.ID}
	}), nil
}

// Subjects lists the subjects that have files.
func (s *NoteService) Subjects(ctx context.Context) ([]string, error) {
	subjects, err := s.db.NoteSubjects(ctx)
	if err != nil {
		return nil, httpx.Internal("could not load subjects").WithCause(err)
	}
	if subjects == nil {
		subjects = []string{}
	}
	return subjects, nil
}

// UploadRequest describes a new file.
type UploadRequest struct {
	Subject  string `json:"subject"`
	Semester int    `json:"semester"`
	Branch   string `json:"branch"`
	Kind     string `json:"kind"`
	Title    string `json:"title"`
	FileURL  string `json:"fileUrl"`
	FileSize int    `json:"fileSize"`
}

// UploadResult is a stored upload plus the Stardust it earned.
type UploadResult struct {
	NoteID   string `json:"noteId"`
	Stardust int    `json:"stardust"`
	Balance  int    `json:"balance"`
}

var noteKinds = map[string]bool{"NOTES": true, "PYQ": true, "LAB": true}

// Upload records a file and credits the uploader.
func (s *NoteService) Upload(ctx context.Context, uploaderID string, req UploadRequest) (*UploadResult, error) {
	fields := map[string]string{}

	subject := strings.TrimSpace(req.Subject)
	if len(subject) < 2 || len(subject) > 60 {
		fields["subject"] = "2–60 characters"
	}
	title := strings.TrimSpace(req.Title)
	if len(title) < 3 || len(title) > 120 {
		fields["title"] = "3–120 characters"
	}
	if req.Semester < 1 || req.Semester > 10 {
		fields["semester"] = "must be 1–10"
	}
	kind := strings.ToUpper(strings.TrimSpace(req.Kind))
	if kind == "" {
		kind = "NOTES"
	}
	if !noteKinds[kind] {
		fields["kind"] = "must be NOTES, PYQ or LAB"
	}
	if !isHTTPURL(req.FileURL) {
		fields["fileUrl"] = "must be an http(s) link from the upload step"
	}
	if len(fields) > 0 {
		return nil, httpx.Validation(fields)
	}

	noteID, err := s.db.CreateNote(ctx, store.CreateNoteParams{
		UploaderID: uploaderID,
		Subject:    subject,
		Semester:   req.Semester,
		Branch:     strings.ToUpper(strings.TrimSpace(req.Branch)),
		Kind:       kind,
		Title:      title,
		FileURL:    strings.TrimSpace(req.FileURL),
		FileSize:   req.FileSize,
	})
	if err != nil {
		return nil, httpx.Internal("could not save that upload").WithCause(err)
	}

	balance, err := s.db.AddStardust(ctx, uploaderID, stardustPerUpload, domain.StardustNoteUpload, noteID)
	if err != nil {
		s.log.WarnContext(ctx, "upload saved but stardust was not credited", "error", err, "note", noteID)
	}
	return &UploadResult{NoteID: noteID, Stardust: stardustPerUpload, Balance: balance}, nil
}

// Vote upvotes a file and pays the uploader for a useful contribution.
func (s *NoteService) Vote(ctx context.Context, userID, noteID string, value int) (*VoteResult, error) {
	if value < -1 || value > 1 {
		return nil, httpx.BadRequest("vote must be -1, 0 or 1")
	}

	score, uploaderID, err := s.db.VoteNote(ctx, userID, noteID, value)
	if err != nil {
		return nil, notFoundOr(err, "that file is gone")
	}

	if value > 0 && uploaderID != userID {
		if _, err := s.db.AddStardust(ctx, uploaderID, stardustPerUpvote, domain.StardustNoteUpvote, noteID); err != nil {
			s.log.WarnContext(ctx, "could not credit an upvote", "error", err, "note", noteID)
		}
	}
	return &VoteResult{Score: score, ViewerVote: value}, nil
}

// RecordDownload counts a download, which PRD 11 tracks as a utility metric.
func (s *NoteService) RecordDownload(ctx context.Context, noteID string) error {
	if err := s.db.IncrementNoteDownloads(ctx, noteID); err != nil {
		return notFoundOr(err, "that file is gone")
	}
	return nil
}
