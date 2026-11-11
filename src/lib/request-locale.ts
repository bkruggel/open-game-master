// A request's language, and the words that ride on it (quality pass 3): the
// app's own locale header first (X-Odm-Locale, set by the client from its
// stored odm.locale, src/lib/locale.ts), then the browser's Accept-Language —
// the same resolution the rulebook and the starter seed read. Routes answer
// their refusals (refusal.*) in this language, because panels and alerts
// show the server's words raw; a request that asks for neither — curl, an
// old bundle — reads English.
//
// Kept apart from src/lib/rulebook/book.ts so the campaign API can resolve a
// request's language without loading the rulebook's two books with it.
import { translate, type Locale } from "@/lib/messages-logic";

export type BookLocale = Locale;

// The book language an Accept-Language header asks for: the first tag that
// names French or English wins; a header that names neither reads English.
export function localeFromAcceptLanguage(header: string | null): BookLocale {
  if (!header) return "en";
  for (const part of header.split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase();
    if (tag === "fr" || tag.startsWith("fr-")) return "fr";
    if (tag === "en" || tag.startsWith("en-")) return "en";
  }
  return "en";
}

// The request's language: the app's own locale header (X-Odm-Locale, set by
// the client from its stored odm.locale) wins, so a French reader on an
// English-locale device reads French; a request without it — curl, an old
// bundle — falls back to the browser's Accept-Language as before.
export function bookLocaleOf(request: Request): BookLocale {
  const own = request.headers.get("x-odm-locale");
  if (own === "fr" || own === "en") {
    return own;
  }
  return localeFromAcceptLanguage(request.headers.get("accept-language"));
}

// The refusal translator a route answers with: the request's language, keyed
// (refusal.* and the reused keys), an untranslated key falling back to its
// English line as everywhere else.
export function requestT(request: Request): (key: string, vars?: Record<string, string | number>) => string {
  const locale = bookLocaleOf(request);
  return (key, vars) => translate(locale, key, vars);
}
