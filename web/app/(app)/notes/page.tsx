"use client";

import Link from "next/link";
import { useState } from "react";
import { PageBody, TopBar } from "@/components/app-shell/TopBar";
import { VoteBar } from "@/components/feed/VoteBar";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Skeleton";
import { DownloadIcon, UploadIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { usePaged } from "@/lib/use-paged";
import { useAuth } from "@/lib/auth-context";
import { timeAgo } from "@/lib/format";
import type { Items, Note, UploadResult } from "@/lib/types";

const KINDS = [
  { value: "", label: "All" },
  { value: "PYQ", label: "PYQs" },
  { value: "NOTES", label: "Notes" },
  { value: "LAB", label: "Lab" },
];

function UploadDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { refresh } = useAuth();
  const [form, setForm] = useState({
    subject: "",
    semester: "3",
    branch: "",
    kind: "NOTES",
    title: "",
    fileUrl: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<UploadResult>("/v1/notes", {
        ...form,
        semester: Number(form.semester),
        branch: form.branch || undefined,
      });
      toast(`Uploaded · +${result.stardust} Stardust`, "success");
      refresh();
      onDone();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "could not upload that"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add to the locker"
      description="Uploads earn Stardust. Upvotes on your uploads earn more."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!form.title || !form.subject || !form.fileUrl} onClick={submit}>
            Upload
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Title" value={form.title} onChange={set("title")} placeholder="DBMS mid-sem 2025 (with solutions)" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Subject" value={form.subject} onChange={set("subject")} placeholder="DBMS" />
          <Select label="Semester" value={form.semester} onChange={set("semester")}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Kind" value={form.kind} onChange={set("kind")}>
            <option value="NOTES">Notes</option>
            <option value="PYQ">Previous year paper</option>
            <option value="LAB">Lab file</option>
          </Select>
          <Input label="Branch" value={form.branch} onChange={set("branch")} placeholder="CSE (optional)" />
        </div>
        <Input
          label="File link"
          value={form.fileUrl}
          onChange={set("fileUrl")}
          placeholder="https://"
          hint="Paste a link to the file. Direct uploads land when storage is wired up."
        />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}

export default function NotesPage() {
  const toast = useToast();
  const [kind, setKind] = useState("");
  const [subject, setSubject] = useState("");
  const [semester, setSemester] = useState("");
  const [sort, setSort] = useState<"top" | "new">("top");
  const [uploading, setUploading] = useState(false);

  const subjects = useApi<Items<string>>("/v1/notes/subjects");
  const paged = usePaged<Note>("/v1/notes", {
    kind: kind || undefined,
    subject: subject || undefined,
    semester: semester || undefined,
    sort,
    limit: 20,
  });

  const download = async (note: Note) => {
    try {
      await api.post(`/v1/notes/${note.id}/download`);
      paged.setItems((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, downloads: n.downloads + 1 } : n)),
      );
      window.open(note.fileUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast(errorMessage(err, "could not open that file"), "error");
    }
  };

  return (
    <>
      <TopBar
        title="Note Locker"
        subtitle="PYQs, notes and lab files — the reason to open this app on a dead Tuesday"
        actions={
          <Button size="sm" icon={<UploadIcon size={15} />} onClick={() => setUploading(true)}>
            <span className="hidden sm:inline">Upload</span>
          </Button>
        }
        tabs={
          <>
            <Segmented size="sm" value={kind} onChange={setKind} options={KINDS} />
            <Segmented
              size="sm"
              value={sort}
              onChange={setSort}
              options={[
                { value: "top", label: "Top" },
                { value: "new", label: "New" },
              ]}
            />
          </>
        }
      />

      <PageBody width="md">
        <div className="mb-4 flex flex-wrap gap-2">
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Subject"
            className="cursor-pointer rounded-[var(--r-sm)] border border-border bg-surface px-2.5 py-1.5 text-[0.8125rem] text-muted"
          >
            <option value="">All subjects</option>
            {(subjects.data?.items ?? []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            aria-label="Semester"
            className="cursor-pointer rounded-[var(--r-sm)] border border-border bg-surface px-2.5 py-1.5 text-[0.8125rem] text-muted"
          >
            <option value="">Any semester</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>
        </div>

        {paged.loading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-[var(--r-lg)]" />
            ))}
          </div>
        ) : !paged.items.length ? (
          <EmptyState
            title="Nothing in the locker yet"
            body="Upload a paper or a set of notes and you'll be the reason someone passes."
            action={
              <Button size="sm" onClick={() => setUploading(true)}>
                Upload the first one
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {paged.items.map((note) => (
              <article key={note.id} className="card flex items-center gap-4 p-4">
                <VoteBar
                  path={`/v1/notes/${note.id}/vote`}
                  score={note.score}
                  viewerVote={note.viewerVote}
                  onChange={(result) =>
                    paged.setItems((prev) => prev.map((n) => (n.id === note.id ? { ...n, ...result } : n)))
                  }
                />

                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[0.9375rem] font-medium text-text">{note.title}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-faint">
                    <Badge tone="accent" mono>
                      {note.kind}
                    </Badge>
                    <span>{note.subject}</span>
                    <span>·</span>
                    <span>Sem {note.semester}</span>
                    {note.branch && (
                      <>
                        <span>·</span>
                        <span>{note.branch}</span>
                      </>
                    )}
                    <span>·</span>
                    <span className="tabnum">{note.downloads} downloads</span>
                    <span>·</span>
                    <span>{timeAgo(note.createdAt)}</span>
                  </div>
                </div>

                <Link
                  href={`/profile/${note.uploader.handle}`}
                  className="hidden shrink-0 items-center gap-2 sm:flex"
                  aria-label={`Uploaded by ${note.uploader.displayName}`}
                >
                  <Avatar user={note.uploader} size={26} />
                </Link>

                <Button
                  size="sm"
                  variant="outline"
                  icon={<DownloadIcon size={14} />}
                  onClick={() => download(note)}
                >
                  <span className="hidden sm:inline">Get</span>
                </Button>
              </article>
            ))}

            {paged.hasMore && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" size="sm" loading={paged.loadingMore} onClick={paged.loadMore}>
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </PageBody>

      <UploadDialog open={uploading} onClose={() => setUploading(false)} onDone={paged.reload} />
    </>
  );
}
