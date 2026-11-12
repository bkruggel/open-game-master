import { currentUser, unauthorized } from "@/lib/auth";
import { getPdfImportForUser, importRuns, pendingImportRefusal, savePages } from "@/lib/db/pdf-imports";
import { MAX_IMPORT_RUNS, pageBatchSchema } from "@/lib/pdf-import/reading";
import { requestT } from "@/lib/request-locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A batch of the book's pages as the page read them (reading.ts), and the
// fonts named so far. Sending a page again replaces it, so a batch that
// failed on a weak connection is simply sent again.

export async function POST(request: Request, { params }: { params: Promise<{ importId: string }> }) {
  const user = await currentUser();
  if (!user) return unauthorized();
  // The page shows these raw (send-book's call throws data.error straight
  // into the button's error line), so they answer in the request's language.
  const t = requestT(request);
  const { importId } = await params;
  const item = getPdfImportForUser(importId, user.id);
  if (!item) return Response.json({ error: t("pdf.refusal.gone") }, { status: 404 });
  if (item.state !== "reading" && item.state !== "failed") {
    return Response.json({ error: t("pdf.refusal.allPages") }, { status: 409 });
  }
  const parsed = pageBatchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: t("pdf.refusal.badPages") }, { status: 400 });
  if (parsed.data.pages.some((page) => page.n > item.pageCount)) {
    return Response.json({ error: t("pdf.refusal.pagePastEnd") }, { status: 400 });
  }
  // A book's text is held to a total (reading.ts): ten times a big
  // hardcover's, and the bound on the work the layout pass can be asked.
  const runs = parsed.data.pages.reduce((sum, page) => sum + page.runs.length, 0);
  if (importRuns(item.id, parsed.data.pages.map((page) => page.n)) + runs > MAX_IMPORT_RUNS) {
    return Response.json({ error: t("pdf.refusal.tooMuchText") }, { status: 413 });
  }
  // Pages wait in the database until the import lands: held to the
  // account's room for unfinished imports and the disk's floor.
  const refusal = pendingImportRefusal(user.id, Buffer.byteLength(JSON.stringify(parsed.data.pages)));
  if (refusal) return Response.json({ error: refusal.error }, { status: refusal.status });
  savePages(item.id, parsed.data.fonts, parsed.data.pages);
  return Response.json({ received: item.pagesReceived + parsed.data.pages.length });
}
