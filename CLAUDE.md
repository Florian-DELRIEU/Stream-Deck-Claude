# Plugin Stream Deck pour Claude — instructions du projet

Ce fichier est lu automatiquement par Claude Code. Il résume le projet et renvoie vers les documents détaillés de `docs/`. Rien de ce qui a été décidé en phase de cadrage ne doit être perdu : en cas de doute, relis `docs/`.

## Objectif

Faire du Stream Deck de Florian un tableau de bord physique de Claude : voir où Claude travaille, où il a besoin de lui, la consommation, les sujets en cours, et déclencher des raccourcis. Le plugin est construit de zéro (pas de fork d'un projet existant).

## Contexte fixe

- Utilisateur : Florian, francophone. Parle-lui en français, en le tutoyant.
- Matériel : Stream Deck v2 **à touches**. Pas de molette, pas d'écran LCD. Le nombre de touches est sans importance : le plugin fournit des actions, Florian les place où il veut. C'est lui qui choisit combien de sessions il affiche (en posant l'action « session » autant de fois qu'il veut).
- Système : **Windows**. Tout doit marcher sous Windows (chemins, shell, envoi de raccourcis, focus de fenêtre).
- Cible : Claude Code d'abord (terminal et app desktop, via les hooks). L'app Claude Windows et Cowork sont aussi visés, mais en v4 et seulement si une source d'état exploitable existe.
- Priorités à égalité : savoir où Claude a besoin de lui, la consommation, les raccourcis.
- Style : thème Claude / Claude Code en **pixel art** (palette chaude sur fond sombre, police bitmap, rendu net sans lissage, esprit terminal, cadre commun). Sprites et symboles à créer en original, sans reprendre les logos officiels.
- Inspiration principale : AgentDeck de puritysb (post r/elgato), voir `docs/SOURCES.md`.

## Documents à lire (dans cet ordre)

1. `docs/DECISIONS.md` : décisions prises, point encore ouvert, idées écartées.
2. `docs/PLAN-V1.md` : plan détaillé de la v1 (faits vérifiés, composants, machine à états, tâches A1 à D3, risques, critères d'acceptation). **C'est le document de travail.**
3. `docs/ROADMAP.md` : roadmap v1 à v5 avec la faisabilité de chaque fonction, et le catalogue complet des affichages, actions et éléments de style.
4. `docs/SOURCES.md` : projets existants, idées reprises, liens.

Le document source vivant est dans claude.ai : « Plugin Stream Deck pour Claude — options retenues » (https://claude.ai/code/artifact/9152aa47-a78e-4305-9a27-aef8e962f446). Les fichiers de `docs/` en sont un instantané au 2026-10-15 ; en cas de divergence, signale-la à Florian.

## État actuel

- Cadrage : terminé.
- Plan v1 : **validé par Florian le 2026-10-15**.
- Jalon A (fondations) : **fait le 2026-10-15** (A2, A3, A4 vérifiés par les tests ; A1 compilé, validé et empaqueté, apparition dans Stream Deck à confirmer par Florian sous Windows).
- Prochaine étape : jalon B, tâche **B1** (moteur de rendu pixel).
- Code : `README.md` (installation, commandes, organisation de `src/`). Tests : `npm test`.

## Architecture en une phrase

Hooks HTTP de Claude Code → serveur local hébergé par le plugin → gestionnaire de sessions + machine à états → moteur de rendu pixel → touches du Stream Deck. Le serveur répond toujours immédiatement et ne bloque jamais Claude Code.

## Règles de travail

- Suis les jalons du plan v1 dans l'ordre : A (fondations), B (affichage), C (actions), D (finition). Tâche par tâche (A1, A2…). Vérifie le critère de réussite de chaque tâche avant de passer à la suivante, et coche-la dans `docs/PLAN-V1.md`.
- Vérifie les points marqués « à vérifier » avant de t'y appuyer : versions minimales de Node et du logiciel Stream Deck (A1), envoi de raccourcis clavier sous Windows (C1).
- Si un skill `elgato-plugin` est disponible dans la session, charge-le avant A1.
- Ne modifie le fichier de réglages utilisateur de Claude Code (`%USERPROFILE%\.claude\settings.json`) qu'avec sauvegarde préalable, fusion (jamais remplacement) et commande de retrait.
- Ne retire aucune fonctionnalité de la roadmap sans en parler à Florian. Si une idée ne tient pas, note-la dans `docs/DECISIONS.md` avec la raison.
- Quand une information technique change la faisabilité d'une fonction, mets à jour `docs/ROADMAP.md` (emoji) et dis-le.
- Faisabilité : 🟢 facile et bien documenté · 🟡 faisable avec effort ou à valider · 🟠 incertain · 🔴 non fiable ou non exposé.
- Aucun secret ni chemin personnel en dur : les réglages passent par l'inspecteur de propriétés.
- Réponses issues de recherches web : ajoute un court paragraphe sur la concordance ou la divergence des sources.
- Tableaux comparatifs : emojis bienvenus quand ils aident, toujours avec une légende.

## Format de fin de tour

Quand tu t'arrêtes en attendant une suite de Florian, termine par ce bloc :

- **Fait** : ce qui vient d'être terminé.
- **Urgence** : 🔴 bloquant / 🟠 nécessaire / 🟡 pas obligatoire / ⚪ informatif.
- **Nature** : valider, décider, tester, info manquante, action externe, clarifier, relire, info pure.
- **Ce qu'il te faut** : la question ou l'action précise.
- **Si pas de réponse** : ce que tu feras par défaut.

## Commandes de Florian

- `!plan` : ne pas exécuter, donner seulement le plan puis attendre la validation.
- `!contexte` : inventaire complet de ce qui est en contexte.
- `!modele` : recommander le modèle et l'effort adaptés à la demande, sans la traiter.

## Méthode de Florian (4 phases)

Cadrage (fait) → plan / cahier des charges (fait pour la v1) → **exécution (maintenant)** → peaufinage. Un modèle rapide suffit pour les tâches bornées ; garder un modèle plus capable pour les points d'architecture délicats (serveur, machine à états, installeur de hooks, canal de retour en v2/v3).
