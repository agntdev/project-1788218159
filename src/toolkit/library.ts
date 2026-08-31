/** Persistent study-library records.  In Workers these live in one named
 * Durable Object, which also contains the explicit indexes used for listing. */
export type SubjectKind = "science" | "literature";
export interface LibrarySection { id: string; name: string; icon: string }
export interface LibrarySubject { id: string; name: string; kind: SubjectKind; sections: LibrarySection[] }
export interface LibraryFile {
  id: string; subjectId: string; sectionId: string; title: string; description?: string;
  kind: "document" | "photo"; fileId: string; fileName?: string; addedAt: string;
}
export interface LibraryData { subjects: LibrarySubject[]; files: LibraryFile[] }
export const emptyLibrary = (): LibraryData => ({ subjects: [], files: [] });

type LibraryEnv = { CHAT_DO?: { idFromName(name: string): unknown; get(id: unknown): { fetch(input: string, init?: { method?: string; body?: string; headers?: Record<string, string> }): Promise<Response> } } };

function store(ctx: unknown) {
  const namespace = (ctx as { env?: LibraryEnv } | undefined)?.env?.CHAT_DO;
  if (!namespace) return undefined;
  return namespace.get(namespace.idFromName("study-library"));
}

/** Undefined means the Worker persistent-store binding has not been configured. */
export async function readLibrary(ctx: unknown): Promise<LibraryData | undefined> {
  const target = store(ctx);
  if (!target) return undefined;
  const response = await target.fetch("https://do/library", { method: "GET" });
  if (!response.ok) return undefined;
  return (await response.json()) as LibraryData;
}

export async function writeLibrary(ctx: unknown, value: LibraryData): Promise<boolean> {
  const target = store(ctx);
  if (!target) return false;
  const response = await target.fetch("https://do/library", {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(value),
  });
  return response.ok;
}

export function recordId(): string { return crypto.randomUUID(); }
/** A single clock seam for persisted timestamps. */
export let now = (): Date => new Date();
export function nowIso(): string { return now().toISOString(); }
