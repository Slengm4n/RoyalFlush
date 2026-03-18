import { auth, db, participantsCol, jokerRef, vouchersCol, getParticipantDoc, getVoucherDoc } from "./firebase.js";
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let currentUser = null;

// --- EXPOSIÇÃO PARA O HTML ---
window.checkPassword = (e) => {
    e.preventDefault();
    const pwd = document.getElementById('adminPassword').value;
    if (pwd === "royal2026") {
        sessionStorage.setItem('admin_auth_party', 'true');
        document.getElementById('loginOverlay').style.display = 'none';
        if (!currentUser) initFirebase();
    } else {
        alert("Senha incorreta!");
        document.getElementById('adminPassword').value = '';
    }
};

window.validateVoucher = async (e) => {
    e.preventDefault();
    const input = document.getElementById('voucherInput');
    const statusDiv = document.getElementById('voucherStatus');
    const code = input.value.trim().toUpperCase();

    if (!code) return;

    try {
        const vSnap = await getDoc(getVoucherDoc(code));

        if (vSnap.exists()) {
            const time = new Date(vSnap.data().usedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            statusDiv.innerHTML = `
                <div class="w-full bg-red-950/90 text-red-200 p-5 rounded-xl border-2 border-red-500 shadow-lg text-center">
                    <h3 class="font-black text-xl">JÁ UTILIZADO!</h3>
                    <p class="text-xs mt-1">Resgatado às <strong>${time}</strong>.</p>
                </div>`;
        } else if (code.startsWith('ROYAL-') || code.startsWith('MATCH-')) {
            await setDoc(getVoucherDoc(code), { usedAt: new Date().toISOString(), code });
            statusDiv.innerHTML = `
                <div class="w-full bg-green-950/90 text-green-200 p-5 rounded-xl border-2 border-green-500 shadow-lg animate-pulse text-center">
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
        const snap = await getDocs(participantsCol);
        const candidates = snap.docs.filter(d => !d.data().is_joker);
        const currentJoker = snap.docs.find(d => d.data().is_joker);

        if (candidates.length === 0) return alert("Sem candidatos disponíveis na mesa!");

        if (currentJoker) {
            await updateDoc(getParticipantDoc(currentJoker.id), {
                is_joker: false, 
                suitName: 'Trevos', 
                suitSymbol: '♣', 
                cardValue: '2', 
                color: '#1a1a1a',
                suggestion: 'Encontre alguém com o naipe de Trevos!'
            });
        }

        const newJokerDoc = candidates[Math.floor(Math.random() * candidates.length)];
        const data = newJokerDoc.data();
        await updateDoc(getParticipantDoc(newJokerDoc.id), {
            is_joker: true, 
            suitName: 'Coringa', 
            suitSymbol: '🎭', 
            cardValue: 'J', 
            color: '#a855f7',
            suggestion: 'Você é o Caos! Encontre quem você quiser.'
        });
        await setDoc(jokerRef, { taken: true, winner: data.uid, name: data.name });
        alert(`Novo Coringa sorteado: ${data.name.toUpperCase()}`);
    } catch (e) { console.error(e); }
};

window.resetJoker = async () => {
    if (!confirm("Devolver Coringa ao baralho e remover do jogador atual?")) return;
    try {
        const snap = await getDocs(participantsCol);
        const currentJoker = snap.docs.find(d => d.data().is_joker);
        
        if (currentJoker) {
            // CORREÇÃO: Transforma a carta de volta numa carta perfeitamente normal!
            await updateDoc(getParticipantDoc(currentJoker.id), { 
                is_joker: false,
                suitName: 'Trevos', 
                suitSymbol: '♣', 
                cardValue: '2', 
                color: '#1a1a1a',
                suggestion: 'Encontre ALGUÉM com o naipe de Trevos!'
            });
        }
        await deleteDoc(jokerRef);
        alert("Coringa resetado e devolvido ao baralho!");
    } catch (e) { console.error(e); }
};

// --- INICIALIZAÇÃO ---
function initFirebase() {
    signInAnonymously(auth).catch(console.error);
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        onSnapshot(participantsCol, (snapshot) => {
            const grid = document.getElementById('cardsGrid');
            const total = document.getElementById('totalPlayers');
            const jokerName = document.getElementById('jokerName');

            // Verifica se o elemento existe antes de alterar para evitar o erro "null"
            if (total) total.innerText = snapshot.size;
            if (grid) grid.innerHTML = '';
            
            let jokerFound = false;

            snapshot.forEach(doc => {
                const d = doc.data();
                if (d.is_joker) {
                    if (jokerName) jokerName.innerText = d.name;
                    jokerFound = true;
                }
                if (grid) renderMiniCard(grid, d);
            });

            // Verifica se o elemento existe antes de alterar
            if (!jokerFound && jokerName) jokerName.innerText = "Ninguém tirou ainda";
        });
    }
});

function renderMiniCard(container, d) {
    const isJ = d.is_joker;
    
    const instaRaw = d.instagram || '';
    const instaClean = instaRaw.replace('@', '');
    const instaHTML = instaClean 
        ? `<a href="https://instagram.com/${instaClean}" target="_blank" class="text-[10px] text-pink-400 hover:text-pink-300 mt-1 truncate w-full text-center" title="Ver Instagram"><i class="fab fa-instagram"></i> @${instaClean}</a>` 
        : `<span class="text-[9px] text-gray-600 mt-1">Sem Insta</span>`;

    const html = `
        <div class="flex flex-col items-center w-[80px]">
            <div class="mini-card ${isJ ? 'joker-glow' : ''} bg-white hover:-translate-y-2 transition-transform duration-300" style="color: ${d.color}; border-color: var(--gold);">
                <span class="text-3xl font-black">${d.cardValue}</span>
                <span class="text-2xl mt-1">${d.suitSymbol}</span>
            </div>
            <span class="text-[11px] text-white mt-3 font-bold truncate w-full text-center bg-black/50 px-2 py-1 rounded">${d.name.split(' ')[0]}</span>
            ${instaHTML}
            <span class="text-[9px] text-gold font-mono mt-1">${d.matchCode}</span>
        </div>`;
    container.innerHTML += html;
}