// 1. IMPORTAÇÕES DO SEU FIREBASE.JS
import { auth, db, participantsCol, jokerRef, appId } from "./firebase.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getDocs, deleteDoc, doc, setDoc, onSnapshot, collection 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Coleções e Referências locais
const matchesCol = collection(db, "matches");
const gameStateRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'game_state');

/**
 * ==========================================
 * LÓGICA DE LOGIN E INICIALIZAÇÃO
 * ==========================================
 */
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

/**
 * ==========================================
 * MOTOR PRINCIPAL DO TELÃO
 * ==========================================
 */
function startTelao() {
    // --- OUVINTE 1: JOGADORES NA MESA ---
    onSnapshot(participantsCol, (snapshot) => {
        const grid = document.getElementById('cardsGrid');
        const total = document.getElementById('totalPlayers');
        const jokerName = document.getElementById('jokerName');
        const jokerPanel = document.getElementById('jokerStatusPanel');
        const jokerIcon = document.getElementById('jokerIcon');

        if (total) total.innerText = snapshot.size;

        let hasJoker = false;
        let allPlayers = [];
        let jokerPlayer = null;

        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            allPlayers.push(d);
            if (d.is_joker) {
                hasJoker = true;
                jokerPlayer = d;

                if (jokerName) {
                    jokerName.innerText = "👑 " + d.name.toUpperCase() + " É O CORINGA!";
                    jokerName.classList.add('text-purple-400');
                    jokerName.classList.remove('text-white');
                }
                if (jokerPanel) {
                    jokerPanel.classList.add('border-purple-500', 'shadow-[0_0_40px_rgba(168,85,247,0.6)]');
                    jokerPanel.classList.remove('border-gold/50');
                }
                if (jokerIcon) jokerIcon.className = "fas fa-mask text-4xl md:text-5xl text-purple-400 animate-bounce";
            }
        });

        if (!hasJoker) {
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

        // Ordena por data (mais recentes primeiro)
        allPlayers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        let recentPlayers = allPlayers.slice(0, 24);

        // Garante que o Coringa nunca sai da tela
        if (jokerPlayer) {
            recentPlayers = recentPlayers.filter(p => p.uid !== jokerPlayer.uid);
            recentPlayers.unshift(jokerPlayer);
            if (recentPlayers.length > 24) recentPlayers.pop();
        }

        renderGrid(grid, recentPlayers);
    });

    // --- OUVINTE 2: MATCHES REALIZADOS (PRÊMIOS) ---
    const dashboardStartTime = new Date().getTime();
    onSnapshot(matchesCol, (snapshot) => {
        const totalMatchesEl = document.getElementById('totalMatches');
        if (totalMatchesEl) totalMatchesEl.innerText = snapshot.size;

        // Dispara o alerta apenas para matches novos (ignorando os que já estavam no banco ao carregar a página)
        snapshot.docChanges().forEach((change) => {
            const matchData = change.doc.data();
            const matchTime = new Date(matchData.timestamp).getTime();
            if (matchTime > dashboardStartTime) {
                    showMatchAlert(matchData);
            }
        });
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
        const cardClass = isJoker ? 'joker-card-front joker-glow' : '';
        const firstName = d.name.split(' ')[0].toUpperCase();
        const instaClean = (d.instagram || '').replace('@', '');

        grid.innerHTML += `
            <div class="flex flex-col items-center animate-[popIn_0.5s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards]">
                <div class="telao-card ${cardClass} relative overflow-hidden" style="color: ${isJoker ? '#ffffff' : d.color};">
                    <div class="absolute top-1.5 left-2 flex flex-col items-center leading-none font-black">
                        <span class="text-xl md:text-2xl">${isJoker ? 'J' : d.cardValue}</span>
                        <span class="text-xs md:text-sm mt-0.5">${isJoker ? '🎭' : d.suitSymbol}</span>
                    </div>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <span class="text-[3rem] md:text-[4rem] drop-shadow-sm">${isJoker ? '🎭' : d.suitSymbol}</span>
                    </div>
                    <div class="absolute bottom-1.5 right-2 flex flex-col items-center leading-none font-black rotate-180">
                        <span class="text-xl md:text-2xl">${isJoker ? 'J' : d.cardValue}</span>
                        <span class="text-xs md:text-sm mt-0.5">${isJoker ? '🎭' : d.suitSymbol}</span>
                    </div>
                </div>
                <div class="mt-3 bg-[#111] w-[90px] md:w-[110px] px-2 py-2 rounded-lg border border-gold/40 flex flex-col items-center shadow-lg">
                    <span class="text-[10px] md:text-xs text-white font-black truncate w-full text-center tracking-wider">${firstName}</span>
                    ${instaClean ? `<span class="text-[9px] md:text-[10px] text-pink-400 mt-0.5 truncate w-full text-center tracking-wide font-medium"><i class="fab fa-instagram"></i> @${instaClean}</span>` : ''}
                    <span class="text-[8px] md:text-[9px] text-gold font-mono font-bold tracking-widest mt-1 uppercase">${d.matchCode}</span>
                </div>
            </div>
        `;
    });
}

function showMatchAlert(data) {
    const alertDiv = document.createElement('div');
    alertDiv.className = "fixed top-10 left-1/2 -translate-x-1/2 z-[500] bg-gradient-to-r from-pink-600 to-purple-600 text-white px-10 py-6 rounded-3xl shadow-[0_0_50px_rgba(219,39,119,0.8)] border-2 border-white/30 text-center flex flex-col items-center";
    alertDiv.style.animation = "popIn 0.5s ease-out";

    // Pegando apenas o primeiro nome das pessoas para ficar mais legível
    const p1Name = data.p1_name ? data.p1_name.split(' ')[0] : "Alguém";
    const p2Name = data.p2_name ? data.p2_name.split(' ')[0] : "Alguém";

    alertDiv.innerHTML = `
        <span class="text-5xl mb-2">🥂</span>
        <h3 class="text-2xl font-black uppercase italic tracking-tighter">NOVO MATCH NA PISTA!</h3>
        <p class="text-xl font-bold mt-1">${p1Name} ❤️ ${p2Name}</p>
        <p class="text-[10px] mt-2 tracking-[0.3em] uppercase opacity-90 font-black">SHOT DUPLO LIBERADO!</p>
    `;

    document.body.appendChild(alertDiv);

    // Remove o pop-up após 6 segundos
    setTimeout(() => {
        alertDiv.style.opacity = '0';
        alertDiv.style.transition = 'opacity 0.5s ease';
        setTimeout(() => alertDiv.remove(), 500);
    }, 6000);
}

/**
 * ==========================================
 * FUNÇÕES DE ADMINISTRAÇÃO E TESTE
 * ==========================================
 */
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

        const participantData = {
            uid: uid,
            name: fakeNames[i],
            instagram: `@${fakeNames[i].toLowerCase()}_ofc`,
            gender: 'nb',
            interest: 'all',
            suitName: randomSuit.name,
            suitSymbol: randomSuit.symbol,
            cardValue: randomValue,
            color: randomSuit.color,
            is_joker: false,
            matchCode: matchCode,
            suggestion: "Teste de Telão",
            createdAt: new Date().toISOString()
        };

        // Usa doc() importado do Firestore de forma segura
        await setDoc(doc(participantsCol, uid), participantData);
        await new Promise(r => setTimeout(r, 600)); // Tempo para animação rolar fluida
    }
};

window.wipeTable = async () => {
    if (!confirm("CUIDADO: Isto vai apagar TODOS os jogadores da base de dados e o Coringa. Usar apenas antes de começar a festa! Continuar?")) return;

    try {
        await deleteDoc(jokerRef);
        const snap = await getDocs(participantsCol);
        const promises = [];
        snap.forEach(d => {
            // Usa doc() importado do Firestore de forma segura
            promises.push(deleteDoc(doc(participantsCol, d.id)));
        });
        await Promise.all(promises);

        alert("Mesa limpa! Pode começar a festa.");
    } catch (err) {
        console.error(err);
        alert("Erro ao limpar a mesa.");
    }
};

/**
 * ==========================================
 * MODO END GAME (FIM DA FESTA)
 * ==========================================
 */
window.triggerEndGame = async () => {
    if (!confirm("Tem certeza que deseja encerrar a mesa e exibir os resultados finais?")) return;

    // 1. Pega os elementos da tela final
    const endScreen = document.getElementById('endGameScreen');
    const endMatches = document.getElementById('endTotalMatches');
    const endTopSuit = document.getElementById('endTopSuit');
    const endJoker = document.getElementById('endJokerName');

    try {
        // 2. Busca todos os jogadores para calcular o Naipe vencedor e achar o Coringa
        const { getDocs } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
        const playersSnap = await getDocs(participantsCol);
        
        let suitsCount = { 'Copas': 0, 'Espadas': 0, 'Ouros': 0, 'Trevos': 0 };
        let jokerName = "Ninguém encontrou";
        
        playersSnap.forEach(doc => {
            const data = doc.data();
            if (data.is_joker) {
                jokerName = data.name.toUpperCase();
            } else if (data.suitName) {
                suitsCount[data.suitName] = (suitsCount[data.suitName] || 0) + 1;
            }
        });

        // 3. Acha o naipe com maior número de pessoas
        let topSuit = 'Copas';
        let maxCount = 0;
        const suitSymbols = { 'Copas': '♥️', 'Espadas': '♠', 'Ouros': '♦', 'Trevos': '♣' };
        const suitColors = { 'Copas': 'text-red-500', 'Espadas': 'text-gray-300', 'Ouros': 'text-red-500', 'Trevos': 'text-gray-300' };

        for (const [suit, count] of Object.entries(suitsCount)) {
            if (count > maxCount) {
                maxCount = count;
                topSuit = suit;
            }
        }

        // 4. Pega o total de Matches (lendo o número que já está no painel)
        const totalMatchesStr = document.getElementById('totalMatches').innerText;

        // 5. Preenche os dados na tela
        endMatches.innerText = totalMatchesStr;
        endJoker.innerText = jokerName;
        endTopSuit.innerHTML = `<span class="${suitColors[topSuit]}">${suitSymbols[topSuit]}</span> ${topSuit}`;

        // 6. Animação de entrada
        endScreen.classList.remove('hidden');
        // Pequeno delay para o navegador renderizar a remoção do hidden antes de animar a opacidade
        setTimeout(() => {
            endScreen.classList.remove('opacity-0');
            endScreen.classList.add('opacity-100');
            
            // Dispara uns confetes para celebrar!
            if (typeof confetti === 'function') {
                confetti({ particleCount: 300, spread: 100, origin: { y: 0.3 }, zIndex: 1000 });
            }
        }, 100);

    } catch (err) {
        console.error("Erro ao gerar estatísticas:", err);
        alert("Erro ao carregar os dados finais.");
    }
};

window.closeEndGame = () => {
    const endScreen = document.getElementById('endGameScreen');
    endScreen.classList.remove('opacity-100');
    endScreen.classList.add('opacity-0');
    setTimeout(() => endScreen.classList.add('hidden'), 1000); // Aguarda a transição terminar
};

window.onload = () => {
    const urlDoApp = window.location.origin; // Detecta a URL raiz da sua aplicação automaticamente
    const qrImg = document.getElementById('mainQrCode');
    if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(urlDoApp)}`;

    if (sessionStorage.getItem('telao_auth_party') === 'true') {
        loginFirebase();
    }
};