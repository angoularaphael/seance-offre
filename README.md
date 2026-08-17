# Séance d'essai offerte — Boxing Center

Page de conversion pour l'opération « séance d'essai offerte ».
Direction livrée : **A — Le coin.**

---

## Lancer

```bash
npm install && npm run dev
```

<http://localhost:5610>

Front Vite + API `/api/inscrire` (port 5611, proxifié). Page live : https://bc-seance-offerte.vercel.app/

```bash
npm run build
npm test
npm run test:e2e
npm run test:e2e:vercel
```

Dry-run : `?test=1`. Smoke Deciplus : `npm run smoke:deciplus` (fiches `TestOfferte`, nettoyage BOXPLUS `npm run cleanup:test`). Copier `.env.example` vers `.env`.

```bash
npm run build
```

Sort dans `dist/` — HTML, CSS et JS statiques, rien d'autre. Prêt pour Vercel
(`vercel.json` fournit déjà la commande de build, les en-têtes de cache et le
`X-Robots-Tag: noindex`).

## Direction

Page livrée en **A — Le coin**. Le sélecteur de maquette (A / B / C) et le libellé de source (« Accès direct ») ne sont plus affichés. Le traçage `?src=` reste actif, sans pastille à l'écran.

La cloche de fin de round reste désactivée par défaut.

## Tester le traçage des sources (§18)

Chaque QR imprimé portera son paramètre. La source est mémorisée pour la session et suit le lead ; elle n'est plus affichée sur la page.

```bash
start "" "http://localhost:5610/?src=flyer&dir=a"
```

Sources reconnues : `flyer` · `affiche` · `porte` · `print` · `meta` · `story` · `fb` · `wa`.

Événements poussés dans `window.dataLayer` (et affichés en console en dev) :
`page_vue`, `cta_clic`, `salle_choisie`, `jour_choisi`, `formulaire_commence`,
`etape_atteinte`, `etape_bloquee`, `etape_abandonnee`, `ami_ajoute`,
`formulaire_valide`. Le branchement GA4 / Meta se pose sur `track()` dans
`src/js/track.js`, nulle part ailleurs.

---

## Les trois directions

**A — Le coin.** Le moment le plus humain de la boxe n'est pas l'affrontement :
ce sont les soixante secondes entre deux rounds où quelqu'un pose une main sur
ton épaule. La page est ce coin, et **la lumière y est le mécanisme de lecture**
— pas un ornement. La flaque descend avec le défilement et se pose sur la
section qu'on lit, en la devançant légèrement ; le faisceau s'incline pour
rester pointé dessus ; **une section reste éteinte tant que la lumière ne
l'atteint pas**. Au passage d'un round, la pancarte du speaker entre par la
gauche — `ROUND 03 · TA SALLE` — tient une seconde et repart.

**B — Le laissez-passer.** Tout le trafic vient d'un objet qu'on a tenu dans la
main. La page est ce titre d'accès — papier, guilloche, souche détachable,
perforation, tampon encré — et chaque étape du formulaire en remplit une ligne.

**C — La première fois.** Les quarante-cinq premières minutes, horodatées.
Chaque chapitre tue une peur nommée par la recherche.

## Le moteur (commun aux trois)

| | |
|---|---|
| Premier écran | 64 % des mobiles ne dépassent jamais le premier écran : marque, offre, ancre de prix, bénéfice, action et preuves y tiennent |
| Barre collante | +11 à +20,4 % mesurés · cible ≥ 52 px |
| Formulaire | 6 respirations · les 2 premières se touchent, aucune frappe · 13,85 % contre 4,53 % pour un formulaire d'un bloc |
| Champs coûteux | naissance et sexe en **dernier**, après l'engagement, avec leur raison affichée |
| Objections | 8 peurs dites dans les mots du prospect, puis rayées ligne à ligne |
| Plannings | l'affiche officielle de la salle retenue, agrandissable · les jours ne servent qu'au choix, jamais d'horaire inventé |
| Binôme | section propre — « venir seul » est le frein social documenté n°1 |
| Un seul rouge | le rouge appartient au 0 € et au bouton principal. Rien d'autre. |
| Rythme | le cadrage ne porte ni photo ni bouton — un aplat noir et une phrase, pour que la page se taise une fois ; le binôme passe pleine largeur. Huit sections bâties sur le même moule donnent une liste, pas une page. |
| Les portes | cinq salles pleine hauteur ; celle qu'on survole s'ouvre et prend la place des autres. Le fait ne s'affiche que sur la porte ouverte — à cinq de front, personne n'en lit une seule. |

## Structure

```
index.html            squelette : lumière, rail, barre collante, outils
vercel.json           build, cache, X-Robots-Tag noindex
public/fonts/         Bebas Neue · Montserrat · JetBrains Mono (sous-ensembles latins)
public/img/           18 visuels réels, webp, 3 largeurs + LQIP
public/robots.txt     Disallow: / — circuit fermé
src/js/
  main.js             montage des sections, bascule de direction
  data.js             contenu — chaque affirmation tracée à sa source
  form.js             les 6 respirations + validation française
  light.js            le cône, le suivi, la poussière (canvas)
  rounds.js           le rail, l'avancement, la cloche
  reveal.js           révélations + chargement des images
  audio.js            cloche et choc, synthétisés, zéro octet
  track.js            ?src=, numéro de pass, événements
  ui.js               échappement, images responsives
src/styles/
  tokens.css base.css layout.css
  components/  light rounds button dock form pass
  sections/    hero fears salles planning duo proof foot
  directions/  a b c
```

## Mesuré, pas supposé

| | mobile 390 | desktop 1280 |
|---|---|---|
| Premier écran | 384 Ko | 316 Ko |
| LCP | 1 640 ms | 296 ms |

Contraste : 12/12 au niveau AA. Clavier : 14 éléments parcourus, tous avec
contour visible. Mouvement réduit : rien ne reste caché.

Trois scripts d'audit vivent dans le dossier de travail (non versionnés) :
un audit de rendu sur 3 directions × 2 formats, un rejeu du tunnel complet
dans un vrai navigateur, et un contrôle contraste/clavier/poids.

## Règles de robustesse tenues ici

1. **Rien ne se cache sans certitude de pouvoir se montrer.** Les états masqués
   ne vivent que sous `html.lit:not(.shown)` ; sans script, la page s'affiche
   entière. Un verrou `html.settled` force l'état final après 3 s.
2. **Aucun `animation-fill-mode: both` sur du contenu.** Une animation qui ne
   démarre pas fige son image de départ : c'est un texte invisible en
   production. L'allumage du néon est piloté par minuteurs.
3. **`[hidden]` est absolu** (`display: none !important`) — sinon un
   `display: grid` d'auteur le contredit.
4. **La barre collante a deux mécaniques** : observateur d'intersection, plus
   un secours au défilement.

## Ce qui est réel, ce qui ne l'est pas

| | |
|---|---|
| ✅ Réel | Les 5 visuels et faits des salles (cartes officielles de la boutique) · **les 9 affiches planning officielles du club** (saison 2026-2027, couleur par discipline, sans nom de coach) · les 18 photos de salle · les avis Google Minimes (4,3/5 · 157 avis) · les 8 champs Deciplus · palette, logo et polices du brand book |
| ⚠️ Exemple | Les horaires des chapitres de la direction C (illustratifs, à valider) |
| ❌ Écarté | Les 3 images générées par IA du dossier source — interdites par le brand book p.5 · les photos de sparring casqué — registre « combattants » interdit sur cette page · les adresses des salles — aucune source fiable pour les cinq, donc rien d'inventé |

Aucune donnée n'est envoyée : la validation du formulaire est simulée.

Le raisonnement complet, les chiffres et les neuf contradictions relevées dans
le cahier des charges sont dans `.research/00-SYSTEME.md` (non versionné).
