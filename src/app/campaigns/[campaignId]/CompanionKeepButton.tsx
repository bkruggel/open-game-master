"use client";

import { useState } from "react";
import { BookmarkPlus } from "lucide-react";
import type { CharacterSheet } from "@/lib/schemas/sheet";
import { useT } from "@/lib/locale";
import { KitButton } from "./PanelKit";

// "Save to my characters" on a lasting companion's card, for whoever runs
// the story (src/lib/characters/keep-companion.ts): a companion the GM wrote
// in is kept in their library, ready for "Bring to a campaign"; one already
// kept there has its level, gear and spells written back. The button says
// which happened, for a moment, as the player's own "Save to library" does.
export function CompanionKeepButton({ campaignId, sheet }: { campaignId: string; sheet: CharacterSheet }) {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [said, setSaid] = useState("");
  const [error, setError] = useState("");
  const t = useT();

  async function keep() {
    setState("saving");
    setError("");
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/companions/${sheet.id}/keep`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as { how?: string; keptLevel?: number | null; error?: string };
      if (!response.ok) {
        setError(data.error ?? t("table.companion.saveFailed"));
        setState("idle");
        return;
      }
      setSaid(
        data.how === "saved"
          ? typeof data.keptLevel === "number"
            ? t("table.companion.savedLevel", { level: data.keptLevel })
            : t("table.companion.savedAll")
          : t("table.companion.alreadyThere", { name: sheet.name }),
      );
      setState("done");
      setTimeout(() => {
        setState("idle");
        setSaid("");
      }, 4_000);
    } catch {
      setError(t("table.unreachable"));
      setState("idle");
    }
  }

  return (
    <div className="space-y-1">
      <KitButton
        onClick={keep}
        disabled={state === "saving"}
        busy={state === "saving"}
        title={t("table.companion.saveTitle", { name: sheet.name })}
        className="w-full justify-center"
      >
        {state === "saving" ? null : <BookmarkPlus className="size-3.5" aria-hidden="true" />}
        {t("table.companion.save")}
      </KitButton>
      {said ? (
        <p role="status" className="text-xs text-emerald-300">
          {said}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
