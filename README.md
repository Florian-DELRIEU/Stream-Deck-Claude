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

1. **Plugin** : double-clique sur `release/com.zv-claude-streamdeck.streamDeckPlugin`.
   Une catégorie « Claude Deck » apparaît dans la liste des actions.
2. **Touches** : glisse l'action **Session** sur autant de touches que tu veux voir de sessions.
   De gauche à droite puis de haut en bas, elles reçoivent les sessions dans leur ordre de démarrage.
3. **Hooks de Claude Code** (une seule fois), dans un terminal :

   ```powershell
   node "$env:APPDATA\Elgato\StreamDeck\Plugins\com.zv-claude-streamdeck.sdPlugin\bin\hooks-cli.js" install
   ```

   La commande fusionne les hooks dans `%USERPROFILE%\.claude\settings.json` sans toucher au reste,
   après en avoir fait une copie (`settings.json.bak-AAAAMMJJ-HHMMSS`). Les sessions déjà ouvertes
   les prennent en compte au prochain démarrage.

   | Commande | Rôle |
   | --- | --- |
   | `… hooks-cli.js install [--port N]` | ajoute (ou met à jour) les hooks |
   | `… hooks-cli.js status` | liste les hooks du plugin présents |
   | `… hooks-cli.js uninstall` | retire uniquement les hooks du plugin |

   Option `--settings chemin` pour viser un autre fichier de réglages.

## États affichés

| Touche | État | Déclenché par |
| --- | --- | --- |
| `repos` | au repos | démarrage de session, `/clear` |
| `travaille` | Claude travaille | prompt envoyé, outil lancé |
| `PERMIS ?` | attend une permission | demande de permission |
| `à toi` | attend ta réponse | notification d'attente, question MCP |
| `fini` | réponse terminée | fin de réponse, interruption (Échap) |
| `erreur` | erreur | échec d'outil (3 s) ou d'API (jusqu'au prochain prompt) |
| `—` | emplacement libre | aucune session pour cette touche |

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
├── hooks/
│   ├── installer.ts             fusion / retrait dans settings.json, fonctions pures (A4)
│   └── cli.ts                   bin/hooks-cli.js : install, uninstall, status (A4)
└── actions/session.ts           action « Session » (texte, en attendant B1/B2)
```
