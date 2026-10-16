# Claude Deck — plugin Stream Deck pour Claude Code

Tableau de bord physique des sessions Claude Code sur un Stream Deck à touches (Windows) :
état de chaque session, sessions qui attendent une permission ou une réponse, puis
(jalons suivants) raccourcis, prompts, overlay et dictée. Cadrage et plan : `CLAUDE.md` et `docs/`.

**État : jalon A (fondations) terminé.** La touche « Session » affiche pour l'instant le nom du
projet et l'état en texte ; le rendu pixel arrive au jalon B.

## Comment ça marche

```
Claude Code ──hooks HTTP──▶ serveur local du plugin (127.0.0.1:47615) ──▶ sessions + machine à états ──▶ touches
```

Le serveur répond immédiatement (200, corps vide) puis traite l'événement : il ne ralentit ni ne
bloque jamais Claude Code. Si le plugin est arrêté, Claude Code reçoit une erreur de connexion,
l'ignore et continue (et chaque hook a un délai max de 5 s).

## Installation (Windows)

Il faut Stream Deck **7.1 ou plus récent**.

1. **Plugin** : double-clique sur `release/com.zv-claude-streamdeck.streamDeckPlugin`
   (en cas de mise à jour, il remplace l'ancienne version).
2. **Touche** : glisse l'action **Session** (catégorie « Claude Deck ») sur une touche.
3. **Hooks** : clique sur la touche, puis dans ses réglages sur **Installer les hooks**.
   Ça ajoute les hooks du plugin à `%USERPROFILE%\.claude\settings.json` sans toucher au reste,
   avec une copie de sauvegarde (`settings.json.bak-AAAAMMJJ-HHMMSS`). Claude Code les prend en
   compte tout de suite, dans le terminal comme dans l'app desktop.
4. **Envoie un prompt** dans Claude Code : la touche affiche le projet et son état.

Pose l'action autant de fois que tu veux voir de sessions. Dans les réglages de chaque touche :

- **Automatique** : les touches reçoivent les sessions dans leur ordre de démarrage, de gauche à
  droite puis de haut en bas ;
- **un projet de la liste** : la touche suit ce dossier, même quand tu relances Claude Code
  dedans. Les touches automatiques ne le prennent plus.

### La touche ne change pas ?

La touche et ses réglages disent ce qui manque :

| Touche / réglages | Cause | Que faire |
| --- | --- | --- |
| `en attente de Claude` | aucun hook reçu depuis le démarrage du plugin | vérifier « Hooks : installés », puis envoyer un prompt (une session déjà ouverte n'apparaît qu'à son prochain événement) |
| `port occupé` | un autre programme utilise le port 47615 | fermer ce programme puis redémarrer Stream Deck |
| Hooks : absents / autre port | hooks non installés ou anciens | **Installer les hooks** |
| Dernier hook : jamais | Claude Code n'envoie rien au plugin | vérifier que tu utilises bien ce compte Windows, et les journaux (ci-dessous) |
| `projet fermée` | le projet choisi n'a pas de session ouverte | relancer Claude Code dans ce dossier, ou repasser la touche en Automatique |

Journaux : `%APPDATA%\Elgato\StreamDeck\Plugins\com.zv-claude-streamdeck.sdPlugin\logs\`.

### Retrait

Bouton **Retirer les hooks** dans les réglages d'une touche (avant de désinstaller le plugin).
En secours, la même chose en ligne de commande :

```powershell
node "$env:APPDATA\Elgato\StreamDeck\Plugins\com.zv-claude-streamdeck.sdPlugin\bin\hooks-cli.js" uninstall
```

(`install [--port N]`, `status`, et `--settings chemin` pour un autre fichier.)

## États affichés

| Touche | État | Déclenché par |
| --- | --- | --- |
| `repos` | au repos | démarrage de session, `/clear` |
| `travaille` | Claude travaille | prompt envoyé, outil lancé |
| `PERMIS ?` | attend une permission | demande de permission |
| `à toi` | attend ta réponse | notification d'attente, question MCP |
| `fini` | réponse terminée | fin de réponse, interruption (Échap) |
| `erreur` | erreur | échec d'outil (3 s) ou d'API (jusqu'au prochain prompt) |
| `—` | emplacement libre | aucune session pour cette touche automatique |
| `en attente de Claude` | aucun hook reçu | voir « La touche ne change pas ? » |
| `projet fermée` | projet choisi sans session ouverte | |

## Développement

Prérequis : Node.js 24+ (ou 22 pour les tests), `@elgato/cli` (installé avec les dépendances).

```bash
npm install
npm run build        # compile src/ vers com.zv-claude-streamdeck.sdPlugin/bin/
npx streamdeck link com.zv-claude-streamdeck.sdPlugin   # installe en mode dev
npm run watch        # recompile et redémarre le plugin à chaque modification
npm run hooks:install   # hooks pointant vers le plugin (même CLI que ci-dessus)
```

| Commande | Rôle |
| --- | --- |
| `npm run typecheck` | vérification TypeScript |
| `npm test` | compile puis lance les tests unitaires et le test de bout en bout (faux Stream Deck + vrais POST de hooks) |
| `npm run validate` | valide le manifeste avec la CLI Elgato |
| `npm run pack` | produit `release/com.zv-claude-streamdeck.streamDeckPlugin` |
| `node scripts/gen-icons.mjs` | régénère les images pixel art (SVG + PNG) |

Les journaux du plugin sont dans `com.zv-claude-streamdeck.sdPlugin/logs/` : chaque hook reçu y
est noté (`PreToolUse 1a2b3c4d [mon-projet] → working`).

### Organisation du code

```
src/
├── plugin.ts                    point d'entrée : action, serveur, journal
├── config.ts                    port, préfixe de route, liste des événements, délai des hooks
├── server/hook-server.ts        serveur HTTP local (A2)
├── sessions/
│   ├── types.ts                 fiche de session, événement de hook
│   ├── state-machine.ts         transitions d'état, fonction pure (A3)
│   └── session-manager.ts       fiches, ordre des emplacements, notifications regroupées (A3)
├── plugin-state.ts              état du serveur et dernier hook reçu (diagnostic)
├── hooks/
│   ├── installer.ts             fusion / retrait dans settings.json, fonctions pures (A4)
│   ├── settings-file.ts         lecture, sauvegarde, écriture du fichier (plugin + CLI)
│   └── cli.ts                   bin/hooks-cli.js : install, uninstall, status (secours)
└── actions/
    ├── assign.ts                attribution touches ↔ sessions, titres (fonctions pures)
    └── session.ts               action « Session » + messages de l'inspecteur (ui/session.html)
```
