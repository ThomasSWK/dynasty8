// Accès admin par mot de passe simple (côté client — dissuasif, pas une vraie sécurité).
// Pour changer le mot de passe : ouvrez la console du navigateur et exécutez
//   await sha256Hex("votre-nouveau-mot-de-passe")
// puis collez le résultat ci-dessous dans D8_PASSWORD_HASH.
const D8_PASSWORD_HASH =
  "bae8ae4f388518c3746f6e018777bc5eb808800ee0ae2fbe175eef64c77b6fa9"; // mot de passe par défaut : "dynasty8"

const SESSION_KEY = "d8_admin_unlocked";
const TOKEN_KEY = "d8_gh_token";

function isAdmin() {
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

function getGithubToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setGithubToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

async function attemptLogin(password) {
  const hash = await sha256Hex(password);
  if (hash === D8_PASSWORD_HASH) {
    sessionStorage.setItem(SESSION_KEY, "1");
    return true;
  }
  return false;
}

function adminLogout() {
  sessionStorage.removeItem(SESSION_KEY);
  location.reload();
}

function ensureGithubToken() {
  let token = getGithubToken();
  if (!token) {
    token = prompt(
      "Collez votre token GitHub (accès en écriture sur le contenu de ce dépôt).\nIl est conservé uniquement dans ce navigateur (localStorage)."
    );
    if (token) setGithubToken(token.trim());
  }
  return getGithubToken();
}

function forgetGithubToken() {
  localStorage.removeItem(TOKEN_KEY);
}
