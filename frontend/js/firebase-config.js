const CONFIG_STORAGE_KEY = "gog-firebase-config";

const fileConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

export function getStoredFirebaseConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveFirebaseConfig(config) {
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function clearFirebaseConfig() {
  localStorage.removeItem(CONFIG_STORAGE_KEY);
}

export function getFirebaseConfig() {
  const stored = getStoredFirebaseConfig();
  if (isValidConfig(stored)) return stored;
  if (isValidConfig(fileConfig)) return fileConfig;
  return null;
}

export function isCloudSyncConfigured() {
  return getFirebaseConfig() !== null;
}

function isValidConfig(config) {
  return Boolean(
    config?.apiKey &&
      config?.projectId &&
      config.apiKey !== "YOUR_API_KEY" &&
      config.projectId !== "YOUR_PROJECT_ID"
  );
}

export function parseFirebaseConfigInput(raw) {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Paste your Firebase config first.");

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Invalid JSON. Copy the full firebaseConfig object from Firebase.");
  }

  const config = parsed.apiKey ? parsed : parsed.firebaseConfig || parsed.config;
  if (!isValidConfig(config)) {
    throw new Error("Config must include apiKey, authDomain, projectId, storageBucket, messagingSenderId, and appId.");
  }

  return config;
}

// Backwards compatibility for cloud-sync import
export const firebaseConfig = fileConfig;
export const cloudSyncEnabled = isCloudSyncConfigured();
