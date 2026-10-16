# Décisions — Plugin Stream Deck pour Claude

Instantané au 2026-10-15 du document « options retenues » et de la discussion de cadrage.

## Décisions prises

| Sujet | Décision |
| --- | --- |
| Matériel | Stream Deck v2 à touches (pas de Stream Deck+ : ni molette ni écran LCD). Le plugin fournit des actions, Florian les dispose comme il veut ; le nombre de touches est sans importance |
| Sessions affichées | Florian choisit lui-même combien de sessions il voit en même temps : action « session » à poser autant de fois qu'il veut |
| Système | Windows |
| Cible | App Claude Windows (dont Cowork) et Claude Code. Claude Code d'abord (v1), app et Cowork en v4 sous réserve d'une source d'état |
| Construction | Plugin construit de zéro, pas de fork |
| Priorités | Les trois à égalité : où Claude a besoin de lui, consommation, raccourcis |
| Push-to-talk | Dictée de l'OS (Win+H) : la touche ouvre l'overlay Claude puis lance la dictée ; le texte arrive dans l'overlay. whisper.cpp local reste une option v5 |
| Overlay | Touche qui envoie le raccourci global d'ouverture rapide de l'app Claude desktop. Combo exact inconnu → champ saisissable dans l'inspecteur de propriétés |
| Style | Thème Claude / Claude Code en pixel art, sprites originaux, pas de logos officiels |
| Approche | Roadmap par versions : v1 = tout ce qui est faisable sans difficulté, v2 à v5 = blocs plus complexes |
| Architecture | Hooks HTTP de Claude Code → serveur local dans le plugin → état des sessions → rendu pixel |
| Plan v1 | Validé le 2026-10-15. Le code sera fait dans Claude Code |
| Identifiant | UUID du plugin `com.zv-claude-streamdeck` (choisi par Florian, définitif une fois publié), nom affiché « Claude Deck » |
| Versions (A1) | Stream Deck 7.1 minimum, Node 24 embarqué, SDKVersion 3, Windows 10+ (même socle que ZV Discord) |
| Serveur (A2) | `127.0.0.1` uniquement, port **47615** par défaut (réglable en D1), routes `/claude-streamdeck/<Événement>`, contrôle de l'en-tête Host contre le DNS rebinding |
| Hooks (A4) | Hooks HTTP sans matcher sur 15 événements, `timeout: 5` (le défaut de 600 s pourrait geler Claude si le plugin se bloquait). Installeur en ligne de commande livré dans le plugin (`bin/hooks-cli.js`) ; un bouton dans l'inspecteur viendra en D1 |
| Interruption | Échap pendant un outil → état « Terminée » (Claude Code n'envoie pas `Stop` dans ce cas) |
| Simplification (2026-10-16) | Premier essai : touche restée sur « — », cause invisible. Florian a demandé plus simple → 1) **choix de la session dans les réglages de la touche** : « Automatique » ou un projet de la liste, le choix suit le **dossier** (une nouvelle session dans le même dossier retrouve sa touche) ; 2) **bouton « Installer les hooks »** dans l'inspecteur, avec diagnostic (serveur, hooks, dernier hook reçu). La ligne de commande reste en secours |
| Apparition d'une session | Une session n'apparaît qu'à son premier événement reçu : une session ouverte avant l'installation des hooks ou le démarrage du plugin s'affiche au prochain prompt. La touche affiche « en attente de Claude » tant qu'aucun hook n'est arrivé |

## Point encore ouvert

- **Raccourci de l'overlay Claude** : Florian sait que l'app en a un (il l'a déclenché par erreur plusieurs fois) mais ne se souvient plus du combo. À retrouver dans les paramètres de l'app Claude desktop. Par défaut : champ à saisir dans la configuration du plugin.

## Proposition non tranchée

- **Remonter « approuver / refuser / toujours » de la v3 à la v2** : rendu possible parce que l'événement de demande de permission accepte une décision renvoyée par le serveur (pas besoin de simuler le clavier). Florian a validé le plan sans répondre sur ce point → **par défaut, la fonction reste en v3**. Redemander au moment de planifier la v2.

## Corrections de faisabilité intégrées

- État « Erreur » : faisable (🟡). Les hooks exposent l'échec d'outil et l'échec d'API (on croyait au départ que non).
- Modèle et effort actifs : lisibles directement dans les hooks (🟢).

## Idées écartées ou inapplicables

| Idée | Raison |
| --- | --- |
| Toile LCD fusionnée sur les 4 molettes (AgentDeck) | Pas d'écran LCD sur le modèle de Florian → remplacée par des pages de touches |
| Molette pour faire défiler les sessions (agentsd) | Pas de molette → remplacée par l'action « session » multiple et les pages |
| Architecture pseudo-terminal (node-pty) d'AgentDeck comme source d'état | Préférence pour les hooks officiels (plus fiables, pas de contrainte sur le lancement de Claude, meilleur pour Windows). Un canal d'entrée dédié reste à prototyper pour répondre aux sessions (v2) |
| Limites d'abonnement claude.ai / app Claude | Non exposées proprement (🔴), en veille en v5 |
