import { firebaseConfig, cloudSyncEnabled } from "./firebase-config.js";
import { exportUserData, applyRemoteUserData } from "./storage.js";

const FIREBASE_VERSION = "11.0.2";

let auth = null;
let db = null;
let currentUser = null;
let unsubscribeSnapshot = null;
let pushTimer = null;
let isApplyingRemote = false;

let onRemoteUpdate = () => {};
let onAuthChange = () => {};

let pushToCloudFn = null;

export function isCloudSyncAvailable() {
  return cloudSyncEnabled;
}

export function notifyCloudPush() {
  if (currentUser && pushToCloudFn) pushToCloudFn();
}

async function loadFirebase() {
  const appMod = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`);
  const authMod = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`);
  const fsMod = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);

  const app = appMod.initializeApp(firebaseConfig);
  auth = authMod.getAuth(app);
  db = fsMod.getFirestore(app);

  return { authMod, fsMod };
}

function schedulePush(fsMod) {
  if (!currentUser || isApplyingRemote) return;

  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushNow(fsMod), 800);
}

async function pushNow(fsMod) {
  if (!currentUser || isApplyingRemote) return;

  const payload = exportUserData();
  await fsMod.setDoc(fsMod.doc(db, "users", currentUser.uid), {
    ...payload,
    email: currentUser.email || null,
  });
}

async function startListener(fsMod) {
  if (unsubscribeSnapshot) unsubscribeSnapshot();

  const userDoc = fsMod.doc(db, "users", currentUser.uid);
  const existing = await fsMod.getDoc(userDoc);

  if (!existing.exists()) {
    await pushNow(fsMod);
  }

  unsubscribeSnapshot = fsMod.onSnapshot(userDoc, (snap) => {
    if (!snap.exists()) return;

    const data = snap.data();
    isApplyingRemote = true;
    applyRemoteUserData({
      version: 1,
      favorites: data.favorites || [],
      failedLinks: data.failedLinks || [],
    });
    isApplyingRemote = false;
    onRemoteUpdate();
  });
}

export async function initCloudSync(handlers) {
  if (!cloudSyncEnabled) return false;

  onRemoteUpdate = handlers.onRemoteUpdate || onRemoteUpdate;
  onAuthChange = handlers.onAuthChange || onAuthChange;

  const { authMod, fsMod } = await loadFirebase();

  pushToCloudFn = () => schedulePush(fsMod);

  authMod.onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    if (user) {
      await startListener(fsMod);
    } else if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }

    onAuthChange(user);
  });

  return true;
}

export async function signInWithGoogle() {
  if (!cloudSyncEnabled) {
    throw new Error("Cloud sync is not configured yet.");
  }

  const { authMod } = await loadFirebase();
  const provider = new authMod.GoogleAuthProvider();
  await authMod.signInWithPopup(auth, provider);
}

export async function signOutUser() {
  if (!auth) return;
  const { signOut } = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`);
  await signOut(auth);
}

export function getCurrentUser() {
  return currentUser;
}
