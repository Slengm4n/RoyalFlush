import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// Atalhos Globais de Caminhos (Paths)
export const appId = 'festa-royal-flush';
export const participantsCol = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
export const jokerRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'joker_status');
export const vouchersCol = collection(db, 'artifacts', appId, 'public', 'data', 'vouchers');

// Funções de Referência de Documentos
export const getParticipantDoc = (id) => doc(db, 'artifacts', appId, 'public', 'data', 'participants', id);

/**
 * 🔥 CORREÇÃO: Exportando a função getVoucherDoc
 */
export const getVoucherDoc = (code) => doc(db, 'artifacts', appId, 'public', 'data', 'vouchers', code);

import { query, where, getDocs } from 
"https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * 🔎 Busca participante pelo matchCode (SEM scan manual)
 */
export async function findParticipantByCode(code) {

    const q = query(participantsCol, where("matchCode", "==", code));

    const snap = await getDocs(q);

    if (snap.empty) return null;

    return snap.docs[0].data();
}