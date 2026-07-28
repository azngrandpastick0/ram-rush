import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTION = "ram_rush_storage";

export const storage = {
  async get(key) {
    const snap = await getDoc(doc(db, COLLECTION, key));
    if (!snap.exists()) {
      throw new Error(`Key not found: ${key}`);
    }
    return { key, value: snap.data().value, shared: true };
  },

  async set(key, value) {
    await setDoc(doc(db, COLLECTION, key), {
      value,
      updatedAt: Date.now(),
    });
    return { key, value, shared: true };
  },

  async delete(key) {
    await deleteDoc(doc(db, COLLECTION, key));
    return { key, deleted: true, shared: true };
  },

  // Fetches all docs and filters client-side — fine at league scale (12 managers).
  async list(prefix = "") {
    const snaps = await getDocs(collection(db, COLLECTION));
    const keys = [];
    snaps.forEach((d) => {
      if (d.id.startsWith(prefix)) keys.push(d.id);
    });
    return { keys, prefix, shared: true };
  },
};
