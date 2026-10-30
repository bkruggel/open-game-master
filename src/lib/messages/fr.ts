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
  "action.cancel": "Annuler",
  "action.change": "Changer",
  "action.clear": "Effacer",
  "action.done": "Terminé",
  "action.customize": "Personnaliser",
  "action.connect": "Connecter",

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

  // The password form.
  "password.current": "Mot de passe actuel",
  "password.new": "Nouveau mot de passe",
  "password.confirm": "Confirmer le nouveau mot de passe",
  "password.change": "Changer le mot de passe",
  "password.mismatch": "Les nouveaux mots de passe ne concordent pas.",
  "password.changeFailed": "Impossible de changer le mot de passe.",
  "password.unreachable": "Impossible de joindre le serveur.",

  // The hold-to-dictate key.
  "dictation.title": "Touche de dictée",
  "dictation.intro":
    "Conservée sur cet appareil. Une touche à maintenir pour parler dans la messagerie de la table au lieu de tenir le bouton du micro. Rien n'est envoyé avant d'appuyer sur Envoyer.",
  "dictation.noneSet": "Aucune touche choisie",
  "dictation.setKey": "Choisir une touche",
  "dictation.pressKeys": "Appuie sur les touches...",
  "dictation.holding": "{held}+...",
  "dictation.saved": "Enregistrée sur cet appareil",
  "dictation.listeningHint":
    "Tiens Ctrl ou Alt avec une lettre, ou appuie sur une touche qui n'écrit pas, comme F8 ou F9. Échap arrête l'écoute.",
  "dictation.holdHint":
    "Tiens-la à la table, dans la messagerie ou partout hors d'un autre champ, pour parler comme avec le bouton du micro. Relâche, et les mots attendent dans le champ ; seul Envoyer les envoie.",

  // Blocked players.
  "blocked.title": "Joueurs bloqués",
  "blocked.intro":
    "Les messages de table des joueurs bloqués te sont cachés, et ni l'un ni l'autre ne peut ouvrir une discussion privée ni envoyer une demande d'ami. Bloque quelqu'un depuis son message ou depuis la liste du groupe.",
  "blocked.loading": "Chargement des joueurs bloqués",
  "blocked.nobody": "Personne n'est bloqué.",
  "blocked.unblock": "Débloquer",

  // Connected agents.
  "agents.title": "Agents connectés",
  "agents.intro":
    "Laisse ton propre Claude Code, Codex ou autre client MCP agir ici à ta place : lire tes campagnes, jouer ton personnage, ou mener une table où tu es maître du jeu. Il reçoit exactement ce que ton compte peut faire, seulement les parties que tu coches, et jamais ton mot de passe ni les réglages du serveur.",
  "agents.introAssistant":
    " ChatGPT, Claude, Grok et Meta Muse peuvent aussi agir à ta place, par le lien montré quand tu connectes.",
  "agents.loading": "Chargement des agents connectés",
  "agents.nobody": "Aucun agent connecté.",
  "agents.readyBody": "est prêt. C'est la seule fois où son jeton est montré ; copie la ligne pour ton agent maintenant.",
  "agents.copied": "Je l'ai copiée",
  "agents.rowMeta": "dernière utilisation {last} · expire {expires}",
  "agents.never": "jamais",
  "agents.oneCampaign": "une campagne",
  "agents.pollLink": "Lien de sondage",
  "agents.revoke": "Révoquer",
  "agents.connectAnAgent": "Connecter un agent",
  "agents.name": "Nom",
  "agents.namePlaceholder": "Claude Code sur mon ordinateur",
  "agents.whatMayDo": "Ce qu'il peut faire",
  "agents.limitToCampaign": "Limiter à une campagne",
  "agents.anyCampaign": "Toute campagne où je siège",
  "agents.createFailed": "Impossible de connecter un agent.",
  "agents.scope.read.label": "Lire",
  "agents.scope.read.hint": "Tes campagnes, personnages, quêtes et traditions, tels que tu les vois.",
  "agents.scope.play.label": "Jouer",
  "agents.scope.play.hint": "Agir, parler et lancer les dés à une table comme ton personnage.",
  "agents.scope.characters.label": "Personnages",
  "agents.scope.characters.hint": "Créer, modifier et supprimer les personnages de ta bibliothèque.",
  "agents.scope.campaigns.label": "Campagnes",
  "agents.scope.campaigns.hint": "Créer des campagnes et changer celles que tu mènes.",
  "agents.scope.dm.label": "Maître du jeu",
  "agents.scope.dm.hint": "Faire respecter les règles et raconter, seulement là où tu occupes le siège de maître du jeu.",

  // The player's dice.
  "dice.summary.named": "Dés {name}",
  "dice.summary.own": "Tes propres couleurs",
  "dice.summary.look": "motif {texture}, finition {material}",
  "dice.customizeButton": "Personnaliser mes dés",
  "dice.customizeTitle": "Choisis les couleurs, le motif et la finition de tes dés virtuels.",
  "dice.followAccount": "Tes dés suivent ton compte : chaque table et chaque appareil les montre.",
  "dice.startFrom": "Partir de",
  "dice.namedAria": "Dés {name}",
  "dice.dieColour": "Couleur du dé",
  "dice.numberColour": "Couleur des chiffres",
  "dice.numberOutline": "Contour des chiffres",
  "dice.outlineColour": "Couleur du contour",
  "dice.outlineSwitch": "Dessiner le contour des chiffres",
  "dice.pattern": "Motif",
  "dice.finish": "Finition",
  "dice.webgl": "L'aperçu 3D a besoin de WebGL. Tes choix s'appliquent quand même à la table.",
  "dice.preset.radiant": "Radiant",
  "dice.preset.fire": "Feu",
  "dice.preset.ice": "Glace",
  "dice.preset.poison": "Poison",
  "dice.preset.acid": "Acide",
  "dice.preset.thunder": "Tonnerre",
  "dice.preset.air": "Air",
  "dice.preset.water": "Eau",
  "dice.preset.earth": "Terre",
  "dice.preset.force": "Force",
  "dice.preset.necrotic": "Nécrotique",
  "dice.preset.bloodmoon": "Lune de sang",
  "dice.preset.starrynight": "Nuit étoilée",
  "dice.preset.glitterparty": "Fête à paillettes",
  "dice.preset.astralsea": "Mer astrale",
  "dice.preset.dragon": "Dragon",
  "dice.preset.bronze": "Bronze",
  "dice.preset.onyx": "Onyx",
  "dice.preset.ivory": "Ivoire",
  "dice.texture.none": "Uni",
  "dice.texture.paper": "Papier",
  "dice.texture.marble": "Marbre",
  "dice.texture.cloudy": "Nuages",
  "dice.texture.speckles": "Mouchetis",
  "dice.texture.glitter": "Paillettes",
  "dice.texture.stars": "Étoiles",
  "dice.texture.stainedglass": "Vitrail",
  "dice.texture.wood": "Grain de bois",
  "dice.texture.metal": "Métal brossé",
  "dice.texture.fire": "Feu",
  "dice.texture.ice": "Glace",
  "dice.texture.water": "Eau",
  "dice.texture.astral": "Astral",
  "dice.texture.skulls": "Crânes",
  "dice.texture.dragon": "Écailles de dragon",
  "dice.texture.leopard": "Léopard",
  "dice.material.plastic": "Plastique",
  "dice.material.glass": "Verre",
  "dice.material.metal": "Métal",
  "dice.material.wood": "Bois",
  "dice.material.none": "Mat",
};
