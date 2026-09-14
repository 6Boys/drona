import { describe, expect, it } from "vitest";
import { precheck } from "./MediaUpload";

// The client half of the upload policy. It exists to fail fast with a useful
// reason rather than to be the gate — api/internal/media re-checks all of
// this on the real bytes — so what matters here is that it never rejects
// something the server would have accepted, and that its wording is specific.
function fakeFile(type: string, bytes: number): File {
  const file = new File(["x"], "upload", { type });
  // File.size is read-only and derived from the blob parts; override it
  // rather than actually allocating 5 MB in a unit test.
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

const OK = 1024;
const MAX = 5 * 1024 * 1024;

describe("precheck", () => {
  it("accepts every type the server accepts", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      expect(precheck(fakeFile(type, OK)), type).toBeNull();
    }
  });

  it("accepts a file of exactly the limit", () => {
    expect(precheck(fakeFile("image/png", MAX))).toBeNull();
  });

  it("rejects one byte over the limit, and says how big it was", () => {
    const problem = precheck(fakeFile("image/png", MAX + 1));
    expect(problem).toContain("5 MB max");
    expect(problem).toContain("5.0 MB");
  });

  it("names video specifically, because that is the common mistake", () => {
    for (const type of ["video/mp4", "video/webm", "video/quicktime"]) {
      expect(precheck(fakeFile(type, OK)), type).toContain("Videos aren't supported");
    }
  });

  it("rejects other non-images without calling them video", () => {
    const problem = precheck(fakeFile("application/pdf", OK));
    expect(problem).toContain("JPEG, PNG, WEBP or GIF");
    expect(problem).not.toContain("Video");
  });

  it("checks the type before the size, so a huge video says 'video' not 'too big'", () => {
    expect(precheck(fakeFile("video/mp4", MAX * 10))).toContain("Videos aren't supported");
  });
});
