import { auth, db, participantsCol, jokerRef, getParticipantDoc, getVoucherDoc, appId } from "./firebase.js";
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, doc,
    query, where, limit 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const gameStateRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'game_state');
let currentUser = null;

// 🔥 CACHE DE DOM (Evita o JavaScript ficar procurando coisas no HTML repetidas vezes)
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
        // 🔥 OTIMIZAÇÃO: Buscamos apenas quem não é coringa para sortear
        const candidatesQ = query(participantsCol, where("is_joker", "==", false));
        const candidatesSnap = await getDocs(candidatesQ);
        
        if (candidatesSnap.empty) return alert("Sem candidatos disponíveis na mesa!");

        // 🔥 OTIMIZAÇÃO: Buscamos o coringa atual direto ao ponto
        const currentJokerQ = query(participantsCol, where("is_joker", "==", true), limit(1));
        const currentJokerSnap = await getDocs(currentJokerQ);

        if (!currentJokerSnap.empty) {
            const currentJokerId = currentJokerSnap.docs[0].id;
            await updateDoc(getParticipantDoc(currentJokerId), {
                is_joker: false, 
                suitName: 'Trevos', suitSymbol: '♣', cardValue: '2', color: '#1a1a1a',
                suggestion: 'Encontre alguém com o naipe de Trevos!'
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
        // 🔥 OTIMIZAÇÃO: Vai direto no documento do Coringa em vez de baixar todos
        const currentJokerQ = query(participantsCol, where("is_joker", "==", true), limit(1));
        const currentJokerSnap = await getDocs(currentJokerQ);
        
        if (!currentJokerSnap.empty) {
            const currentJokerId = currentJokerSnap.docs[0].id;
            await updateDoc(getParticipantDoc(currentJokerId), { 
                is_joker: false,
                suitName: 'Trevos', suitSymbol: '♣', cardValue: '2', color: '#1a1a1a',
                suggestion: 'Encontre ALGUÉM com o naipe de Trevos!'
            });
        }
        await deleteDoc(jokerRef);
        alert("Coringa resetado e devolvido ao baralho!");
    } catch (e) { console.error(e); }
};

window.triggerEndGame = async () => {
    if (!confirm("🚨 ATENÇÃO: Isso vai encerrar o jogo e exibir as estatísticas finais no telão. Todo mundo vai ver. Tem certeza?")) return;
    try {
        await setDoc(gameStateRef, { isGameOver: true, endedAt: new Date().toISOString() });
        alert("🏁 Festa encerrada com sucesso! Olhe para o telão.");
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
        
        // --- OUVINTE DA GRID OTIMIZADO ---
        onSnapshot(participantsCol, (snapshot) => {
            const totalEl = el('totalPlayers');
            if (totalEl) totalEl.innerText = snapshot.size;
            
            const grid = el('cardsGrid');
            if (!grid) return;

            let jokerFound = false;
            const jokerNameEl = el('jokerName');

            // 🔥 MÁGICA DE PERFORMANCE: Só atualiza o que mudou (docChanges)
            snapshot.docChanges().forEach(change => {
                const docId = change.doc.id;
                const d = change.doc.data();

                if (change.type === "added") {
                    grid.insertAdjacentHTML('beforeend', getMiniCardHTML(docId, d));
                }
                if (change.type === "modified") {
                    const existingCard = el(`admin-card-${docId}`);
                    if (existingCard) existingCard.outerHTML = getMiniCardHTML(docId, d);
                }
                if (change.type === "removed") {
                    const existingCard = el(`admin-card-${docId}`);
                    if (existingCard) existingCard.remove();
                }

                // Verifica o Coringa
                if (d.is_joker) {
                    jokerFound = true;
                    if (jokerNameEl) jokerNameEl.innerText = d.name;
                }
            });

            // Se o coringa foi resetado/removido
            if (!jokerFound && jokerNameEl && snapshot.size > 0) {
                // Passa rapidamente pelos atuais só para garantir
                const hasJokerNow = snapshot.docs.some(doc => doc.data().is_joker);
                if(!hasJokerNow) jokerNameEl.innerText = "Ninguém tirou ainda";
            }
        });
    }
});

// 🔥 OTIMIZAÇÃO: Função separada apenas para gerar o HTML da cartinha (com ID único para o DOM achar rápido)
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