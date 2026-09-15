const fs = require("node:fs");
const path = require("node:path");
const { app, safeStorage } = require("electron");

// "Se souvenir de moi" : le refresh_token Microsoft est chiffre au repos
// avec safeStorage (Coffre Windows / Keychain macOS / libsecret Linux),
// jamais stocke en clair (voir cahier des charges, risque "securite du
// stockage local").
const SESSION_FILE = path.join(app.getPath("userData"), "session.bin");

function saveRefreshToken(refreshToken) {
  if (!safeStorage.isEncryptionAvailable()) return false;
  const encrypted = safeStorage.encryptString(refreshToken);
  fs.writeFileSync(SESSION_FILE, encrypted);
  return true;
}

function loadRefreshToken() {
  if (!fs.existsSync(SESSION_FILE) || !safeStorage.isEncryptionAvailable()) return null;
  try {
    const encrypted = fs.readFileSync(SESSION_FILE);
    return safeStorage.decryptString(encrypted);
  } catch {
    return null;
  }
}

function clearRefreshToken() {
  if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
}

module.exports = { saveRefreshToken, loadRefreshToken, clearRefreshToken };
