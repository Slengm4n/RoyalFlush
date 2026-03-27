import { auth, db, participantsCol, jokerRef, appId } from "./firebase.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getDocs, deleteDoc, doc, setDoc, onSnapshot, collection
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const matchesCol = collection(db, "matches");
const gameStateRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'game_state');

window.checkPassword = (e) => {
    e.preventDefault();
    const pwd = document.getElementById('adminPassword').value;
    if (pwd === "royal2026") {
        sessionStorage.setItem('telao_auth_party', 'true');
        document.getElementById('loginOverlay').style.display = 'none';
        if (!window.isFirebaseLoaded) loginFirebase();
    } else {
        alert("Senha incorreta!");
        document.getElementById('adminPassword').value = '';
    }
};

if (sessionStorage.getItem('telao_auth_party') === 'true') {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.style.display = 'none';
}

window.isFirebaseLoaded = false;

async function loginFirebase() {
    try {
        await signInAnonymously(auth);
        window.isFirebaseLoaded = true;
        startTelao();
    } catch (e) { console.error("Erro no Login do Telão:", e); }
}

function startTelao() {
    let allPlayersMap = new Map();

    // 🔥 Marca o momento exato em que o telão foi aberto
    const telaoStartTime = Date.now();

    onSnapshot(participantsCol, (snapshot) => {
        const total = document.getElementById('totalPlayers');
        if (total) total.innerText = snapshot.size;

        snapshot.docChanges().forEach(change => {
            const d = change.doc.data();
            if (change.type === 'removed') {
                allPlayersMap.delete(change.doc.id);
            } else {
                allPlayersMap.set(change.doc.id, d);
            }
        });

        const jokerName = document.getElementById('jokerName');
        const jokerPanel = document.getElementById('jokerStatusPanel');
        const jokerIcon = document.getElementById('jokerIcon');
        const jokerEntry = [...allPlayersMap.values()].find(p => p.is_joker);

        if (jokerEntry) {
            if (jokerName) {
                jokerName.innerText = "👑" + jokerEntry.name.toUpperCase() + " É O CORINGA!";
                jokerName.classList.add('text-purple-400');
                jokerName.classList.remove('text-white');
            }
            if (jokerPanel) {
                jokerPanel.classList.add('border-purple-500', 'shadow-[0_0_40px_rgba(168,85,247,0.6)]');
                jokerPanel.classList.remove('border-gold/50');
            }
            if (jokerIcon) jokerIcon.className = "fa-solid fa-masks-theater </i> text-4xl md:text-5xl text-purple-400 animate-bounce";
        } else {
            if (jokerName) {
                jokerName.innerText = "Escondido no Baralho...";
                jokerName.classList.add('text-white');
                jokerName.classList.remove('text-purple-400');
            }
            if (jokerPanel) {
                jokerPanel.classList.remove('border-purple-500', 'shadow-[0_0_40px_rgba(168,85,247,0.6)]');
                jokerPanel.classList.add('border-gold/50');
            }
            if (jokerIcon) jokerIcon.className = "fas fa-crown text-4xl md:text-5xl text-gold";
        }

        let sorted = [...allPlayersMap.values()]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 24);

        if (jokerEntry) {
            sorted = sorted.filter(p => p.uid !== jokerEntry.uid);
            sorted.unshift(jokerEntry);
            if (sorted.length > 24) sorted.pop();
        }

        renderGrid(document.getElementById('cardsGrid'), sorted);
    });

    const dashboardStartTime = new Date().getTime();
    onSnapshot(matchesCol, (snapshot) => {
        const totalMatchesEl = document.getElementById('totalMatches');
        if (totalMatchesEl) totalMatchesEl.innerText = snapshot.size;

        snapshot.docChanges().forEach((change) => {
            const matchData = change.doc.data();
            const matchTime = new Date(matchData.timestamp).getTime();
            if (matchTime > dashboardStartTime) {
                showMatchAlert(matchData);
            }
        });
    });

    // 🔥 CORRIGIDO: Só reage a encerramentos que aconteceram DEPOIS do telão abrir
    onSnapshot(gameStateRef, async (snap) => {
        if (!snap.exists()) return;

        const data = snap.data();
        if (data.isGameOver !== true) return;

        const endedAt = new Date(data.endedAt).getTime();
        if (endedAt < telaoStartTime) return; // Ignora estados antigos

        const endScreen = document.getElementById('endGameScreen');
        const endMatches = document.getElementById('endTotalMatches');
        const endTopSuit = document.getElementById('endTopSuit');
        const endJoker = document.getElementById('endJokerName');

        const playersSnap = await getDocs(participantsCol);

        let suitsCount = { 'Copas': 0, 'Espadas': 0, 'Ouros': 0, 'Trevos': 0 };
        let jokerName = "Ninguém encontrou";

        playersSnap.forEach(d => {
            const pd = d.data();
            if (pd.is_joker) {
                jokerName = pd.name.toUpperCase();
            } else if (pd.suitName) {
                suitsCount[pd.suitName] = (suitsCount[pd.suitName] || 0) + 1;
            }
        });

        let topSuit = 'Copas';
        let maxCount = 0;
        const suitSymbols = { 'Copas': '♥️', 'Espadas': '♠', 'Ouros': '♦', 'Trevos': '♣' };
        const suitColors = { 'Copas': 'text-red-500', 'Espadas': 'text-gray-300', 'Ouros': 'text-red-500', 'Trevos': 'text-gray-300' };

        for (const [suit, count] of Object.entries(suitsCount)) {
            if (count > maxCount) { maxCount = count; topSuit = suit; }
        }

        const totalMatchesStr = document.getElementById('totalMatches')?.innerText || '0';

        if (endMatches) endMatches.innerText = totalMatchesStr;
        if (endJoker) endJoker.innerText = jokerName;
        if (endTopSuit) endTopSuit.innerHTML = `<span class="${suitColors[topSuit]}">${suitSymbols[topSuit]}</span> ${topSuit}`;

        if (endScreen) {
            endScreen.classList.remove('hidden');
            setTimeout(() => {
                endScreen.classList.remove('opacity-0');
                endScreen.classList.add('opacity-100');
                if (typeof confetti === 'function') {
                    confetti({ particleCount: 300, spread: 100, origin: { y: 0.3 }, zIndex: 1000 });
                }
            }, 100);
        }
    });
}

function renderGrid(grid, players) {
    if (!grid) return;
    grid.innerHTML = '';

    if (players.length === 0) {
        grid.innerHTML = `<div class="w-full h-full flex flex-col items-center justify-center py-10">
            <i class="fas fa-layer-group text-4xl text-gold/30 mb-4"></i>
            <p class="text-gold/50 text-xl uppercase tracking-widest animate-pulse">Aguardando jogadores...</p>
        </div>`;
        return;
    }

  players.forEach(d => {
    const isJoker = d.is_joker;
    
    // 🔥 MODIFICAÇÃO APENAS PARA O CORINGA:
    // Se for coringa: Fundo Branco + Borda Dourada + Glow. 
    // Se não: Mantém o padrão original (vazio ou sua classe padrão).
    const cardClass = isJoker 
        ? 'bg-white shadow-[0_0_25px_rgba(212,175,55,0.6)] border-2 border-[#D4AF37]' 
        : 'bg-white border border-gray-200'; // Ajuste aqui para o fundo padrão que você usava

    const firstName = d.name.split(' ')[0].toUpperCase();
    const instaClean = (d.instagram || '').replace('@', '');
    const textColor = isJoker ? '#D4AF37' : d.color;

    grid.innerHTML += `
        <div class="flex flex-col items-center animate-[popIn_0.5s_forwards] mb-4">
            <div class="telao-card ${cardClass} relative overflow-hidden rounded-xl shadow-lg" 
                 style="color: ${textColor}; width: 100px; height: 140px;">
                
                <div class="absolute top-1.5 left-2 flex flex-col items-center leading-none font-black">
                    <span class="text-xl md:text-2xl">${isJoker ? 'J' : d.cardValue}</span>
                    <span class="text-xs md:text-sm mt-0.5">${isJoker ? '✦' : d.suitSymbol}</span>
                </div>

                <div class="absolute inset-0 flex items-center justify-center">
                    <span class="text-[3rem] md:text-[3rem] drop-shadow-sm">${isJoker ? '✦' : d.suitSymbol}</span>
                </div>

                <div class="absolute bottom-1.5 right-2 flex flex-col items-center leading-none font-black rotate-180">
                    <span class="text-xl md:text-2xl">${isJoker ? 'J' : d.cardValue}</span>
                    <span class="text-xs md:text-sm mt-0.5">${isJoker ? '✦' : d.suitSymbol}</span>
                </div>
                
                ${isJoker ? `<div class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent animate-[shine_3s_infinite]"></div>` : ''}
            </div>

            <div class="mt-3 w-[115px] flex flex-col items-center">
                <span class="text-[10px] md:text-xs ${isJoker ? 'text-[#D4AF37] font-black' : 'text-white'} truncate w-full text-center uppercase">
                    ${firstName}
                </span>
                
                ${instaClean ? `
                <div class="mt-1 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full">
                    <span class="text-[12px] text-pink-400 font-bold block truncate">
                        <i class="fab fa-instagram text-[9px]"></i> ${instaClean}
                    </span>
                </div>` : ''}
            </div>
        </div>
    `;
});
}

function showMatchAlert(data) {
    const alertDiv = document.createElement('div');
    alertDiv.className = "fixed top-10 left-1/2 -translate-x-1/2 z-[500] bg-gradient-to-r from-pink-600 to-purple-600 text-white px-10 py-6 rounded-3xl shadow-[0_0_50px_rgba(219,39,119,0.8)] border-2 border-white/30 text-center flex flex-col items-center";
    alertDiv.style.animation = "popIn 0.5s ease-out";

    const p1Name = data.p1_name ? data.p1_name.split(' ')[0] : "Alguém";
    const p2Name = data.p2_name ? data.p2_name.split(' ')[0] : "Alguém";

    alertDiv.innerHTML = `
        <span class="text-5xl mb-2">🥂</span>
        <h3 class="text-2xl font-black uppercase italic tracking-tighter">NOVO MATCH NA PISTA!</h3>
        <p class="text-xl font-bold mt-1">${p1Name} ❤️ ${p2Name}</p>
        <p class="text-[10px] mt-2 tracking-[0.3em] uppercase opacity-90 font-black">SHOT DUPLO LIBERADO!</p>
    `;

    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.style.opacity = '0';
        alertDiv.style.transition = 'opacity 0.5s ease';
        setTimeout(() => alertDiv.remove(), 500);
    }, 6000);
}

window.simulateCrowd = async () => {
    if (!auth.currentUser) return alert("Inicie sessão primeiro.");
    if (!confirm("Isto vai injetar 15 jogadores para teste. Continuar?")) return;

    const fakeNames = ["Carlos", "Beatriz", "Miguel", "Ana", "Lucas", "Sofia", "Tiago", "Maria", "Pedro", "Inês", "Diogo", "Rita", "Hugo", "Catarina", "Tomás"];
    const suits = [
        { name: 'Copas', symbol: '♥️', color: '#b91c1c' },
        { name: 'Espadas', symbol: '♠', color: '#1a1a1a' },
        { name: 'Ouros', symbol: '♦', color: '#b91c1c' },
        { name: 'Trevos', symbol: '♣', color: '#1a1a1a' }
    ];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    for (let i = 0; i < fakeNames.length; i++) {
        const uid = "fake_user_" + Math.random().toString(36).substring(2, 9);
        const randomSuit = suits[Math.floor(Math.random() * suits.length)];
        const randomValue = values[Math.floor(Math.random() * values.length)];
        const matchCode = Math.random().toString(36).substring(2, 6).toUpperCase();

        await setDoc(doc(participantsCol, uid), {
            uid, name: fakeNames[i],
            instagram: `@${fakeNames[i].toLowerCase()}_ofc`,
            gender: 'nb', interest: 'all',
            suitName: randomSuit.name, suitSymbol: randomSuit.symbol,
            cardValue: randomValue, color: randomSuit.color,
            is_joker: false, matchCode,
            suggestion: "Teste de Telão",
            createdAt: new Date().toISOString()
        });
        await new Promise(r => setTimeout(r, 600));
    }
};

window.wipeTable = async () => {
    if (!confirm("CUIDADO: Isto vai apagar TODOS os jogadores. Continuar?")) return;
    try {
        await deleteDoc(jokerRef);
        await deleteDoc(gameStateRef);
        const snap = await getDocs(participantsCol);
        await Promise.all(snap.docs.map(d => deleteDoc(doc(participantsCol, d.id))));
        alert("Mesa limpa! Pode começar a festa.");
    } catch (err) {
        console.error(err);
        alert("Erro ao limpar a mesa.");
    }
};

window.closeEndGame = () => {
    const endScreen = document.getElementById('endGameScreen');
    endScreen.classList.remove('opacity-100');
    endScreen.classList.add('opacity-0');
    setTimeout(() => endScreen.classList.add('hidden'), 1000);
};

window.onload = () => {
    const qrImg = document.getElementById('mainQrCode');
    if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(window.location.origin)}`;

    if (sessionStorage.getItem('telao_auth_party') === 'true') {
        loginFirebase();
    }
};