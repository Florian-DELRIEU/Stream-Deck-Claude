# Roadmap — Plugin Stream Deck pour Claude

Instantané au 2026-10-15. Faisabilité : 🟢 facile, mécanisme connu et documenté · 🟡 faisable avec effort ou à valider en pratique · 🟠 incertain, dépend d'un point non confirmé · 🔴 non fiable ou non exposé.

## Vue d'ensemble

| Version | Thème | Critère de réussite |
| --- | --- | --- |
| v1 | Socle : états, raccourcis, overlay, style pixel | Florian voit l'état de ses sessions Claude Code sur les touches et lance raccourcis, overlay et dictée d'un appui |
| v2 | Consommation et affichage enrichi | Modèle, tokens, coût et contexte visibles en direct, avec animations |
| v3 | Contrôle des sessions | Répondre aux permissions et interrompre une session depuis les touches |
| v4 | App Claude et Cowork | L'état de l'app s'affiche, si une source exploitable existe |
| v5 | Confort et extensions | Voix locale, sessions distantes, publication |

L'ordre suit la faisabilité ; il pourra être revu après la v1 selon l'usage réel.

## v1 — Socle

Tout ce qui s'appuie sur les hooks de Claude Code et sur de simples envois de raccourcis. Détail d'exécution : `PLAN-V1.md`.

| | Fonctionnalité | Détail |
| --- | --- | --- |
| 🟢 | Plugin et serveur local | Plugin construit de zéro, serveur local qui reçoit les hooks, ne bloque jamais |
| 🟢 | Installation des hooks | Une commande ajoute les hooks à la configuration de Claude Code, une autre les retire |
| 🟢 | Action « session » | À placer autant de fois que voulu. États : travaille, attend une permission, attend ta réponse, terminé. Session créée automatiquement si inconnue |
| 🟢 | Badge « Claude a besoin de moi » | Compteur de sessions bloquées, touche qui clignote |
| 🟢 | Activité en cours et chronomètre | Outil utilisé, fichier touché, durée de la tâche |
| 🟢 | Raccourcis clavier | Focus fenêtre Claude, nouvelle conversation, Esc, /clear, /compact |
| 🟢 | Prompts prédéfinis | « continue », « résume où tu en es », !plan, !contexte, !modele |
| 🟢 | Actions utilitaires | Copier la dernière réponse, ouvrir le dossier du projet ou le dernier fichier modifié |
| 🟡 | Touche overlay | Envoie le raccourci d'ouverture rapide de l'app Claude, saisi dans la configuration du plugin |
| 🟢 | Push-to-talk par dictée de l'OS | Ouvre l'overlay puis lance la dictée (Win+H) |
| 🟢 | Style pixel de base | Palette Claude, police pixel, rendu net, esprit terminal, cadre commun |

## v2 — Consommation et affichage enrichi

| | Fonctionnalité | Détail |
| --- | --- | --- |
| 🟡 | Consommation Claude Code | Tokens, coût estimé, jauge de contexte (%), par session et cumulé (source : logs locaux / transcript, à confirmer) |
| 🟢 | Modèle et effort actifs | Par session (lisibles dans les hooks) |
| 🟡 | Compteurs et jauge en pixel | Chiffres en police pixel, jauge de contexte en blocs |
| 🟡 | Texte défilant | Outil en cours ou début du dernier message, façon ligne de terminal |
| 🟡 | Dernier message résumé, fichiers modifiés | Un peu de parsing des logs |
| 🟡 | Pages de touches | Plusieurs pages pour les sujets et la consommation (remplace l'écran LCD absent) |
| 🟡 | Basculer entre sessions | Une touche par projet amène la bonne fenêtre au premier plan |
| 🟡 | Icônes animées par sprites | Quelques images par état (réfléchit, travaille, attend), mascotte ou symbole pixel original |
| 🟡 | Test du canal de retour | Prototype pour écrire dans une session précise, prépare la v3 |

## v3 — Contrôle des sessions

| | Fonctionnalité | Détail |
| --- | --- | --- |
| 🟡 | Approuver, refuser, toujours | D'un appui, avec file d'attente si plusieurs sessions attendent. La décision peut être renvoyée directement au hook de demande de permission (proposition de remonter en v2, non tranchée) |
| 🟡 | Bouton STOP | Interrompt la bonne session, pas seulement la fenêtre active |
| 🟡 | Sélection d'options | Boutons d'options sur les touches, avec pagination |
| 🟡 | Touches adaptatives par état | Actions rapides à l'arrêt, STOP rouge en cours, OUI / NON / TOUJOURS sur permission, boutons d'options sur sélection |
| 🟡 | État « Erreur » | Échec d'outil et échec d'API exposés par les hooks, à afficher dès que possible (déjà prévu dans la machine à états v1) |

## v4 — App Claude et Cowork

Conditionnée à ce qui est exploitable côté app. Si rien ne l'est, elle se réduit aux raccourcis déjà livrés en v1.

| | Fonctionnalité | Détail |
| --- | --- | --- |
| 🟠 | Source d'état de l'app Claude | Investiguer ce qui est exposé (logs, notifications, interface) |
| 🟠 | État de l'app et de Cowork sur les touches | Affichage si une source est trouvée |
| 🟠 | Changer de modèle ou d'effort | Dépend de ce que l'outil permet de piloter |

## v5 — Confort et extensions

| | Fonctionnalité | Détail |
| --- | --- | --- |
| 🟡 | Push-to-talk local | Vrai maintien pour parler, transcription locale (whisper.cpp) |
| 🟡 | Heures de pointe | Indicateur avec compte à rebours (idée de Claude Peak Ticker) |
| 🟠 | Sessions distantes en SSH | Via un tunnel (idée de Code Companion) |
| 🟡 | Publication | Packaging pour le marketplace Elgato, logos officiels évités |
| 🔴 | Limites d'abonnement | En veille tant qu'elles ne sont pas exposées proprement |

## Catalogue complet des options (référence)

### Affichages

| | Affichage | Détail |
| --- | --- | --- |
| 🟢 | État par session | Travaille, attend une permission, attend ta réponse, terminé |
| 🟢 | Une touche par sujet ou projet | Nom court, état, durée depuis le dernier mouvement |
| 🟢 | Badge « besoin de moi » | Compteur de sessions bloquées, clignotement |
| 🟢 | Activité en cours | Outil utilisé, fichier touché, sous-agent lancé |
| 🟢 | Chronomètre | Durée de la tâche en cours |
| 🟢 | Modèle et effort actifs | Par session |
| 🟡 | Consommation Claude Code | Tokens, coût estimé, jauge de contexte, par session et cumulé |
| 🟡 | Dernier message résumé, fichiers modifiés | Parsing |
| 🟡 | Pages de touches | Lister sujets et consommation sans LCD |
| 🟡 | État « Erreur » | Échec d'outil / d'API |
| 🔴 | Limites d'abonnement claude.ai / app | Non exposées |
| 🟡 | Icônes animées par état | Fluidité limitée par la fréquence de mise à jour |
| 🟡 | Jauge de contexte en blocs pixel | Par session |
| 🟡 | Compteurs en police pixel | Tokens, coût, durée en direct |
| 🟡 | Texte défilant | Outil en cours ou début du dernier message |
| 🟢 | Nombre de sessions affichées réglable | Action « session » à poser autant de fois que voulu |
| 🟠 | État de l'app Claude (dont Cowork) | Pas de hooks connus côté app |

### Actions

| | Action | Détail |
| --- | --- | --- |
| 🟢 | Raccourcis clavier | Focus fenêtre Claude, nouvelle conversation, Esc, /clear, /compact |
| 🟢 | Prompts prédéfinis | « continue », « résume où tu en es », !plan, !contexte, !modele |
| 🟢 | Utilitaires | Copier la dernière réponse, ouvrir le dossier ou le dernier fichier modifié |
| 🟡 | Approuver / refuser / toujours | Avec file d'attente multi-sessions |
| 🟡 | Bouton STOP rouge | Interrompre la bonne session |
| 🟡 | Basculer entre sessions | Une touche par projet |
| 🟡 | Sélection d'options | Avec pagination |
| 🟢 | Push-to-talk par dictée de l'OS | Overlay puis Win+H |
| 🟠 | Changer de modèle ou d'effort | Selon ce qui est pilotable |
| 🟡 | Overlay Claude (question rapide) | Raccourci global de l'app, combo à retrouver |

### Style graphique

| | Élément | Détail |
| --- | --- | --- |
| 🟢 | Palette Claude | Tons chauds sur fond sombre, une couleur par état (travaille, attend, terminé, erreur) |
| 🟢 | Police pixel | Texte et chiffres en police bitmap sur toutes les touches |
| 🟢 | Rendu net | Dessin en basse résolution puis agrandissement sans lissage |
| 🟢 | Esprit terminal | Curseur clignotant, prompt « > », texte monospace |
| 🟡 | Mascotte ou symbole pixel | Plusieurs expressions selon l'état, en original |
| 🟡 | Animations par sprites | Quelques images par état |
| 🟢 | Cadre et fond communs | Même bordure et même grille de couleurs partout |
