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
        if (!window.isFirebaseLoaded) loginFirebase();
    } else {
        alert("Senha incorreta! (Dica: royal2026)");
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
    onSnapshot(participantsCol, (snapshot) => {
        const grid = document.getElementById('cardsGrid');
        const total = document.getElementById('totalPlayers');
        const jokerName = document.getElementById('jokerName');
        const jokerPanel = document.getElementById('jokerStatusPanel');
        const jokerIcon = document.getElementById('jokerIcon');

        if (total) total.innerText = snapshot.size;

        let hasJoker = false;
        let allPlayers = [];
        let jokerPlayer = null; // Vamos guardar quem é o Coringa

        snapshot.forEach(doc => {
            const d = doc.data();
            allPlayers.push(d);

            if (d.is_joker) {
                hasJoker = true;
                jokerPlayer = d; // Salva o Coringa para depois
                if (jokerName) {
                    jokerName.innerText = "👑 " + d.name.toUpperCase() + " É O CORINGA!";
                    jokerName.classList.replace('text-white', 'text-purple-400');
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
                jokerName.classList.replace('text-purple-400', 'text-white');
            }
            if (jokerPanel) {
                jokerPanel.classList.remove('border-purple-500', 'shadow-[0_0_40px_rgba(168,85,247,0.6)]');
                jokerPanel.classList.add('border-gold/50');
            }
            if (jokerIcon) jokerIcon.className = "fas fa-crown text-4xl md:text-5xl text-gold";
        }

        // Ordena todos por data
        allPlayers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        let recentPlayers = allPlayers.slice(0, 24); // Pega as 24 mais recentes

        // 🔥 CORREÇÃO: O Coringa NUNCA pode sair da tela!
        if (jokerPlayer) {
            // Remove o coringa de onde ele estiver na lista atual (para não duplicar)
            recentPlayers = recentPlayers.filter(p => p.uid !== jokerPlayer.uid);

            // Força o Coringa a ser SEMPRE o 1º da fila no Telão
            recentPlayers.unshift(jokerPlayer);

            // Garante que o limite de 24 cartas se mantém
            if (recentPlayers.length > 24) {
                recentPlayers.pop();
            }
        }

        if (grid) {
            grid.innerHTML = '';

            if (recentPlayers.length === 0) {
                grid.innerHTML = '<div class="w-full h-full flex flex-col items-center justify-center py-10 md:py-0"><i class="fas fa-layer-group text-4xl md:text-6xl text-gold/30 mb-4"></i><p class="text-gold/50 text-xl md:text-3xl uppercase tracking-widest animate-pulse text-center px-4">Aguardando o primeiro jogador...</p></div>';
                return;
            }

          // Substitua todo o bloco do forEach por este:
            recentPlayers.forEach(d => {
                const isJokerCard = d.is_joker;
                
                // Classes limpas para o CSS brilhar!
                const cardClass = isJokerCard ? 'joker-card-front joker-glow' : ''; 
                const textColor = isJokerCard ? '#ffffff' : d.color;
                const valDisplay = isJokerCard ? 'J' : d.cardValue;
                const symDisplay = isJokerCard ? '🎭' : d.suitSymbol;
                const centerDisplay = isJokerCard ? '🎭' : d.suitSymbol;

                const firstName = d.name.split(' ')[0].toUpperCase();
                const instaRaw = d.instagram || '';
                const instaClean = instaRaw.replace('@', '');
                const instaDisplay = instaClean ? `<span class="text-[9px] md:text-[10px] text-pink-400 mt-0.5 truncate w-full text-center tracking-wide font-medium"><i class="fab fa-instagram"></i> @${instaClean}</span>` : '';

                const cardHTML = `
                    <div class="flex flex-col items-center animate-[popIn_0.5s_cubic-bezier(0.175,0.885,0.32,1.275)_forwards]">
                        
                        <div class="telao-card ${cardClass} relative overflow-hidden" style="color: ${textColor};">
                            
                            <div class="absolute top-1.5 left-2 flex flex-col items-center leading-none font-black">
                                <span class="text-xl md:text-2xl">${valDisplay}</span>
                                <span class="text-xs md:text-sm mt-0.5">${symDisplay}</span>
                            </div>
                            
                            <div class="absolute inset-0 flex items-center justify-center">
                                <span class="text-[3rem] md:text-[4rem] drop-shadow-sm">${centerDisplay}</span>
                            </div>
                            
                            <div class="absolute bottom-1.5 right-2 flex flex-col items-center leading-none font-black rotate-180">
                                <span class="text-xl md:text-2xl">${valDisplay}</span>
                                <span class="text-xs md:text-sm mt-0.5">${symDisplay}</span>
                            </div>

                        </div>
                        
                        <div class="mt-3 bg-[#111] w-[90px] md:w-[110px] px-2 py-2 rounded-lg border border-gold/40 flex flex-col items-center shadow-lg">
                            <span class="text-[10px] md:text-xs text-white font-black truncate w-full text-center tracking-wider">${firstName}</span>
                            ${instaDisplay}
                            <span class="text-[8px] md:text-[9px] text-gold font-mono font-bold tracking-widest mt-1 uppercase">${d.matchCode}</span>
                        </div>
                        
                    </div>
                `;
                
                // Adiciona a carta na tela!
                grid.innerHTML += cardHTML;
            });
        }

        const feed = document.getElementById('liveFeed');
        if (recentPlayers.length > 0 && feed) {
            const names = recentPlayers.slice(0, 8).map(p => p.name.split(' ')[0]).join(', ');
            feed.innerText = `✦ ${names} entraram no jogo! ✦ Ache seu par na pista ✦ Escaneie o QR Code na tela ✦ Cuidado: O Coringa não tem regras! ✦`;
        }
    });
}

// ==========================================
// 🔥 FERRAMENTAS DE TESTE (Simulação e Limpeza)
// ==========================================

window.simulateCrowd = async () => {
    if (!auth.currentUser) return alert("Inicie sessão primeiro (mesmo que anônima).");
    if (!confirm("Isto vai criar 15 jogadores falsos para veres como o Telão enche. Continuar?")) return;

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

        await setDoc(doc(participantsCol, uid), participantData);
        await new Promise(r => setTimeout(r, 800));
    }
};

window.wipeTable = async () => {
    if (!confirm("CUIDADO: Isto vai apagar TODOS os jogadores da base de dados e o Coringa. Usar apenas antes de começar a festa! Continuar?")) return;
    if (!confirm("Atenção: Apagar a mesa? Não tem volta atrás!")) return;

    try {
        await deleteDoc(jokerRef);
        const snap = await getDocs(participantsCol);
        const promises = [];
        snap.forEach(d => {
            promises.push(deleteDoc(doc(participantsCol, d.id)));
        });
        await Promise.all(promises);

        alert("Mesa limpa! Pode começar a festa.");
    } catch (err) {
        console.error(err);
        alert("Erro ao limpar a mesa.");
    }
};

window.onload = () => {
    const urlDoApp = 'https://sua-festa-aqui.com';
    const qrImg = document.getElementById('mainQrCode');
    if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(urlDoApp)}`;

    if (sessionStorage.getItem('telao_auth_party') === 'true') {
        loginFirebase();
    }
};