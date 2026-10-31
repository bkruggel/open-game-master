"use client";

import { Download, GitBranch, Loader2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminAddonCard } from "@/app/admin/AdminAddonCard";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { appConfirm } from "@/components/ui/ConfirmDialog";
import { SectionHead } from "@/components/ui/SectionHead";
import { Switch } from "@/components/ui/Switch";
import type { AdminAddonsState, CatalogAddon } from "@/lib/addons/admin-view";
import { platformName } from "@/lib/addons/manifest";
import { sourceFacts } from "@/lib/addons/registry-index";
import { forgetAddons } from "@/lib/addons/use-addons";
import { cn } from "@/lib/cn";
import { ui } from "@/lib/ui";
import { useT } from "@/lib/locale";
import type { MessageKey } from "@/lib/messages/en";

// Admin > Addons: the downloader list (addons/catalog.json in the Open
// Dungeon Master repository, audited entry by entry), the addons this
// server has, and the two server-wide switches (which catalog, and whether a
// .zip or a GitHub link from anywhere may be installed). docs/addons.md is
// the operator's guide to all of it.

const MAX_FILE_BYTES = 64 * 1024 * 1024;

const CATEGORY_KEYS: Record<CatalogAddon["category"], MessageKey> = {
  maps: "admin.addons.category.maps",
  content: "admin.addons.category.content",
  table: "admin.addons.category.table",
  tools: "admin.addons.category.tools",
};

const KIND_KEYS: Record<string, MessageKey> = {
  workshopImporters: "admin.addons.kind.workshopImporters",
  mapGenerators: "admin.addons.kind.mapGenerators",
  boardViews: "admin.addons.kind.boardViews",
};

export function AdminAddonsPanel() {
  const t = useT();
  const [state, setState] = useState<AdminAddonsState | null>(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const registryInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [githubLink, setGithubLink] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/addons").catch(() => null);
    if (response?.ok) setState(await response.json());
    else setError(t("admin.addons.readFailed"));
  }, []);

  useEffect(() => {
    let live = true;
    fetch("/api/admin/addons")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (live) setState(data);
      })
      .catch(() => {
        if (live) setError(t("admin.addons.readFailed"));
      });
    return () => {
      live = false;
    };
  }, []);

  const changed = useCallback(
    async (message: string) => {
      setNotice(message);
      setError("");
      await load();
    },
    [load],
  );

  // An install over a copy of the same id from somewhere else (the
  // catalog's, a fork on GitHub, a file) waits for a yes, then goes again.
  async function confirmReplace(data: { replaces?: { name: string; from: string } | null }): Promise<boolean> {
    if (!data.replaces) return false;
    return appConfirm(
      t("admin.addons.replaceConfirm", { name: data.replaces.name, from: data.replaces.from }),
      { title: t("admin.addons.replaceTitle"), actionLabel: t("admin.addons.replaceAction"), tone: "plain" },
    );
  }

  async function post(body: Record<string, unknown>, key: string) {
    setBusyId(key);
    setError("");
    setNotice("");
    try {
      let response = await fetch("/api/admin/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let data = await response.json().catch(() => ({}));
      if (response.status === 409 && (await confirmReplace(data))) {
        response = await fetch("/api/admin/addons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, replace: true }),
        });
        data = await response.json().catch(() => ({}));
      }
      if (!response.ok) {
        setError(data.replaces ? t("admin.addons.nothingReplaced") : data.error || t("admin.addons.fail"));
        return null;
      }
      return data;
    } catch {
      setError(t("admin.addons.unreachable"));
      return null;
    } finally {
      setBusyId("");
    }
  }

  function installedNotice(data: { installed: { name: string; version: string }; updated: boolean; newPermissions?: string[]; setupTask?: string }, from = "") {
    const asks = data.newPermissions?.length ? t("admin.addons.permissionsNote") : "";
    const setup = data.setupTask ? t("admin.addons.setupStarted") : "";
    return data.updated
      ? t("admin.addons.updated", { name: data.installed.name, version: data.installed.version, from, setup, asks })
      : t("admin.addons.installedNotice", { name: data.installed.name, from, asks });
  }

  async function install(addonId: string) {
    const data = await post({ do: "install", addonId }, `install:${addonId}`);
    if (!data) return;
    forgetAddons();
    await changed(installedNotice(data));
  }

  async function installFromGitHub() {
    const url = githubLink.trim();
    if (!url) return;
    const data = await post({ do: "install-github", url }, "github");
    if (!data) return;
    setGithubLink("");
    forgetAddons();
    await changed(`${installedNotice(data, data.from ? ` (${data.from})` : "")}${t("admin.addons.githubUnreviewed")}`);
  }

  async function saveConfig(patch: { registryUrl?: string; allowFiles?: boolean }) {
    const data = await post({ do: "config", ...patch }, "config");
    if (data) {
      setState(data);
      setNotice(
        patch.allowFiles !== undefined
          ? patch.allowFiles
            ? t("admin.addons.filesOn")
            : t("admin.addons.filesOff")
          : t("admin.addons.catalogSaved"),
      );
    }
  }

  async function onFile(file: File) {
    if (file.size >= MAX_FILE_BYTES) {
      setError(t("admin.addons.fileTooBig"));
      return;
    }
    setBusyId("upload");
    setError("");
    setNotice("");
    try {
      const send = (replace: boolean) =>
        fetch(`/api/admin/addons/upload${replace ? "?replace=1" : ""}`, {
          method: "POST",
          headers: { "Content-Type": "application/zip" },
          body: file,
        });
      let response = await send(false);
      let data = await response.json().catch(() => ({}));
      if (response.status === 409 && (await confirmReplace(data))) {
        response = await send(true);
        data = await response.json().catch(() => ({}));
      }
      if (!response.ok) {
        setError(data.replaces ? t("admin.addons.nothingReplaced") : data.error || t("admin.addons.fail"));
        return;
      }
      forgetAddons();
      await changed(data.updated
        ? t("admin.addons.fromFile.updated", { name: data.installed.name, file: file.name })
        : t("admin.addons.fromFile.installed", { name: data.installed.name, file: file.name }));
    } catch {
      setError(t("admin.addons.unreachable"));
    } finally {
      setBusyId("");
    }
  }

  if (!state) {
    return error ? <p role="alert" className="text-xs text-red-400">{error}</p> : <PageSkeleton kind="flat" className="px-0 py-2" />;
  }

  const available = state.catalog.addons.filter((entry) => !entry.installed);
  const categories = [...new Set(available.map((entry) => entry.category))];

  return (
    <div className="space-y-4 text-sm">
      <section className={cn(ui.card, "ornate texture-noise p-5")}>
        <SectionHead level="h2" title={t("admin.addons.heading")} glyph="system-plugin" />
        <p className="text-xs leading-5 text-stone-400">
          {t("admin.addons.intro")}
        </p>
        <p className="mt-2 text-xs leading-5 text-stone-500">
          {t("admin.addons.auditNote")}
        </p>
        {!state.support.supported ? (
          <p role="status" className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            {state.support.reason}
          </p>
        ) : state.support.note ? (
          <p className="mt-2 text-[11px] leading-4 text-amber-200/80">{state.support.note}</p>
        ) : null}
      </section>

      {error ? <p role="alert" className="motion-shake text-xs text-red-400">{error}</p> : null}
      {notice ? <p role="status" className="live-in text-xs text-amber-200">{notice}</p> : null}

      <section className={cn(ui.card, "texture-noise p-5")}>
        <SectionHead title={t("admin.worlds.installedHeading")} glyph="system-homebrew" aside={<span className="tabular-nums">{state.installed.length}</span>} />
        {!state.installed.length ? (
          <EmptyState art="chest" size="sm" title={t("admin.addons.noneYet")} hint={t("admin.addons.noneYetHint")} />
        ) : (
          <ul className="stagger space-y-2">
            {state.installed.map((addon) => (
              <AdminAddonCard
                key={`${addon.id}:${addon.version}`}
                addon={addon}
                permissions={state.permissions}
                onChanged={changed}
                onInstall={(id) => void install(id)}
                busy={busyId === `install:${addon.id}`}
              />
            ))}
          </ul>
        )}
      </section>

      <section className={cn(ui.card, "texture-noise p-5")}>
        <SectionHead
          title={t("admin.addons.available")}
          glyph="system-share"
          aside={available.length ? <span className="tabular-nums">{available.length}</span> : undefined}
        />
        {!state.support.supported ? (
          <EmptyState art="scrolls" size="sm" title={t("admin.addons.unsupported")} />
        ) : !state.catalog.url ? (
          <EmptyState art="scrolls" size="sm" title={t("admin.addons.listOff")} hint={t("admin.addons.listOffHint")} />
        ) : state.catalog.error ? (
          <p role="alert" className="motion-shake rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {state.catalog.error}
          </p>
        ) : !available.length ? (
          <EmptyState
            art="chest"
            size="sm"
            title={state.catalog.addons.length ? t("admin.addons.allInstalled") : t("admin.addons.catalogEmpty")}
          />
        ) : (
          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category}>
                <p className={cn(ui.sectionEyebrow, "mb-2")}>{t(CATEGORY_KEYS[category])}</p>
                <ul className="stagger grid gap-2 sm:grid-cols-2">
                  {available
                    .filter((entry) => entry.category === category)
                    .map((entry) => (
                      <CatalogEntry
                        key={entry.id}
                        entry={entry}
                        permissions={state.permissions}
                        busy={busyId === `install:${entry.id}`}
                        onInstall={() => void install(entry.id)}
                      />
                    ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {state.catalog.bundled ? (
          <p className="mt-2 text-[11px] leading-4 text-stone-500">
            {t("admin.addons.bundledListNote")}
          </p>
        ) : null}
        {state.catalog.skipped ? (
          <p className="mt-2 text-[11px] text-stone-500">
            {t("admin.addons.skipped", { count: state.catalog.skipped })}
          </p>
        ) : null}
      </section>

      <section className={cn(ui.card, "texture-noise p-5")}>
        <SectionHead title={t("admin.addons.sources")} glyph="tab-facts" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            key={state.config.registryUrl}
            ref={registryInput}
            defaultValue={state.config.registryUrl}
            placeholder={t("admin.addons.listPlaceholder")}
            aria-label={t("admin.addons.listAria")}
            className={cn(ui.input, "min-w-0 flex-1 text-xs")}
          />
          <button
            type="button"
            onClick={() => void saveConfig({ registryUrl: registryInput.current?.value.trim() ?? "" })}
            disabled={busyId === "config"}
            className={cn(ui.btnSmall, "text-xs")}
          >
            {busyId === "config" ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {t("admin.worlds.save")}
          </button>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-stone-500">
          {t("admin.addons.listNote.a")}
          <span className="font-mono">ADDON_REGISTRY_URL</span>
          {t("admin.addons.listNote.b")}
          <span className="font-mono">off</span>.
          {state.catalog.url ? <span className="block break-all font-mono">Reading: {state.catalog.url}</span> : null}
        </p>

        <div className="mt-4 flex items-start justify-between gap-3">
          <span className="min-w-0 text-xs text-stone-300">
            {t("admin.addons.filesHeading")}
            <span className="block text-[11px] leading-4 text-stone-500">
              {t("admin.addons.filesNote")}
            </span>
          </span>
          <Switch
            on={state.config.allowFiles}
            onChange={(next) => void saveConfig({ allowFiles: next })}
            label={t("admin.addons.filesHeading")}
            disabled={busyId === "config"}
          />
        </div>
        {state.config.allowFiles ? (
          <div className="reveal mt-3">
            <input
              ref={fileInput}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void onFile(file);
              }}
            />
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void installFromGitHub();
              }}
            >
              <input
                value={githubLink}
                onChange={(event) => setGithubLink(event.target.value)}
                placeholder={t("admin.addons.githubPlaceholder")}
                aria-label={t("admin.addons.githubAria")}
                className={cn(ui.input, "min-w-0 flex-1 text-xs")}
              />
              <button
                type="submit"
                disabled={busyId === "github" || !githubLink.trim() || !state.support.supported}
                className={cn(ui.btnSmall, "text-xs")}
              >
                {busyId === "github" ? <Loader2 className="size-3.5 animate-spin" /> : <GitBranch className="size-3.5" />}
                {t("admin.addons.githubInstall")}
              </button>
            </form>
            <p className="mt-1 text-[11px] leading-4 text-stone-500">
              {t("admin.addons.githubNote")}
            </p>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busyId === "upload" || !state.support.supported}
              className={cn(ui.btnSmall, "mt-3 text-xs")}
            >
              {busyId === "upload" ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {t("admin.addons.chooseZip")}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function CatalogEntry({
  entry,
  permissions,
  busy,
  onInstall,
}: {
  entry: CatalogAddon;
  permissions: AdminAddonsState["permissions"];
  busy: boolean;
  onInstall: () => void;
}) {
  const t = useT();
  const adds = Object.entries(entry.contributes)
    .filter(([, titles]) => titles.length)
    .map(([kind, titles]) => `${KIND_KEYS[kind] ? t(KIND_KEYS[kind]) : kind}: ${titles.join(", ")}`);
  const source = sourceFacts(entry.source);
  return (
    <li className="plate-row" data-layout="stack">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-sm text-amber-100">{entry.name}</span>
        <span className="text-[11px] text-stone-500">v{entry.version}</span>
      </div>
      <p className="text-[11px] text-stone-500">
        {entry.author ? `by ${entry.author}` : null}
        {entry.author && source ? " · " : null}
        {source ? (
          <a href={source.url} target="_blank" rel="noreferrer" className="text-amber-200/80 hover:text-amber-200" title={t("admin.addons.reviewedAt", { repo: source.repo })}>
            {t("admin.addons.onGithub", { owner: source.owner })}
          </a>
        ) : null}
      </p>
      <p className="mt-1 text-xs text-stone-400">{entry.description}</p>
      {adds.length ? <p className="mt-1 text-[11px] text-stone-400">{adds.join(" · ")}</p> : null}
      {entry.needs.length ? <p className="mt-1 text-[11px] text-stone-500">{t("admin.addons.needs", { list: entry.needs.join(", ") })}</p> : null}
      {entry.permissions.length ? (
        <p className="mt-1 text-[11px] text-stone-500">
          {t("admin.addons.asksTo", { list: entry.permissions.map((permission) => permissions[permission]?.label ?? permission).join("; ") })}
        </p>
      ) : null}
      {entry.platforms ? <p className="mt-1 text-[11px] text-stone-500">{t("admin.addons.runsOn", { list: entry.platforms.map(platformName).join(", ") })}</p> : null}
      {entry.exclusive.length ? (
        <p className="mt-1 text-[11px] text-stone-500">{t("admin.addons.exclusive", { list: entry.exclusive.join(", ") })}</p>
      ) : null}
      {entry.clashes.map((clash) => (
        <p key={clash.name} className="mt-1 text-[11px] text-amber-300/90">
          {t("admin.addons.clash", { name: clash.name, reason: clash.reason })}
        </p>
      ))}
      {!entry.fit.ok ? <p className="mt-1 text-[11px] text-amber-300/90">{entry.fit.reason}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onInstall} disabled={busy || !entry.fit.ok} className={cn(ui.btnSmall, "text-xs")}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          {t("admin.addons.install")}
        </button>
        <span className="text-[10px] text-stone-500">
          {Math.max(1, Math.round(entry.bytes / 1024 / 1024))} MB
          {entry.setupMB
            ? t("admin.addons.setupSize", { size: entry.setupMB >= 1024 ? `${(entry.setupMB / 1024).toFixed(1)} GB` : `${entry.setupMB} MB` })
            : ""}
        </span>
        {entry.homepage && !source ? (
          <a href={entry.homepage} target="_blank" rel="noreferrer" className="text-[11px] text-amber-200/80 hover:text-amber-200">
            {t("admin.addons.source")}
          </a>
        ) : null}
      </div>
    </li>
  );
}
