import type { MessageKey } from "./en";

// The French dictionary, as a Partial on purpose: a key not translated here
// falls back to the English line, so translation can land area by area and
// the app never shows a missing-string placeholder. The voice follows the
// app's own: plain words, and "tu" — this is a game played with friends.
export const fr: Partial<Record<MessageKey, string>> = {
  // Shared actions and words.
  "action.loading": "Chargement…",
  "action.reset": "Réinitialiser",
  "action.remove": "Retirer",

  // Account menu.
  "menu.account.aria": "Compte",
  "menu.tooltip": "Menu du compte et de l'appli",
  "menu.role.admin": "Gardien de ce serveur",
  "menu.role.player": "Aventurier",
  "menu.allCampaigns": "Toutes les campagnes",
  "menu.characters": "Personnages",
  "menu.rulebook": "Livre de règles",
  "menu.friends": "Amis",
  "menu.settings": "Paramètres",
  "menu.adminPanel": "Panneau d'administration",
  "menu.help": "Aide",
  "menu.about": "À propos",
  "menu.aboutServer": "À propos de ce serveur",
  "menu.appHome": "Accueil de l'appli",
  "menu.appSettings": "Réglages de l'appli",
  "menu.appGuide": "Guide de l'appli",
  "menu.logOut": "Se déconnecter",
  "menu.appHome.tooltip": "Retour à l'accueil de l'appli",
  "menu.appHome.aria": "Accueil de l'appli",

  // The settings page and its sections.
  "settings.title": "Paramètres du compte",
  "settings.signedInAs": "Connecté en tant que {name}",
  "settings.adminPanel": "Panneau d'administration",
  "settings.nav.profile": "Profil",
  "settings.nav.dice": "Dés",
  "settings.nav.signin": "Connexion",
  "settings.nav.appearance": "Apparence",
  "settings.nav.language": "Langue",
  "settings.nav.dictation": "Dictée",
  "settings.nav.blocked": "Bloqués",
  "settings.nav.agents": "Agents",
  "settings.nav.account": "Compte",

  "settings.profile.title": "Image de profil",
  "settings.profile.add": "Ajouter une image",
  "settings.profile.change": "Changer l'image",
  "settings.profile.avatarAlt": "Ton avatar",
  "settings.profile.hint":
    "Affichée à côté de ton nom dans les salons et à la table. Les portraits des personnages se choisissent sur chaque personnage.",

  "settings.dice.title": "Tes dés",
  "settings.dice.intro":
    "Les dés virtuels qui roulent sur chaque table où tu t'assieds. Ils suivent ton compte sur ce serveur, sur tous tes appareils.",

  "settings.password.title": "Mot de passe",
  "settings.password.setTitle": "Définir un mot de passe",
  "settings.password.submit": "Définir le mot de passe",
  "settings.password.discordHint":
    "Tu te connectes avec Discord. Définis un mot de passe pour aussi te connecter avec ton nom d'utilisateur, par exemple dans les applis pour ordinateur et mobile.",
  "settings.password.saved":
    "Mot de passe enregistré. Les autres appareils ont été déconnectés.",

  "settings.discord.title": "Discord",
  "settings.discord.linked": "Compte lié. Tu peux te connecter avec Discord.",
  "settings.discord.link": "Lier un compte Discord",
  "settings.discord.notice.linked": "Compte Discord lié.",
  "settings.discord.notice.taken":
    "Ce compte Discord est déjà lié à un autre utilisateur.",

  "settings.deletion.scheduledTitle": "Suppression programmée",
  "settings.deletion.scheduledRibbon": "En attente",
  "settings.deletion.scheduledIntro":
    "Ce compte sera définitivement supprimé le {date}. D'ici là, tout fonctionne encore, et tu peux annuler.",
  "settings.deletion.keep": "Garder mon compte",
  "settings.deletion.title": "Supprimer le compte",
  "settings.deletion.ribbon": "Irréversible",
  "settings.deletion.graceImmediate":
    "Ton compte, les campagnes que tu as créées, tes personnages et tes images sont effacés immédiatement.",
  "settings.deletion.graceCopy_one":
    "Ton compte est déconnecté partout et effacé après {count} jour, avec les campagnes que tu as créées, tes personnages et tes images. Connecte-toi avant cette date pour le garder.",
  "settings.deletion.graceCopy_other":
    "Ton compte est déconnecté partout et effacé après {count} jours, avec les campagnes que tu as créées, tes personnages et tes images. Connecte-toi avant cette date pour le garder.",
  "settings.deletion.confirmError": "Impossible de supprimer ton compte.",
  "settings.deletion.purged":
    "Ton compte et tout ce qu'il contenait ont été supprimés. ",
  "settings.deletion.scheduledNotice":
    "Ton compte est programmé pour être supprimé le {date}. Tu as été déconnecté partout. Pour le garder, reconnecte-toi avant cette date et choisis « Garder mon compte ». ",
  "settings.deletion.back": "Retour à l'entrée",
  "settings.deletion.logInFirst": "Se connecter",
  "settings.deletion.logInToManage": "pour gérer ton compte.",

  "settings.about.title": "À propos",
  "settings.about.rulebook": "Livre de règles",
  "settings.about.reference": "Référence des règles",
  "settings.about.terms": "Conditions d'utilisation",
  "settings.about.privacy": "Politique de confidentialité",
  "settings.about.licenses": "Licences et attributions",

  // Appearance.
  "appearance.title": "Apparence",
  "appearance.intro":
    "Conservé sur cet appareil. Le plateau et ses canevas se dessinent à leur propre taille, quelle que soit l'échelle.",
  "appearance.theme.aria": "Thème",
  "appearance.theme.auto": "Suivre le système",
  "appearance.theme.dark": "Nuit arcane",
  "appearance.theme.light": "Journée parchemin",
  "appearance.scale": "Échelle de l'interface",

  // Language.
  "language.title": "Langue",
  "language.intro":
    "La langue des menus et des écrans, conservée sur cet appareil. Le maître du jeu raconte, lui, dans la langue de ta table.",
  "language.aria": "Langue",
  "language.auto": "Suivre le navigateur",
  "language.english": "English",
  "language.french": "Français",
};
