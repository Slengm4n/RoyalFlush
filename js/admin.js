import { auth, db, participantsCol, jokerRef, getParticipantDoc, getVoucherDoc, appId } from "./firebase.js";
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, doc,
    query, where, limit
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const gameStateRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'game_state');
let currentUser = null;

//CACHE DE DOM (Evita o JavaScript ficar procurando coisas no HTML repetidas vezes)
const domCache = {};
const el = (id) => {
    if (!domCache[id]) domCache[id] = document.getElementById(id);
    return domCache[id];
};

// --- EXPOSIÇÃO PARA O HTML ---
window.checkPassword = (e) => {
    e.preventDefault();
    const pwd = el('adminPassword').value;
    if (pwd === "royal2026") {
        sessionStorage.setItem('admin_auth_party', 'true');
        el('loginOverlay').style.display = 'none';
        if (!currentUser) initFirebase();
    } else {
        alert("Senha incorreta!");
        el('adminPassword').value = '';
    }
};

window.validateVoucher = async (e) => {
    e.preventDefault();
    const input = el('voucherInput');
    const statusDiv = el('voucherStatus');
    const code = input.value.trim().toUpperCase();

    if (!code) return;

    try {
        const vSnap = await getDoc(getVoucherDoc(code));

        if (vSnap.exists()) {
            const time = new Date(vSnap.data().usedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            statusDiv.innerHTML = `
                <div class="w-full bg-red-950/90 text-red-200 p-5 rounded-xl border-2 border-red-500 shadow-lg text-center animate-[popIn_0.3s_ease-out]">
                    <h3 class="font-black text-xl">JÁ UTILIZADO!</h3>
                    <p class="text-xs mt-1">Resgatado às <strong>${time}</strong>.</p>
                </div>`;
        } else if (code.startsWith('ROYAL-') || code.startsWith('MATCH-')) {
            await setDoc(getVoucherDoc(code), { usedAt: new Date().toISOString(), code });
            statusDiv.innerHTML = `
                <div class="w-full bg-green-950/90 text-green-200 p-5 rounded-xl border-2 border-green-500 shadow-lg animate-[popIn_0.3s_ease-out] text-center">
                    <h3 class="font-black text-xl">VÁLIDO! 🥂</h3>
                    <p class="text-xs mt-1">Pode servir o Shot Duplo!</p>
                </div>`;
        } else {
            statusDiv.innerHTML = `<p class="text-yellow-500 font-bold uppercase">Código Inválido</p>`;
        }
    } catch (err) {
        console.error(err);
        alert("Erro ao validar voucher. Verifique a conexão.");
    }
    input.value = '';
    input.focus();
};

window.randomizeJoker = async () => {
    if (!confirm("Transferir o Coringa para alguém aleatório?")) return;
    try {
        // Buscamos apenas quem não é coringa para sortear o próximo
        const candidatesQ = query(participantsCol, where("is_joker", "==", false));
        const candidatesSnap = await getDocs(candidatesQ);

        if (candidatesSnap.empty) return alert("Sem candidatos disponíveis na mesa!");

        // Buscamos o coringa atual
        const currentJokerQ = query(participantsCol, where("is_joker", "==", true), limit(1));
        const currentJokerSnap = await getDocs(currentJokerQ);

        // Se existe um coringa atual, damos-lhe uma carta aleatória nova
        if (!currentJokerSnap.empty) {
            const currentJokerDoc = currentJokerSnap.docs[0];
            const currentJokerId = currentJokerDoc.id;
            const playerData = currentJokerDoc.data();

            const suits = [
                { name: 'Copas', symbol: '♥️', color: '#b91c1c' },
                { name: 'Espadas', symbol: '♠', color: '#1a1a1a' },
                { name: 'Ouros', symbol: '♦', color: '#b91c1c' },
                { name: 'Trevos', symbol: '♣', color: '#1a1a1a' }
            ];
            const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

            const randomSuit = suits[Math.floor(Math.random() * suits.length)];
            const randomValue = values[Math.floor(Math.random() * values.length)];

            let targetText = "alguém";
            if (playerData.interest === 'f') targetText = "uma mulher";
            else if (playerData.interest === 'm') targetText = "um homem";

            await updateDoc(getParticipantDoc(currentJokerId), {
                is_joker: false,
                suitName: randomSuit.name,
                suitSymbol: randomSuit.symbol,
                cardValue: randomValue,
                color: randomSuit.color,
                suggestion: `Encontra ${targetText} com o naipe de ${randomSuit.name}!`
            });
        }

        const newJokerDoc = candidatesSnap.docs[Math.floor(Math.random() * candidatesSnap.docs.length)];
        const data = newJokerDoc.data();

        await updateDoc(getParticipantDoc(newJokerDoc.id), {
            is_joker: true,
            suitName: 'Coringa', suitSymbol: '🎭', cardValue: 'J', color: '#a855f7',
            suggestion: 'Você é o Caos! Encontre quem você quiser.'
        });

        await setDoc(jokerRef, { taken: true, winner: data.uid, name: data.name });
        alert(`Novo Coringa sorteado: ${data.name.toUpperCase()}`);
    } catch (e) { console.error(e); }
};

window.resetJoker = async () => {
    if (!confirm("Devolver Coringa ao baralho e remover do jogador atual?")) return;
    try {
        const currentJokerQ = query(participantsCol, where("is_joker", "==", true), limit(1));
        const currentJokerSnap = await getDocs(currentJokerQ);

        if (!currentJokerSnap.empty) {
            const currentJokerDoc = currentJokerSnap.docs[0];
            const currentJokerId = currentJokerDoc.id;
            const playerData = currentJokerDoc.data();

            // 1. Arrays do Baralho
            const suits = [
                { name: 'Copas', symbol: '♥️', color: '#b91c1c' },
                { name: 'Espadas', symbol: '♠', color: '#1a1a1a' },
                { name: 'Ouros', symbol: '♦', color: '#b91c1c' },
                { name: 'Trevos', symbol: '♣', color: '#1a1a1a' }
            ];
            const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

            // 2. Sorteio Aleatório
            const randomSuit = suits[Math.floor(Math.random() * suits.length)];
            const randomValue = values[Math.floor(Math.random() * values.length)];

            // 3. Montar a frase de sugestão baseada no interesse do utilizador
            let targetText = "alguém";
            if (playerData.interest === 'f') targetText = "uma mulher";
            else if (playerData.interest === 'm') targetText = "um homem";

            // 4. Atualizar o utilizador no Firebase com a nova carta
            await updateDoc(getParticipantDoc(currentJokerId), {
                is_joker: false,
                suitName: randomSuit.name,
                suitSymbol: randomSuit.symbol,
                cardValue: randomValue,
                color: randomSuit.color,
                suggestion: `Encontra ${targetText} com o naipe de ${randomSuit.name}!`
            });
        }
        await deleteDoc(jokerRef);
        alert("Coringa resetado e devolvido ao baralho!");
    } catch (e) { console.error(e); }
};
window.triggerEndGame = async () => {
    if (!confirm("🚨 Isso vai encerrar o jogo e exibir as estatísticas no telão. Tem certeza?")) return;
    try {
        await setDoc(gameStateRef, {
            isGameOver: true,
            endedAt: new Date().toISOString()
        });
        alert("🏁 Festa encerrada! Verifique o telão.");
    } catch (error) {
        console.error("Erro ao encerrar:", error);
        alert("Erro ao comunicar com o telão.");
    }
};

// --- INICIALIZAÇÃO ---
function initFirebase() {
    signInAnonymously(auth).catch(console.error);
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;

        onSnapshot(participantsCol, (snapshot) => {
            const totalEl = el('totalPlayers');
            if (totalEl) totalEl.innerText = snapshot.size;

            const grid = el('cardsGrid');
            if (!grid) return;

            let jokerFound = false;
            const jokerNameEl = el('jokerName');

            snapshot.docChanges().forEach(change => {
                const docId = change.doc.id;
                const d = change.doc.data();

                if (change.type === "added") {
                    grid.insertAdjacentHTML('beforeend', getMiniCardHTML(docId, d));
                }
                if (change.type === "modified") {
                    const existingCard = el(`admin-card-${docId}`);
                    if (existingCard && existingCard.parentNode) {
                        existingCard.outerHTML = getMiniCardHTML(docId, d);
                    } else {
                        console.log(`Card ${docId} está órfão ou sendo renderizado, pulando atualização de outerHTML.`);
                    }
                }
                if (change.type === "removed") {
                    const existingCard = el(`admin-card-${docId}`);
                    if (existingCard) existingCard.remove();
                }

                if (d.is_joker) {
                    jokerFound = true;
                    if (jokerNameEl) jokerNameEl.innerText = d.name;
                }
            });

            if (!jokerFound && jokerNameEl && snapshot.size > 0) {
                const hasJokerNow = snapshot.docs.some(doc => doc.data().is_joker);
                if (!hasJokerNow) jokerNameEl.innerText = "Ninguém tirou ainda";
            }
        });
    }
});

function getMiniCardHTML(docId, d) {
    const isJ = d.is_joker;
    const instaRaw = d.instagram || '';
    const instaClean = instaRaw.replace('@', '');
    const instaHTML = instaClean
        ? `<a href="https://instagram.com/${instaClean}" target="_blank" class="text-[10px] text-pink-400 hover:text-pink-300 mt-1 truncate w-full text-center" title="Ver Instagram"><i class="fab fa-instagram"></i> @${instaClean}</a>`
        : `<span class="text-[9px] text-gray-600 mt-1">Sem Insta</span>`;

    return `
        <div id="admin-card-${docId}" class="flex flex-col items-center w-[80px] animate-[popIn_0.3s_ease-out]">
            <div class="mini-card ${isJ ? 'joker-glow' : ''} bg-white hover:-translate-y-2 transition-transform duration-300" style="color: ${d.color}; border-color: var(--gold);">
                <span class="text-3xl font-black">${d.cardValue}</span>
                <span class="text-2xl mt-1">${d.suitSymbol}</span>
            </div>
            <span class="text-[11px] text-white mt-3 font-bold truncate w-full text-center bg-black/50 px-2 py-1 rounded">${d.name.split(' ')[0]}</span>
            ${instaHTML}
            <span class="text-[9px] text-gold font-mono mt-1">${d.matchCode}</span>
        </div>`;
}