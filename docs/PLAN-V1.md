# Plan détaillé de la v1 — validé le 2026-10-15

La v1 tient dans un seul plugin Stream Deck qui héberge un petit serveur local. Les hooks de Claude Code lui envoient chaque événement, il met à jour l'état des sessions et redessine les touches en pixel art. Quatre jalons : **A** fondations, **B** affichage, **C** actions, **D** finition.

## Ce que les sources confirment

| Sujet | Constat |
| --- | --- |
| Hooks HTTP | Claude Code envoie le JSON de chaque événement en POST à une URL, et la réponse peut renvoyer une décision. Aucun shell n'intervient, ce qui évite les soucis Windows |
| Portée | Les hooks se déclenchent partout où Claude Code tourne, y compris dans l'app desktop de Claude Code |
| Données reçues | Identifiant de session, dossier courant, chemin du transcript, mode de permission, niveau d'effort |
| Événements utiles | Début et fin de session, prompt envoyé, avant et après chaque outil, échec d'outil, demande de permission, notification, fin de réponse, échec d'API, changement de modèle |
| Permissions | L'événement de demande de permission accepte une réponse « autoriser » ou « refuser » renvoyée directement par le serveur |
| Pannes | Si le plugin est arrêté ou injoignable, Claude Code continue normalement : le hook est non bloquant |
| Configuration | Les hooks se déclarent dans le fichier de réglages utilisateur de Claude Code |
| SDK Stream Deck | Plugin en Node avec le CLI officiel, un manifest, un inspecteur de propriétés pour les réglages, des événements d'appui et de relâchement. **Tranché en A1 : Stream Deck 7.1 + Node 24 + SDKVersion 3** (combinaison validée par `streamdeck validate` et déjà utilisée par le plugin ZV Discord sur la machine de Florian) |

> Noms des événements et des champs relus dans la doc officielle des hooks le 2026-10-15 (A2/A3). Points utiles :
> - délai par défaut d'un hook HTTP : **600 s** → l'installeur fixe `timeout: 5` ;
> - connexion refusée, non-2xx ou délai dépassé → erreur non bloquante, Claude continue ;
> - `Notification.notification_type` (`permission_prompt`, `idle_prompt`, `agent_needs_input`, `elicitation_dialog`…), `StopFailure.error` (`rate_limit`, `overloaded`…), `PostToolUseFailure.is_interrupt` ;
> - `Stop` ne se déclenche pas après une interruption (Échap) → l'interruption est traitée comme « Terminée » ;
> - événements supplémentaires utilisés : `PermissionDenied`, `Elicitation` / `ElicitationResult`, `SubagentStart`, `PostModelSwitch`.

## Composants

| Composant | Rôle |
| --- | --- |
| Serveur local | Écoute en local, reçoit les hooks, répond immédiatement pour ne jamais ralentir Claude Code |
| Gestionnaire de sessions | Une fiche par session : projet (dossier), état, outil en cours, début de tâche, dernière activité |
| Machine à états | Transforme les événements en états (tableau ci-dessous) |
| Moteur de rendu pixel | Dessine chaque touche : palette Claude, police bitmap, cadre commun, agrandissement sans lissage |
| Actions du plugin | Session, badge « besoin de moi », activité et chrono, raccourci, prompt, utilitaires, overlay, push-to-talk |
| Installeur de hooks | Ajoute et retire les hooks dans les réglages de Claude Code, avec sauvegarde du fichier |

## États d'une session

| État | Déclenché par | Fin |
| --- | --- | --- |
| Au repos | Première apparition d'une session, ou événement d'une session inconnue (création automatique, utile si le plugin redémarre en cours de route) | Premier prompt |
| Travaille | Prompt envoyé, début d'outil | Fin de réponse |
| Attend une permission | Demande de permission, ou notification de type permission | Décision prise |
| Attend ta réponse | Notification de type attente ou besoin de saisie | Nouveau prompt |
| Terminée | Fin de réponse | Nouveau prompt |
| Erreur | Échec d'outil (affichage bref) ou échec d'API (affichage durable, avec le type d'erreur) | Nouveau prompt |
| Fermée | Fin de session | Emplacement libéré |

Attribution des emplacements : par ordre de démarrage des sessions, ou projet choisi dans l'inspecteur de l'action « session ».

## Tâches

| ✓ | N° | Tâche | Critère de réussite |
| --- | --- | --- | --- |
| [~] | A1 | Créer le plugin avec le CLI officiel : manifest, identifiant, lien avec l'app Stream Deck. Vérifier les versions minimales Node / Stream Deck | Le plugin apparaît dans Stream Deck — *build, `streamdeck validate` et `pack` OK ; apparition dans Stream Deck à confirmer par Florian* |
| [x] | A2 | Serveur local dans le plugin, une route par événement, validation du JSON | Un POST de test est reçu et journalisé |
| [x] | A3 | Gestionnaire de sessions et machine à états, avec tests sur des séquences d'événements | Les états du tableau sont atteints dans le bon ordre |
| [x] | A4 | Installeur de hooks : fusion dans les réglages, sauvegarde, commande de retrait | Les hooks s'ajoutent et se retirent sans toucher au reste |
| [ ] | B1 | Moteur de rendu pixel : police, palette, cadre, échelle sans lissage | Une touche de test s'affiche nette |
| [~] | B2 | Action « session » : emplacement lié à une session, ordre de démarrage ou projet choisi | Une session réelle change de couleur et de texte avec son état — *attribution (automatique ou projet choisi dans l'inspecteur) faite le 2026-10-16 ; reste le rendu pixel et la couleur* |
| [ ] | B3 | Badge « besoin de moi » : compteur et clignotement | Une permission en attente fait clignoter le badge |
| [ ] | B4 | Activité en cours et chronomètre | L'outil courant et la durée s'affichent en direct |
| [ ] | C1 | Test d'envoi de raccourcis clavier sous Windows, puis action « raccourci » configurable | Un combo choisi dans l'inspecteur déclenche l'action voulue |
| [ ] | C2 | Action « prompt » : texte prédéfini envoyé à la fenêtre active | « continue » arrive dans la bonne fenêtre |
| [ ] | C3 | Actions utilitaires : copier la dernière réponse, ouvrir le dossier ou le dernier fichier | Chaque action fonctionne sur une session réelle |
| [ ] | C4 | Touche overlay (raccourci configurable) et push-to-talk (overlay puis dictée Win+H) | Un appui ouvre l'overlay et lance la dictée |
| [~] | D1 | Inspecteur de propriétés : port, raccourci d'overlay, options d'affichage | Les réglages persistent après redémarrage — *avancé le 2026-10-16 : installation / retrait des hooks et diagnostic dans l'inspecteur ; restent port, overlay, affichage* |
| [ ] | D2 | Essais de bout en bout : plusieurs sessions en parallèle, app desktop et terminal | Aucune session perdue, aucun ralentissement visible |
| [ ] | D3 | Documentation d'installation | Une installation à froid réussit en suivant le texte |

## Risques et parades

| Risque | Parade |
| --- | --- |
| L'envoi de raccourcis sous Windows dépend du focus de la fenêtre | Tester tôt (C1). Repli : profil fourni avec les actions natives Hotkey et Texte de Stream Deck |
| Modifier les réglages de Claude Code peut les abîmer | Sauvegarde avant écriture, fusion plutôt que remplacement, commande de retrait |
| Beaucoup d'événements d'outils en rafale | Regrouper les redessins pour ne pas saturer l'affichage |
| Réglages d'organisation qui limitent les hooks HTTP | Repli par script de commande « fire-and-forget » si l'URL est refusée |
| Versions minimales de Node et Stream Deck incertaines | Vérifié en A1 : 7.1 + Node 24 |
| L'app Claude et Cowork ne sont pas couverts par ces hooks | Traité en v4, après investigation |

## Critères d'acceptation de la v1

- [ ] Plusieurs sessions Claude Code en parallèle s'affichent chacune sur leur touche, avec le bon état
- [ ] Une session qui attend une permission ou une réponse fait clignoter le badge
- [ ] Les raccourcis, prompts et utilitaires fonctionnent depuis les touches
- [ ] La touche overlay ouvre l'overlay, et le push-to-talk y fait arriver le texte dicté
- [ ] Tout le visuel suit le style pixel Claude
- [ ] Arrêter le plugin ne gêne jamais Claude Code

## Ajustements de roadmap issus du plan

- L'état « Erreur » est faisable (échec d'outil et d'API exposés) → intégré à la machine à états v1.
- Modèle et effort actifs lisibles dans les hooks → 🟢 (affichage prévu en v2).
- Approuver / refuser via la réponse au hook, sans simuler le clavier → **proposition de remonter de v3 à v2, non tranchée** ; par défaut reste en v3.
