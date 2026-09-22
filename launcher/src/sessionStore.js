const fs = require("node:fs");
const path = require("node:path");
const { app, safeStorage } = require("electron");

// "Se souvenir de moi" : les refresh_token Microsoft de chaque compte
// mémorisé sont chiffrés au repos avec safeStorage (Coffre Windows /
// Keychain macOS / libsecret Linux), jamais stockés en clair — voir cahier
// des charges, risque "sécurité du stockage local". Un seul fichier chiffré
// contient la liste des comptes mémorisés (multi-compte) plutôt qu'un jeton
// unique, pour permettre de basculer entre plusieurs comptes Microsoft.
const ACCOUNTS_FILE = path.join(app.getPath("userData"), "accounts.bin");

function loadAccounts() {
  if (!fs.existsSync(ACCOUNTS_FILE) || !safeStorage.isEncryptionAvailable()) {
    return { accounts: [], activeId: null };
  }
  try {
    const encrypted = fs.readFileSync(ACCOUNTS_FILE);
    const parsed = JSON.parse(safeStorage.decryptString(encrypted));
    return {
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      activeId: parsed.activeId ?? null,
    };
  } catch {
    return { accounts: [], activeId: null };
  }
}

function saveAccounts(state) {
  if (!safeStorage.isEncryptionAvailable()) return false;
  const encrypted = safeStorage.encryptString(JSON.stringify(state));
  fs.writeFileSync(ACCOUNTS_FILE, encrypted);
  return true;
}

// Enregistre/actualise le refresh_token d'un compte — identifie par son
// UUID Minecraft (stable, unique par joueur) — et le marque actif. Utilise
// aussi bien pour un premier "se souvenir de moi" que pour rafraichir le
// jeton d'un compte deja memorise.
function rememberAccount(id, name, refreshToken) {
  const state = loadAccounts();
  const others = state.accounts.filter((a) => a.id !== id);
  const next = { accounts: [...others, { id, name, refreshToken }], activeId: id };
  return saveAccounts(next) ? next : null;
}

// Retire un compte de la liste memorisee (ex: refresh_token revoque cote
// Microsoft, ou le joueur choisit explicitement de l'oublier).
function forgetAccount(id) {
  const state = loadAccounts();
  const accounts = state.accounts.filter((a) => a.id !== id);
  const activeId = state.activeId === id ? null : state.activeId;
  saveAccounts({ accounts, activeId });
  return { accounts, activeId };
}

// Deconnexion : n'oublie pas le compte (il reste dans la liste, pour un
// retour rapide), juste desactive la reprise automatique au prochain
// demarrage.
function clearActiveAccount() {
  const state = loadAccounts();
  if (state.activeId === null) return state;
  const next = { ...state, activeId: null };
  saveAccounts(next);
  return next;
}

module.exports = { loadAccounts, rememberAccount, forgetAccount, clearActiveAccount };
