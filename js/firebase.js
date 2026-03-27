
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    collection,
    query,
    where,
    getDocs,
    enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


const firebaseConfig = {
    apiKey: "AIzaSyC8Do2gBZFllqUvVScL24lh99g_T-3qX94",
    authDomain: "royalflush-a2542.firebaseapp.com",
    projectId: "royalflush-a2542",
    storageBucket: "royalflush-a2542.firebasestorage.app",
    messagingSenderId: "928142170599",
    appId: "1:928142170599:web:d5568ae550a892dc544542"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const appId = 'festa-royal-flush';

export const participantsCol = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
export const vouchersCol = collection(db, 'artifacts', appId, 'public', 'data', 'vouchers');
export const matchesCol = collection(db, 'artifacts', appId, 'public', 'data', 'matches');
export const jokerRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'joker_status');
export const gameStateRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'game_state');

export const getParticipantDoc = (id) => doc(db, 'artifacts', appId, 'public', 'data', 'participants', id);
export const getVoucherDoc = (code) => doc(db, 'artifacts', appId, 'public', 'data', 'vouchers', code);

export async function findParticipantByCode(code) {
    const q = query(participantsCol, where("matchCode", "==", code));
    const snap = await getDocs(q);

    if (snap.empty) return null;
    return snap.docs[0].data();
}

enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn("Múltiplas abas abertas. Persistência offline funciona apenas em uma aba por vez.");
    } else if (err.code == 'unimplemented') {
        console.warn("O navegador atual não suporta persistência offline.");
    }
});