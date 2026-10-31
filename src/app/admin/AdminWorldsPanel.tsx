"use client";

import { Download, Loader2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { appConfirm } from "@/components/ui/ConfirmDialog";
import { SectionHead } from "@/components/ui/SectionHead";
import { UnofficialPackNotice } from "@/components/UnofficialPackNotice";
import { filterPlugins, genresOf, isFiltering, NO_PLUGIN_FILTER, type PluginFilter } from "@/lib/worlds/plugin-filter";
import type { RegistryBundle, RegistryEntry, WorldPackSummary } from "@/lib/worlds/types";
import { forgetPackArt } from "@/lib/worlds/use-pack-art";
import { AvailablePluginCard, InstalledPluginRow } from "./PluginCards";
import { PluginFilterBar } from "./PluginFilterBar";
import { PluginThumb } from "./PluginThumb";
import { useT } from "@/lib/locale";

// The campaign plugin browser.
//
// World packs are the app's plugin format: a single JSON manifest that renames
// the SRD's races, classes, spells, items and monsters into some other setting
// and tells the DM how that setting sounds. It changes no rules.
//
// Packs built on somebody else's universe are NOT shipped with this app and
// are not covered by its MIT license. No registry is built in: they are
// downloaded from whatever registry the operator configured, or added by hand
// from a file, and they carry an explicit non-affiliation notice wherever
// they appear.
//
// The guide on the project site walks through making one in the workshop's
// Plugin tool, from a world built in WorldForge, or by hand.
const PLUGIN_GUIDE_URL = "https://opengamemaster.com/guide/dm/make-a-campaign-plugin/";
// The same ceiling as MAX_MANIFEST_BYTES in src/lib/worlds/install.ts, which
// this client component cannot import: a pack with its thumbnails aboard is a
// few megabytes, and anything near this is not one.
const MAX_UPLOAD_BYTES = 16 * 1024 * 1024;

type RegistryState = {
  configured: boolean;
  url?: string;
  error?: string;
  packs: RegistryEntry[];
  bundles?: RegistryBundle[];
  installed: WorldPackSummary[];
};

export function AdminWorldsPanel() {
  const t = useT();
  const [state, setState] = useState<RegistryState | null>(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<PluginFilter>(NO_PLUGIN_FILTER);
  const fileInput = useRef<HTMLInputElement>(null);
  // Uncontrolled, seeded from whatever registry is in force and re-keyed when
  // that changes, so an admin edits the live value rather than typing over a
  // blank box. Same shape as the custom-genre textarea in GameSettingsPanel.
  const registryInput = useRef<HTMLInputElement>(null);

  // Reload after an install, a removal, or a registry change. Only ever called
  // from an event handler; the first load is the effect below, which fetches
  // inline and sets state from the callback the way the other panels do.
  const load = useCallback(async () => {
    const response = await fetch("/api/worlds/registry");
    setState(
      response.ok ? await response.json() : { configured: false, packs: [], installed: [] },
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/worlds/registry")
      .then((response) =>
        response.ok ? response.json() : { configured: false, packs: [], installed: [] },
      )
      .then((data) => {
        if (!cancelled) {
          setState(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ configured: false, packs: [], installed: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveRegistry() {
    const next = registryInput.current?.value.trim() ?? "";
    setBusyId("registry");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldRegistryUrl: next }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || t("admin.worlds.saveFailed"));
        return;
      }
      setNotice(next ? t("admin.worlds.saved") : t("admin.worlds.cleared"));
      await load();
    } catch {
      setError(t("admin.worlds.unreachable"));
    } finally {
      setBusyId("");
    }
  }

  async function install(body: Record<string, unknown>, key: string) {
    setBusyId(key);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/worlds/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || t("admin.worlds.installFailed"));
        return;
      }
      setNotice(
        data.replaced
          ? t("admin.worlds.updated", { name: data.pack.name })
          : t("admin.worlds.installed", { name: data.pack.name }),
      );
      forgetPackArt(data.pack?.id);
      await load();
    } catch {
      setError(t("admin.worlds.unreachable"));
    } finally {
      setBusyId("");
    }
  }

  // A prepared world (docs/vtt-parity-implementation-plan.md 12.3) lands as
  // a workshop of the installing admin's own.
  async function installBundle(bundle: RegistryBundle) {
    setBusyId(`bundle:${bundle.id}`);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/worlds/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleId: bundle.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || t("admin.worlds.installFailed"));
        return;
      }
      setNotice(t("admin.worlds.bundleInstalled", { name: bundle.name, count: data.copied }));
    } catch {
      setError(t("admin.worlds.unreachable"));
    } finally {
      setBusyId("");
    }
  }

  async function remove(pack: WorldPackSummary) {
    const sure = await appConfirm(t("admin.worlds.removeConfirm", { name: pack.name }), {
      title: t("admin.worlds.removeTitle"),
      actionLabel: t("action.remove"),
      tone: "danger",
    });
    if (!sure) return;
    setBusyId(pack.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/worlds/${encodeURIComponent(pack.id)}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || t("admin.worlds.installFailed"));
        return;
      }
      setNotice(t("admin.worlds.removed", { name: pack.name }));
      forgetPackArt(pack.id);
      await load();
    } catch {
      setError(t("admin.worlds.unreachable"));
    } finally {
      setBusyId("");
    }
  }

  async function onFile(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t("admin.worlds.tooBig"));
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setError(t("admin.worlds.notJson"));
      return;
    }
    await install({ pack: parsed }, "upload");
  }

  // An installed pack lives in the "Installed" section below (with its own
  // update control), so it is kept out of the download list rather than
  // showing a second, redundant tile for it there. One filter narrows both.
  const lists = useMemo(() => {
    const installed = state?.installed ?? [];
    const installedIds = new Set(installed.map((pack) => pack.id));
    const available = (state?.packs ?? []).filter((entry) => !installedIds.has(entry.id));
    return {
      available,
      shownAvailable: filterPlugins(available, filter),
      shownInstalled: filterPlugins(installed, filter),
      genres: genresOf([...available, ...installed]),
    };
  }, [state, filter]);

  if (!state) {
    return <PageSkeleton kind="flat" className="px-0 py-2" />;
  }

  const registryById = new Map(state.packs.map((entry) => [entry.id, entry]));
  const { available, shownAvailable, shownInstalled, genres } = lists;
  const filtering = isFiltering(filter);
  // A filter row over a list of one is clutter; it appears once there is a
  // choice to narrow.
  const showFilter = available.length + state.installed.length > 1;
  const clearFilter = (
    <button type="button" onClick={() => setFilter(NO_PLUGIN_FILTER)} className={cn(ui.btnSmall, "text-xs")}>
      {t("admin.worlds.clearFilter")}
    </button>
  );

  return (
    <div className="space-y-4 text-sm">
      <section className={cn(ui.card, "ornate texture-noise p-5")}>
        <SectionHead level="h2" title={t("admin.worlds.heading")} glyph="system-plugin" />
        <p className="text-xs leading-5 text-stone-400">
          {t("admin.worlds.intro")}
        </p>
        <p className="mt-2 text-xs leading-5 text-stone-500">
          {t("admin.worlds.disclaimer")}
        </p>
        <p className="mt-2 text-xs leading-5 text-stone-400">
          {t("admin.worlds.makeOwn")}{" "}
          <a
            href={PLUGIN_GUIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-200 underline decoration-amber-500/40 underline-offset-2 hover:text-amber-400"
          >
            {t("admin.worlds.makeOwn.link")}
          </a>
          {t("admin.worlds.makeOwn.tail")}
        </p>
      </section>

      {error ? <p role="alert" className="motion-shake text-xs text-red-400">{error}</p> : null}
      {notice ? <p role="status" className="live-in text-xs text-amber-200">{notice}</p> : null}

      {state.bundles?.length ? (
        <section className={cn(ui.card, "texture-noise p-5")}>
          <SectionHead title={t("admin.worlds.bundles")} glyph="system-region" aside={<span className="tabular-nums">{state.bundles.length}</span>} />
          <p className="mb-2 text-[11px] text-stone-500">
            {t("admin.worlds.bundlesIntro")}
          </p>
          <ul className="stagger-up grid gap-2 sm:grid-cols-2">
            {state.bundles.map((bundle) => (
              <li key={bundle.id} className="plate-row" data-layout="stack">
                <PluginThumb src={bundle.thumbnail} seed={bundle.id} className="w-full" />
                <p className="font-display text-sm text-amber-100">{bundle.name}</p>
                <p className="text-[11px] leading-4 text-stone-400">{bundle.blurb}</p>
                <p className="text-[10px] text-stone-500">
                  {bundle.author ? t("admin.worlds.by", { name: bundle.author }) : t("admin.worlds.community")}
                  {bundle.version ? `, v${bundle.version}` : ""}
                </p>
                {bundle.inspiredBy ? <UnofficialPackNotice inspiredBy={bundle.inspiredBy} rightsHolder={bundle.rightsHolder} /> : null}
                <button
                  type="button"
                  disabled={busyId === `bundle:${bundle.id}`}
                  onClick={() => void installBundle(bundle)}
                  className={cn(ui.btnSmall, "text-xs")}
                >
                  {busyId === `bundle:${bundle.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                  {t("admin.worlds.installBundle")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={cn(ui.card, "texture-noise p-5")}>
        <SectionHead title={t("admin.worlds.fromFile")} glyph="tab-handout" />
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Reset first, so picking the same file twice still fires.
            event.target.value = "";
            if (file) {
              void onFile(file);
            }
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busyId === "upload"}
          className={cn(ui.btnSmall, "text-xs")}
        >
          {busyId === "upload" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {t("admin.worlds.chooseFile")}
        </button>
        <p className="mt-1 text-[11px] text-stone-500">
          {t("admin.worlds.fromFileNote")}
        </p>
      </section>

      <section className={cn(ui.card, "texture-noise p-5")}>
        <SectionHead title={t("admin.worlds.registry")} glyph="tab-facts" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            key={state.url ?? ""}
            ref={registryInput}
            defaultValue={state.url ?? ""}
            placeholder="https://example.org/worlds/index.json"
            aria-label={t("admin.worlds.registryAria")}
            className={cn(ui.input, "min-w-0 flex-1 text-xs")}
          />
          <button
            type="button"
            onClick={saveRegistry}
            disabled={busyId === "registry"}
            className={cn(ui.btnSmall, "text-xs")}
          >
            {busyId === "registry" ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {t("admin.worlds.save")}
          </button>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-stone-500">
          {t("admin.worlds.registryNote.a")}
          <span className="font-mono"> WORLD_REGISTRY_URL </span>
          {t("admin.worlds.registryNote.b")}
          <span className="font-mono"> off </span>
          {t("admin.worlds.registryNote.c")}
        </p>
      </section>

      {showFilter ? (
        <section className={cn(ui.card, "texture-noise p-3")}>
          <PluginFilterBar filter={filter} onChange={setFilter} genres={genres} />
        </section>
      ) : null}

      <section className={cn(ui.card, "texture-noise p-5")}>
        <SectionHead
          title={t("admin.worlds.available")}
          glyph="system-share"
          aside={
            available.length ? (
              <span className="tabular-nums">
                {filtering ? `${shownAvailable.length} of ${available.length}` : available.length}
              </span>
            ) : undefined
          }
        />
        {!state.configured ? (
          <EmptyState
            art="scrolls"
            size="sm"
            title={t("admin.worlds.noRegistry")}
            hint={t("admin.worlds.noRegistryHint")}
          />
        ) : state.error ? (
          <p role="alert" className="motion-shake rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {state.error}
          </p>
        ) : !state.packs.length ? (
          <EmptyState art="scrolls" size="sm" title={t("admin.worlds.noPacks")} />
        ) : !available.length ? (
          <EmptyState art="chest" size="sm" title={t("admin.worlds.allInstalled")} />
        ) : !shownAvailable.length ? (
          <EmptyState art="scrolls" size="sm" title={t("admin.worlds.filterNone")} action={clearFilter} />
        ) : (
          <ul className="stagger grid gap-3 sm:grid-cols-2">
            {shownAvailable.map((entry) => (
              <AvailablePluginCard
                key={entry.id}
                entry={entry}
                busy={busyId === entry.id}
                onInstall={() => install({ packId: entry.id }, entry.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className={cn(ui.card, "texture-noise p-5")}>
        <SectionHead
          title={t("admin.worlds.installedHeading")}
          glyph="system-homebrew"
          aside={
            <span className="tabular-nums">
              {filtering ? `${shownInstalled.length} of ${state.installed.length}` : state.installed.length}
            </span>
          }
        />
        {!state.installed.length ? (
          <EmptyState art="map" size="sm" title={t("admin.worlds.noneYet")} />
        ) : !shownInstalled.length ? (
          <EmptyState art="map" size="sm" title={t("admin.worlds.filterNoneInstalled")} action={clearFilter} />
        ) : (
          <ul className="stagger space-y-2">
            {shownInstalled.map((pack) => (
              <InstalledPluginRow
                key={pack.id}
                pack={pack}
                update={registryById.get(pack.id)}
                busy={busyId === pack.id}
                onUpdate={() => install({ packId: pack.id }, pack.id)}
                onRemove={() => remove(pack)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
