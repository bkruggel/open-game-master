"use client";

import { PageSection } from "@/components/PageShell";
import { ui } from "@/lib/ui";
import {
  Field,
  SecretField,
  SelectField,
  type EnvDefaults,
  type MaskedConfig,
  inheritedHint,
} from "@/app/admin/AdminSettingsFields";
import { useT } from "@/lib/locale";
import type { MessageKey } from "@/lib/messages/en";

// The two sections about how the server is reached from outside: live voice
// and Discord sign-in. A world an app hosts owns both itself, so the panel
// leaves this whole file out there.
export function AdminNetworkSections({
  config,
  env,
  setConfig,
  voiceUnroutable,
  discordSecret,
  setDiscordSecret,
}: {
  config: MaskedConfig;
  env: EnvDefaults;
  setConfig: (next: MaskedConfig) => void;
  voiceUnroutable: boolean;
  discordSecret: string;
  setDiscordSecret: (value: string) => void;
}) {
  const t = useT();
  return (
    <>
        <PageSection id="admin-voice" heading={t("admin.voice.heading")} glyph="ui-voice">
          <p className="mb-3 text-xs text-stone-500">
            {t("admin.voice.intro.a")}
            <strong>https</strong>
            {t("admin.voice.intro.b")}
            <strong>{t("admin.voice.intro.port")}</strong>
            {t("admin.voice.intro.c")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label={t("admin.voice.toggle")}
              hint={
                config.voiceChat.enabled === ""
                  ? t("admin.voice.following", { state: env.voiceEnabled ? t("admin.voice.state.on") : t("admin.voice.state.off") })
                  : t("admin.voice.override")
              }
              value={config.voiceChat.enabled}
              onChange={(enabled) => setConfig({ ...config, voiceChat: { ...config.voiceChat, enabled } })}
              options={[
                { value: "", label: t("admin.voice.useConfig", { state: env.voiceEnabled ? t("admin.voice.state.on") : t("admin.voice.state.off") }) },
                { value: "on", label: t("admin.voice.on") },
                { value: "off", label: t("admin.voice.off") },
              ]}
            />
            <SelectField
              label={t("admin.voice.transport")}
              hint={t("admin.voice.transportHint")}
              value={config.voiceChat.mode}
              onChange={(mode) => setConfig({ ...config, voiceChat: { ...config.voiceChat, mode } })}
              options={[
                { value: "", label: t("admin.voice.transport.sfu") },
                { value: "mesh", label: t("admin.voice.transport.mesh") },
              ]}
            />
            <Field
              label={t("admin.voice.mediaPort")}
              hint={t("admin.voice.mediaPortHint", { port: env.voiceRtcPort })}
            >
              <input
                className={ui.input}
                value={config.voiceChat.rtcPort}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    voiceChat: { ...config.voiceChat, rtcPort: event.target.value },
                  })
                }
                placeholder={env.voiceRtcPort}
              />
            </Field>
            <Field
              label={t("admin.voice.announced")}
              hint={t("admin.voice.announcedHint")}
            >
              <input
                className={ui.input}
                value={config.voiceChat.announcedIp}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    voiceChat: { ...config.voiceChat, announcedIp: event.target.value },
                  })
                }
                placeholder={env.voiceAnnouncedIp || "203.0.113.10"}
              />
            </Field>
            <Field
              label={t("admin.voice.domain")}
              hint={t("admin.voice.domainHint")}
            >
              <input
                className={ui.input}
                value={config.voiceChat.domain}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    voiceChat: { ...config.voiceChat, domain: event.target.value },
                  })
                }
                placeholder={env.voiceDomain || "voice.example.com"}
              />
            </Field>
          </div>
          {/* Hidden as soon as mesh is picked, even before saving: the warning
              is about what the voice server announces, and mesh announces
              nothing. */}
          {voiceUnroutable && config.voiceChat.mode !== "mesh" ? (
            <p role="status" className="live-in mt-3 text-xs text-amber-400">
              {t("admin.voice.unroutable")}
            </p>
          ) : null}
          <p className="mt-3 text-[11px] text-stone-500">
            {t("admin.voice.applyNote")}
          </p>
        </PageSection>

        <PageSection id="admin-discord" heading={t("admin.discord.heading")} glyph="system-share">
          <p className="mb-3 text-xs text-stone-500">
            {t("admin.discord.intro.a")}
            <code className="text-stone-400">&lt;public URL&gt;/api/auth/discord/callback</code>
            {t("admin.discord.intro.b")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label={t("admin.discord.clientId")}
              hint={inheritedHint(t, config.discord.clientId, env.discordClientId)}
            >
              <input
                className={ui.input}
                value={config.discord.clientId}
                onChange={(event) =>
                  setConfig({ ...config, discord: { ...config.discord, clientId: event.target.value } })
                }
                placeholder={env.discordClientId || t("admin.discord.notSet")}
              />
            </Field>
            <SecretField
              label={t("admin.discord.clientSecret")}
              isSet={config.discord.hasClientSecret}
              value={discordSecret}
              onChange={setDiscordSecret}
              hint={env.hasDiscordClientSecret ? t("admin.discord.secretEnv") : undefined}
            />
          </div>
        </PageSection>
    </>
  );
}
