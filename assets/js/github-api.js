// Lecture/écriture des fichiers JSON de données via l'API Contents de GitHub.
// Permet à une page 100% statique (GitHub Pages) d'enregistrer des modifications
// directement dans le dépôt, sans backend, à condition qu'un token admin soit fourni.
const GH_API = "https://api.github.com";

function ghHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function b64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
}

function utf8ToB64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

async function ghGetFile(path) {
  const token = getGithubToken();
  const url = `${GH_API}/repos/${DYNASTY8_CONFIG.owner}/${DYNASTY8_CONFIG.repo}/contents/${path}?ref=${DYNASTY8_CONFIG.branch}`;
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (!res.ok) {
    throw new Error(`Impossible de lire ${path} (${res.status})`);
  }
  const data = await res.json();
  return { sha: data.sha, json: JSON.parse(b64ToUtf8(data.content)) };
}

async function ghPutFile(path, newData, message, sha) {
  const token = getGithubToken();
  if (!token) throw new Error("Token GitHub manquant.");
  const url = `${GH_API}/repos/${DYNASTY8_CONFIG.owner}/${DYNASTY8_CONFIG.repo}/contents/${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...ghHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: utf8ToB64(JSON.stringify(newData, null, 2)),
      sha,
      branch: DYNASTY8_CONFIG.branch,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Échec de l'enregistrement (${res.status})`);
  }
  return res.json();
}
