"use client";

import { Check, Link2, Loader2, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { PIXEL_ICONS, UserAvatar, ui } from "@/lib/ui";
import { localeTag } from "@/lib/messages-logic";
import { useLocale, useT } from "@/lib/locale";
import { DiceLookSummary } from "@/components/DiceLookEditor";
import { PageLoading, PageNotice, PageSection, PageShell } from "@/components/PageShell";
import { GameIcon } from "@/components/ui/GameIcon";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { DeleteAccountDialog } from "@/app/settings/DeleteAccountDialog";
import { AvatarCropDialog } from "@/app/settings/AvatarCropDialog";
import { AppearanceSection } from "@/app/settings/AppearanceSection";
import { LanguageSection } from "@/app/settings/LanguageSection";
import { DictationShortcutSection } from "@/app/settings/DictationShortcutSection";
import { BlockedPlayersSection } from "@/app/settings/BlockedPlayersSection";
import { ConnectedAgentsSection } from "@/app/settings/ConnectedAgentsSection";
import { ChangePasswordForm } from "@/app/ChangePasswordForm";
import { currentPathname, currentQuery, replaceAddress } from "@/lib/navigation";

type Me = {
  id: string;
  username: string;
  avatar: { url: string } | null;
  isAdmin?: boolean;
  discordLinked?: boolean;
  discordAvailable?: boolean;
  hasPassword?: boolean;
  deletionDueAt?: string | null;
};

function dueDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(localeTag(locale as "en" | "fr"), {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Account settings: profile picture, password, Discord link, deletion, and
// the About card naming the server.
export default function SettingsPage() {
  const t = useT();
  const locale = useLocale();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [cropping, setCropping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  // Set once the server has accepted the request: this session is over, so
  // the page turns into the farewell note instead of re-fetching anything.
  const [scheduled, setScheduled] = useState<{ dueAt: string; purged: boolean } | null>(null);
  const [keeping, setKeeping] = useState(false);
  // Server identity for the About section, from the same public endpoint
  // the login form and client apps read. graceDays feeds the deletion copy.
  const [about, setAbout] = useState<{
    serverName: string;
    version: string;
    graceDays: number;
  } | null>(null);
  // A world one of the apps hosts: guests never chose a password (the app
  // minted one and renews their session with it), so offering to change it
  // would lock them out of their own seat. The host keeps the option.
  const [deviceWorld, setDeviceWorld] = useState(false);
  // Seeded from the Discord link redirect (?linked=1 / ?error=...). The raw
  // outcome is kept, not the words, so the note follows a language switch.
  const [discordNotice] = useState<"linked" | "taken" | null>(() => {
    if (typeof window === "undefined") return null;
    const query = currentQuery();
    if (query.get("linked") === "1") return "linked";
    if (query.get("error") === "discord_taken") return "taken";
    return null;
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setMe(data?.user ?? null))
      .finally(() => setLoading(false));
    fetch("/api/auth/providers")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        setDeviceWorld(data?.deviceWorld === true);
        if (data?.serverName && data?.version) {
          setAbout({
            serverName: data.serverName,
            version: data.version,
            graceDays:
              typeof data.accountDeletionGraceDays === "number" ? data.accountDeletionGraceDays : 14,
          });
        }
      })
      .catch(() => undefined);
    const query = currentQuery();
    if (query.get("linked") || query.get("error")) {
      replaceAddress(currentPathname());
    }
  }, []);

  async function setAvatar(avatar: { url: string } | null) {
    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar }),
      });
      if (response.ok && me) {
        setMe({ ...me, avatar });
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    if (!me) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(me.hasPassword ? { password: deleteConfirm } : {}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setDeleteError(data.error || t("settings.deletion.confirmError"));
        setDeleting(false);
        return;
      }
      setConfirmingDelete(false);
      setScheduled({ dueAt: data.dueAt, purged: data.purged === true });
    } catch {
      setDeleteError(t("settings.deletion.confirmError"));
      setDeleting(false);
    }
  }

  async function keepAccount() {
    setKeeping(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepAccount: true }),
      });
      if (response.ok) {
        setMe((current) => (current ? { ...current, deletionDueAt: null } : current));
      }
    } finally {
      setKeeping(false);
    }
  }

  function flashPasswordSaved() {
    setPasswordChanged(true);
    setTimeout(() => setPasswordChanged(false), 2500);
  }

  // The confirm button unlocks on the right password, or on typing DELETE for
  // Discord-only accounts that have no password.
  const deleteReady = me?.hasPassword ? deleteConfirm.length > 0 : deleteConfirm === "DELETE";
  const graceDays = about?.graceDays ?? 14;
  const graceCopy =
    graceDays === 0
      ? t("settings.deletion.graceImmediate")
      : t("settings.deletion.graceCopy", { count: graceDays });

  if (loading) {
    return <PageLoading width="narrow" />;
  }

  if (scheduled) {
    return (
      <PageNotice width="narrow">
        {scheduled.purged
          ? t("settings.deletion.purged")
          : t("settings.deletion.scheduledNotice", { date: dueDate(scheduled.dueAt, locale) })}
        <Link href="/" className="text-amber-200 hover:text-amber-400">
          {t("settings.deletion.back")}
        </Link>
      </PageNotice>
    );
  }

  if (!me) {
    return (
      <PageNotice width="narrow">
        <Link href="/" className="text-amber-200 hover:text-amber-400">
          {t("settings.deletion.logInFirst")}
        </Link>{" "}
        {t("settings.deletion.logInToManage")}
      </PageNotice>
    );
  }

  return (
    <PageShell
      user={me}
      width="narrow"
      icon={PIXEL_ICONS.characters}
      glyph="tab-settings"
      title={t("settings.title")}
      blurb={t("settings.signedInAs", { name: me.username })}
      actions={
        me.isAdmin ? (
          <Link href="/admin" className={ui.btnSecondary}>
            <GameIcon icon={{ kind: "glyph", key: "tab-admin" }} size="size-6" /> {t("settings.adminPanel")}
          </Link>
        ) : null
      }
    >
      {/* The page's parts, one tap away, with who each one belongs to: an
          account setting follows you to any device, a device one stays here. */}
      <nav aria-label={t("settings.title")} className="contents-rail panel">
        {[
          { id: "settings-profile", label: t("settings.nav.profile"), glyph: "tab-characters" },
          { id: "settings-dice", label: t("settings.nav.dice"), glyph: "die-d20" },
          ...(deviceWorld && !me.isAdmin ? [] : [{ id: "settings-signin", label: t("settings.nav.signin"), glyph: "tab-admin" }]),
          { id: "settings-appearance", label: t("settings.nav.appearance"), glyph: "tab-settings" },
          { id: "settings-language", label: t("settings.nav.language"), glyph: "system-lore" },
          { id: "settings-dictation", label: t("settings.nav.dictation"), glyph: "ui-speech" },
          { id: "settings-blocked", label: t("settings.nav.blocked"), glyph: "ui-lock" },
          { id: "settings-agents", label: t("settings.nav.agents"), glyph: "ui-agent" },
          { id: "settings-account", label: t("settings.nav.account"), glyph: "quest-failed" },
        ].map((stop) => (
          <button
            key={stop.id}
            type="button"
            onClick={() => {
              const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              document.getElementById(stop.id)?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
            }}
            className="motion-press"
          >
            <GameIcon icon={{ kind: "glyph", key: stop.glyph }} size="size-7" /> {stop.label}
          </button>
        ))}
      </nav>

      <PageSection id="settings-profile" heading={t("settings.profile.title")} glyph="tab-characters">
        <div className="flex items-center gap-5">
          <span className="medallion">
            {me.avatar ? (
              <ImageLightbox
                src={me.avatar.url}
                alt={t("settings.profile.avatarAlt")}
                caption={t("settings.profile.avatarAlt")}
                className="size-24 rounded-full object-cover"
              />
            ) : (
              // Nobody chose a picture: the sigil this account hashes to, the
              // same one the lobby and the table already show for them.
              <UserAvatar userId={me.id} size="size-24" />
            )}
          </span>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setCropping(true)}
              disabled={saving}
              className={ui.btnPrimary}
            >
              {me.avatar ? t("settings.profile.change") : t("settings.profile.add")}
            </button>
            {me.avatar ? (
              <button
                type="button"
                onClick={() => setAvatar(null)}
                disabled={saving}
                className={cn(ui.btnSmall, "text-xs hover:border-red-500/50 hover:text-red-400")}
              >
                <Trash2 className="size-3.5" /> {t("action.remove")}
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-3 text-xs text-stone-500">
          {t("settings.profile.hint")}
        </p>
      </PageSection>

      <PageSection
        id="settings-dice"
        heading={t("settings.dice.title")}
        glyph="die-d20"
        intro={t("settings.dice.intro")}
      >
        <DiceLookSummary />
      </PageSection>

      {deviceWorld && !me.isAdmin ? null : (
      <PageSection id="settings-signin" heading={me.hasPassword === false ? t("settings.password.setTitle") : t("settings.password.title")} glyph="tab-admin">
        {me.hasPassword === false ? (
          <>
            <p className="mb-3 text-sm text-stone-400">
              {t("settings.password.discordHint")}
            </p>
            {/* lockCurrent hides the current-password field; the server
                skips verification for accounts that have none. */}
            <ChangePasswordForm
              currentPassword=""
              lockCurrent
              submitLabel={t("settings.password.submit")}
              onChanged={() => {
                setMe((current) => (current ? { ...current, hasPassword: true } : current));
                flashPasswordSaved();
              }}
            />
          </>
        ) : (
          <ChangePasswordForm onChanged={flashPasswordSaved} />
        )}
        {passwordChanged ? (
          <p className="reveal mt-2 inline-flex items-center gap-1 text-sm text-emerald-400">
            <Check className="size-4" /> {t("settings.password.saved")}
          </p>
        ) : null}
      </PageSection>
      )}

      {me.discordAvailable || me.discordLinked ? (
        <PageSection heading={t("page.section.discord")} glyph="system-share">
          {me.discordLinked ? (
            <p className="reveal text-sm text-stone-400">
              <Check className="mr-1 inline size-4 text-emerald-400" />
              {t("settings.discord.linked")}
            </p>
          ) : (
            <a href="/api/auth/discord/start?link=1" className={ui.btnSmall}>
              <Link2 className="size-3.5" /> {t("settings.discord.link")}
            </a>
          )}
          {discordNotice ? <p className="live-in mt-2 text-sm text-amber-300">{t(discordNotice === "linked" ? "settings.discord.notice.linked" : "settings.discord.notice.taken")}</p> : null}
        </PageSection>
      ) : null}

      <div id="settings-appearance" className="scroll-mt-16">
        <AppearanceSection />
      </div>
      <div id="settings-language" className="scroll-mt-16">
        <LanguageSection />
      </div>
      <div id="settings-dictation" className="scroll-mt-16">
        <DictationShortcutSection />
      </div>
      <div id="settings-blocked" className="scroll-mt-16">
        <BlockedPlayersSection />
      </div>
      <div id="settings-agents" className="scroll-mt-16">
        <ConnectedAgentsSection />
      </div>
      <span id="settings-account" className="block scroll-mt-16" aria-hidden="true" />

      {me.deletionDueAt ? (
        <PageSection
          heading={t("settings.deletion.scheduledTitle")}
          glyph="quest-failed"
          ribbon={t("settings.deletion.scheduledRibbon")}
          ribbonTone="ember"
          tone="danger"
          intro={t("settings.deletion.scheduledIntro", { date: dueDate(me.deletionDueAt, locale) })}
        >
          <button
            type="button"
            onClick={keepAccount}
            disabled={keeping}
            className={ui.btnPrimary}
          >
            {keeping ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
            {t("settings.deletion.keep")}
          </button>
        </PageSection>
      ) : (
        <PageSection
          heading={t("settings.deletion.title")}
          glyph="quest-failed"
          ribbon={t("settings.deletion.ribbon")}
          ribbonTone="ember"
          tone="danger"
          intro={graceCopy}
        >
          <button
            type="button"
            onClick={() => {
              setDeleteConfirm("");
              setDeleteError("");
              setConfirmingDelete(true);
            }}
            className={cn(ui.btnSmall, "hover:border-red-500/50 hover:text-red-400")}
          >
            <Trash2 className="size-3.5" /> {t("settings.deletion.title")}
          </button>
        </PageSection>
      )}

      <PageSection heading={t("settings.about.title")} glyph="system-lore">
        {about ? (
          <p className="reveal text-sm text-stone-300">
            {about.serverName} <span className="text-stone-500">v{about.version}</span>
          </p>
        ) : (
          <p className="text-sm text-stone-500">Open Game Master</p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/rulebook" className={ui.btnSmall}>
            {t("settings.about.rulebook")}
          </Link>
          <Link href="/reference" className={ui.btnSmall}>
            {t("settings.about.reference")}
          </Link>
          <Link href="/terms" className={ui.btnSmall}>
            {t("settings.about.terms")}
          </Link>
          <Link href="/privacy" className={ui.btnSmall}>
            {t("settings.about.privacy")}
          </Link>
          <Link href="/licenses" className={ui.btnSmall}>
            {t("settings.about.licenses")}
          </Link>
          <a
            href="https://github.com/Lebbitheplow/open-game-master"
            target="_blank"
            rel="noopener noreferrer"
            className={ui.btnSmall}
          >
            GitHub
          </a>
        </div>
      </PageSection>

      {cropping ? (
        <AvatarCropDialog
          title={t("settings.profile.title")}
          onUploaded={(image) => setAvatar({ url: image.url })}
          onClose={() => setCropping(false)}
        />
      ) : null}

      {confirmingDelete ? (
        <DeleteAccountDialog
          hasPassword={Boolean(me.hasPassword)}
          graceCopy={graceCopy}
          graceDays={graceDays}
          value={deleteConfirm}
          onValue={setDeleteConfirm}
          error={deleteError}
          deleting={deleting}
          ready={deleteReady}
          onConfirm={deleteAccount}
          onClose={() => setConfirmingDelete(false)}
        />
      ) : null}
    </PageShell>
  );
}
