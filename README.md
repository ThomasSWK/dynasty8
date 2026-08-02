# Dynasty 8 — Site immobilier RP

Site statique une-page (HTML/CSS/JS, sans framework ni build) pour une agence immobilière RP, hébergé sur GitHub Pages. Les biens et le contenu de la page sont stockés dans des fichiers JSON (`content/*.json`), modifiables directement depuis le site via un espace admin protégé par mot de passe, qui enregistre les changements en committant sur GitHub.

## Structure

```
index.html               Page unique : accueil, biens (avec filtres par catégorie), agence, contact
assets/js/config.js       Dépôt GitHub cible (owner/repo/branch)
assets/js/utils.js        Utilitaires (échappement HTML)
assets/js/crypto-utils.js Hash SHA-256 (mot de passe admin)
assets/js/auth.js         Connexion admin + stockage du token GitHub
assets/js/github-api.js   Lecture/écriture des fichiers JSON via l'API GitHub
assets/js/site.js         Rendu de la page + logique admin (formulaires, filtres, galerie)
content/site.json         Contenu de la page (accroche, présentation, contact, logo)
content/listings.json     Liste de tous les biens (tous types confondus)
images/logo.png           Logo de l'agence
scripts/serve.ps1         Petit serveur local pour tester le site avant de le pousser
```

Chaque bien dans `content/listings.json` (tableau `items`) a la forme :
```json
{
  "id": "identifiant-unique",
  "category": "Appartement",
  "transaction": "Vente",
  "title": "Loft Vercetti",
  "location": "Vinewood Hills",
  "price": "2 400 $ / mois",
  "surface": "95",
  "pieces": "2",
  "sdb": "1",
  "desc": "Courte description du bien.",
  "images": ["https://...", "https://..."]
}
```
- `category` : `Appartement`, `Maison`, `Entrepôt` ou `Garage` — sert aux filtres de la page.
- `price` est du texte libre (vous choisissez le format : "85 000 $", "2 400 $ / mois", "À partir de 120 000 $", etc.).
- Les photos peuvent être **importées directement depuis votre ordinateur** (le formulaire admin les envoie dans `images/uploads/` du dépôt via l'API GitHub) **ou** être des liens externes (Imgur, Discord CDN, etc.) collés dans le champ "URLs". Les deux méthodes peuvent être combinées sur un même bien.

De la même façon, `content/site.json` a un champ `founder` (photo, nom, titre) affiché dans la section "L'agence" — la photo se met à jour depuis le formulaire "Modifier le contenu" (upload ou chemin manuel).

## Mise en route

### 1. Créer le dépôt GitHub et activer GitHub Pages

1. Créez un dépôt GitHub (public, sinon GitHub Pages nécessite un plan payant), poussez-y ce contenu.
2. Dans le dépôt : **Settings → Pages → Build and deployment → Source : "Deploy from a branch"**, branche `main`, dossier `/ (root)`.
3. Le site sera disponible à `https://VOTRE-PSEUDO.github.io/NOM-DU-DEPOT/`.

### 2. Configurer `assets/js/config.js`

Renseignez votre pseudo/organisation GitHub et le nom du dépôt :
```js
const DYNASTY8_CONFIG = {
  owner: "votre-pseudo-github",
  repo: "dynasty8-github",
  branch: "main",
};
```

### 3. Définir le mot de passe admin

Un mot de passe par défaut (`dynasty8`) est déjà configuré. Pour le changer :
1. Ouvrez le site dans un navigateur, ouvrez la console développeur (F12).
2. Exécutez : `await sha256Hex("votre-nouveau-mot-de-passe")`
3. Copiez le résultat affiché et collez-le dans `assets/js/auth.js`, à la place de `D8_PASSWORD_HASH`.

⚠️ Ce mot de passe protège uniquement l'affichage des boutons d'édition dans le navigateur — ce n'est pas une sécurité serveur. Ne l'utilisez pas pour protéger des données sensibles.

### 4. Créer un token GitHub pour l'admin

Pour que les modifications (biens, contenu de page) soient réellement enregistrées dans le dépôt, l'admin doit fournir un token GitHub la première fois qu'une modification est enregistrée :

1. Sur GitHub : **Settings (compte) → Developer settings → Fine-grained tokens → Generate new token**.
2. Limitez-le à ce dépôt uniquement (`Only select repositories` → choisir le dépôt du site).
3. Permissions : **Contents → Read and write**.
4. Générez et copiez le token.
5. Sur le site, une fois connecté en admin, dès qu'une action d'enregistrement est lancée (ajout/modification/suppression d'un bien, ou édition du contenu), une fenêtre demande de coller ce token. Il est ensuite conservé dans le navigateur (`localStorage`) — à ne faire que sur un appareil de confiance, et à ne jamais partager ce token.

### 5. Utilisation au quotidien

- Cliquez sur **🔒 Admin** dans le menu, entrez le mot de passe.
- Section "Nos biens" : bouton **+ Ajouter un bien**, et icônes ✎ (modifier) / ✕ (supprimer) sur chaque fiche (formulaire dédié).
- Reste de la page (accroche, présentation, coordonnées, pied de page, logo, photo/nom/titre de la fondatrice) : **édition directe sur la page**. Une fois connecté, ces textes sont cliquables et modifiables sur place (contour doré au survol), et les photos (logo, fondatrice) se remplacent en cliquant dessus. Une barre **"Enregistrer les modifications"** reste affichée en bas de l'écran tant que vous êtes en mode édition — cliquez dessus une fois vos changements terminés pour tout enregistrer en un seul commit.
- Chaque enregistrement (biens ou contenu) crée un commit sur le dépôt GitHub ; le site se met à jour en quelques dizaines de secondes le temps que GitHub Pages redéploie.

### 6. Tester en local avant de pousser

```
powershell -ExecutionPolicy Bypass -File scripts/serve.ps1
```
Puis ouvrez `http://localhost:8090`. La connexion admin fonctionne (le hash du mot de passe se vérifie localement), mais l'enregistrement réel des modifications nécessite que `config.js` pointe vers un vrai dépôt GitHub accessible avec votre token.

## Limites connues

- Pas de vraie authentification serveur : le mot de passe admin est vérifié côté navigateur (hash SHA-256 comparé localement). Convient pour un site RP, pas pour protéger des données sensibles.
- Le token GitHub donne accès en écriture au dépôt : à ne confier qu'à des admins de confiance, et à révoquer/régénérer en cas de doute (GitHub → Settings → Developer settings → Tokens).
- Deux admins qui enregistrent en même temps peuvent provoquer un conflit d'écriture (l'un des deux devra réessayer) — cas rare en usage normal.
