"use client";

import { AlertTriangle, Info } from "lucide-react";
import { useT } from "@/lib/locale";
import { useContentCampaign } from "@/lib/content-scope";
import { ui } from "@/lib/ui";

// Why an option list is short, said where the option is missing (workshop
// import audit F06): the asker's own Homebrew this table does not offer, or
// a list the server did not send, which stands on the books' own meanwhile.
// The rule behind the first is src/lib/content/scope.ts: at a table, the
// shelves of whoever runs it count, and a player's entry counts once one of
// them keeps a copy.
export function TableScopeNote({
  noun,
  unadmitted,
  failed = false,
  onRetry,
}: {
  // What the list holds, in the plural ("subclasses", "species").
  noun: string;
  unadmitted: string[];
  failed?: boolean;
  onRetry?: () => void;
}) {
  const atTable = Boolean(useContentCampaign());
  const t = useT();
  if (!failed && !unadmitted.length) {
    return null;
  }
  return (
    <div className="mt-1 space-y-1 text-xs">
      {failed ? (
        <p role="alert" className="flex flex-wrap items-center gap-1.5 text-amber-300/90">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {t("builder.scope.failed", {
              scope: atTable ? t("builder.scope.atTable") : t("builder.scope.yours"),
              noun,
            })}
          </span>
          {onRetry ? (
            <button type="button" onClick={onRetry} className={`${ui.btnSmall} min-h-10`}>
              {t("builder.finish.tryAgain")}
            </button>
          ) : null}
        </p>
      ) : null}
      {unadmitted.length ? (
        <p className="flex items-start gap-1.5 text-stone-400" data-testid="table-scope-unadmitted">
          <Info className="mt-0.5 size-3.5 shrink-0 text-sky-300/70" aria-hidden="true" />
          <span>
            {t("builder.scope.unadmitted", { count: unadmitted.length, list: unadmitted.join(", ") })}
          </span>
        </p>
      ) : null}
    </div>
  );
}
