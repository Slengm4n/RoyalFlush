import { auth, db, participantsCol, jokerRef } from "./firebase.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getDocs, deleteDoc, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * 1. EXPOSIÇÃO PARA O HTML
 */
window.checkPassword = (e) => {
    e.preventDefault();
    const pwd = document.getElementById('adminPassword').value;
    if (pwd === "royal2026") {
        sessionStorage.setItem('telao_auth_party', 'true');
        document.getElementById('loginOverlay').style.display = 'none';
        loginFirebase();
    } else {
        alert("Senha incorreta!");
        document.getElementById('adminPassword').value = '';
    }
};

// Botão Azul: Simulação
window.simulateCrowd = async () => {
    if(!confirm("Criar 15 jogadores de teste com cartas aleatórias?")) return;
    const names = ["Carlos", "Beatriz", "Miguel", "Ana", "Lucas", "Sofia", "Tiago", "Maria", "Pedro", "Inês"];
    const suits = [
        { name: 'Copas', symbol: '♥️', color: '#b91c1c' },
        { name: 'Espadas', symbol: '♠', color: '#1a1a1a' },
        { name: 'Ouros', symbol: '♦', color: '#b91c1c' },
        { name: 'Trevos', symbol: '♣', color: '#1a1a1a' }
    ];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    for (let name of names) {
        const uid = "fake_" + Math.random().toString(36).substring(2, 7);
        const s = suits[Math.floor(Math.random() * suits.length)];
        const val = values[Math.floor(Math.random() * values.length)]; 
        
        await setDoc(doc(participantsCol, uid), {
            uid, name, instagram: `@${name.toLowerCase()}_party`,
            suitName: s.name, suitSymbol: s.symbol, color: s.color,
            cardValue: val, is_joker: false, 
            matchCode: Math.random().toString(36).substring(2, 6).toUpperCase(),
            createdAt: new Date().toISOString()
        });
        await new Promise(r => setTimeout(r, 500));
    }
};

// Botão Vermelho: Limpeza
window.wipeTable = async () => {
    if(!confirm("Zerar TODA a mesa do casino?")) return;
    try {
        const snap = await getDocs(participantsCol);
        const promises = snap.docs.map(d => deleteDoc(doc(participantsCol, d.id)));
        await Promise.all(promises);
        await deleteDoc(jokerRef);
        alert("Mesa limpa!");
    } catch (e) { console.error(e); }
};

/**
 * 2. LÓGICA DO TELÃO (REAL-TIME)
 */
function startTelao() {
    onSnapshot(participantsCol, (snapshot) => {
        const grid = document.getElementById('cardsGrid');
        const total = document.getElementById('totalPlayers');
        const jokerName = document.getElementById('jokerName');
        const jokerPanel = document.getElementById('jokerStatusPanel');
        const jokerIcon = document.getElementById('jokerIcon');
        
        total.innerText = snapshot.size;
        let players = [];
        let jokerFound = null;

        snapshot.forEach(doc => {
            const d = doc.data();
            players.push(d);
            if (d.is_joker) jokerFound = d;
        });

        // Atualização do Painel do Coringa
        if (jokerFound) {
            jokerName.innerText = `👑 ${jokerFound.name.toUpperCase()} É O CORINGA!`;
            jokerName.className = "text-lg md:text-3xl font-black text-purple-400 mt-1 truncate max-w-[280px] md:max-w-md";
            jokerPanel.className = "joker-glow border-2 border-purple-500 bg-black/80 p-4 rounded-2xl flex items-center gap-4 transition-all duration-500 shadow-[0_0_40px_rgba(168,85,247,0.6)]";
            if (jokerIcon) jokerIcon.className = "fas fa-mask text-4xl md:text-5xl text-purple-400 animate-bounce";
        } else {
            jokerName.innerText = "Escondido no Baralho...";
            jokerName.className = "text-lg md:text-3xl font-black text-white mt-1 truncate max-w-[280px] md:max-w-md";
            jokerPanel.className = "border-2 border-gold/50 bg-black/80 p-4 rounded-2xl flex items-center gap-4 transition-all duration-500";
            if (jokerIcon) jokerIcon.className = "fas fa-crown text-4xl md:text-5xl text-gold";
        }

        players.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        grid.innerHTML = '';
        
        players.slice(0, 24).forEach(p => {
            const isJ = p.is_joker;
            const insta = p.instagram ? p.instagram.replace('@', '') : '';
            
            // 🔥 CORREÇÃO DO LAYOUT (Coringa Minimalista + Flex-Grow)
            const cardHTML = `
                <div class="flex flex-col items-center w-[105px] md:w-[145px] animate-popIn">
                    
                    <div class="telao-card bg-white ${isJ ? 'joker-glow' : 'text-black'}" 
                         style="color: ${isJ ? '#a855f7' : p.color}; border-color: var(--gold);">
                        
                        <!-- Textura discreta só para cartas normais -->
                        ${!isJ ? `<div class="absolute inset-0 opacity-5" style="background-image: url('https://www.transparenttextures.com/patterns/p6.png');"></div>` : ''}
                        
                        <div class="flex flex-col h-full w-full p-0 justify-between relative z-10">
                            
                            <div class="flex flex-col items-center self-start leading-none font-black">
                                <span class="text-xl">${isJ ? 'J' : p.cardValue}</span>
                                <span class="text-xs mt-1">${isJ ? '🎭' : p.suitSymbol}</span>
                            </div>
                            
                            <!-- 🔥 FLEX-GROW AQUI: Empurra o topo e a base para os cantos da carta -->
                            <div class="text-center flex flex-col items-center justify-center flex-grow">
                                <span class="text-5xl md:text-6xl drop-shadow-lg">${isJ ? '🎭' : p.suitSymbol}</span>
                            </div>
                            
                            <div class="flex flex-col items-center self-end rotate-180 leading-none font-black">
                                <span class="text-xl">${isJ ? 'J' : p.cardValue}</span>
                                <span class="text-xs mt-1">${isJ ? '🎭' : p.suitSymbol}</span>
                            </div>

                        </div>
                    </div>
                    
                    <div class="mt-3 bg-black/90 border-2 border-gold/40 rounded-xl p-2 w-full shadow-2xl text-center">
                        <p class="text-[12px] text-white font-black truncate">${p.name.split(' ')[0].toUpperCase()}</p>
                        ${insta ? `
                            <div class="bg-pink-600/20 border border-pink-500/50 rounded-lg py-1 mt-1">
                                <p class="text-[11px] text-pink-400 font-bold truncate">@${insta}</p>
                            </div>` : ''}
                        <p class="text-[9px] text-gold/60 font-mono mt-1">ID: ${p.matchCode}</p>
                    </div>
                </div>`;
            
            grid.innerHTML += cardHTML;
        });

        // Live Feed update
        if (players.length > 0) {
            const names = players.slice(0, 5).map(p => p.name.split(' ')[0]).join(', ');
            document.getElementById('liveFeed').innerText = `✦ ${names} entraram no jogo! ✦ Ache seu par na pista ✦ Ganhe Shot Duplo ✦ O Coringa não tem regras! ✦`;
        }
    });
}

/**
 * 3. INICIALIZAÇÃO
 */
async function loginFirebase() {
    try {
        await signInAnonymously(auth);
        startTelao();
    } catch (e) { console.error(e); }
}

window.onload = () => {
    const url = 'https://sua-festa-aqui.com'; 
    document.getElementById('mainQrCode').src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`;
    
    if (sessionStorage.getItem('telao_auth_party') === 'true') {
        document.getElementById('loginOverlay').style.display = 'none';
        loginFirebase();
    }
};