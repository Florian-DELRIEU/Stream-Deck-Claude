# Sources et projets existants

## Documentation officielle

- Hooks de Claude Code (référence) : https://code.claude.com/docs/en/hooks
- SDK Stream Deck (Elgato), Getting Started : https://docs.elgato.com/sdk/

## Projets existants dont s'inspirer

| Projet | Lien | Ce qu'on en retient |
| --- | --- | --- |
| AgentDeck (puritysb) — **référence principale** | Post r/elgato : https://www.reddit.com/r/elgato/comments/1rdod72/i_turned_my_stream_deck_into_a_realtime_control/ (Reddit non lisible par les outils de Claude ; dépôt GitHub à retrouver) | Layout dynamique par état, chronomètre sur touche, push-to-talk whisper.cpp, serveur pont + machine à états poussée par WebSocket. TypeScript, SDK Stream Deck v2, node-pty, macOS uniquement, vise le Stream Deck+ |
| agentsd (paultyng) | https://github.com/paultyng/agentsd | File d'attente de permissions multi-sessions, session inconnue créée automatiquement au redémarrage, molette de défilement (inapplicable) |
| Code Companion (dmtrio) | https://github.com/dmtrio/streamdeck-code-companion | Mises à jour pilotées par les hooks sans polling, script de notification fire-and-forget, sessions SSH via tunnel |
| streamdeck-claude | (lien non conservé) | Emplacements remplis automatiquement par ordre de démarrage des sessions |
| Claude Peak Ticker (Elgato) | (lien non conservé) | Indicateur heures de pointe / creuses avec compte à rebours |

## Comparaison des architectures

| | Hooks (agentsd, Code Companion) — **retenu** | Pseudo-terminal (AgentDeck) |
| --- | --- | --- |
| Fiabilité de l'état | Événements propres et officiels | Déduction à partir du texte affiché, plus fragile |
| Répondre à Claude | Via la réponse au hook (permissions) ; reste à prototyper pour le texte | Direct : écriture dans le terminal |
| Contrainte | Aucune sur la façon de lancer Claude | Lancer Claude à travers le pont |
| Windows | Plutôt facile (hooks HTTP sans shell) | Incertain (node-pty via ConPTY, projet macOS-only) |

## Concordance des sources

La doc officielle des hooks et les dépôts GitHub s'accordent sur l'architecture hooks → serveur local → plugin. Ils divergent sur le transport (HTTP, WebSocket, script shell). La doc Elgato se contredit sur les versions minimales de Node et du logiciel Stream Deck. Aucune source trouvée n'expose l'état de l'app Claude ou de Cowork. Aucun projet existant ne semble couvrir la consommation, ce qui serait la valeur ajoutée de ce plugin.
