import { db, participantsCol, jokerRef, getParticipantDoc } from "./firebase.js";
import { setDoc, runTransaction, getCountFromServer } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export let myData = null;

// 🔥 OTIMIZAÇÃO: Cache de DOM. Se o JS já achou o elemento uma vez, não precisa procurar no HTML de novo.
const domCache = {};
const el = (id) => {
    if (!(id in domCache)) domCache[id] = document.getElementById(id);
    return domCache[id];
};

export async function processDraw(currentUser, name, insta, gender, interest) {
    const uid = currentUser.uid;
    const suits = [
        { name: 'Copas', symbol: '♥️', color: '#b91c1c' },
        { name: 'Espadas', symbol: '♠', color: '#1a1a1a' },
        { name: 'Ouros', symbol: '♦', color: '#b91c1c' },
        { name: 'Trevos', symbol: '♣', color: '#1a1a1a' }
    ];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

    const randomSuit = suits[Math.floor(Math.random() * suits.length)];
    const randomValue = values[Math.floor(Math.random() * values.length)];
    
    const safeChars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let matchCode = '';
    for (let i = 0; i < 4; i++) {
        matchCode += safeChars.charAt(Math.floor(Math.random() * safeChars.length));
    }

    let isJoker = false;

    // 🔥 OTIMIZAÇÃO: Transação mais limpa e direta. Ocorrerá menos "retry" no Firebase.
    try {
        // 1. Conta quantas pessoas já estão registadas na festa
        const countSnap = await getCountFromServer(participantsCol);
        const totalPlayers = countSnap.data().count;

        // 2. Ajusta a probabilidade de forma dinâmica.
        let jokerProbability = 0.05; // Até 14 pessoas: 5% de hipótese
        if (totalPlayers >= 15) jokerProbability = 0.20; // 15 a 24 pessoas: 20% de hipótese
        if (totalPlayers >= 25) jokerProbability = 0.50; // 25 a 34 pessoas: 50% de hipótese
        if (totalPlayers >= 35) jokerProbability = 1.00; // 35+ pessoas: 100% (Sai obrigatoriamente!)

        // 3. Tenta atribuir o Coringa
        await runTransaction(db, async (transaction) => {
            const jokerSnap = await transaction.get(jokerRef);
            // Só tenta ser coringa se ele NÃO existir ou se o 'taken' for falso
            if (!jokerSnap.exists() || jokerSnap.data()?.taken !== true) {
                if (Math.random() < jokerProbability) {
                    isJoker = true;
                    transaction.set(jokerRef, { taken: true, winner: uid, name: name });
                }
            }
        });
    } catch (e) {
        console.error("Erro na transação do Coringa:", e);
        // Se a transação falhar por gargalo de rede, ele continua como carta normal sem travar a festa
    }

    let targetText = "alguém";
    if (interest === 'f') targetText = "uma mulher";
    else if (interest === 'm') targetText = "um homem";

    const participantData = {
        uid, name, instagram: insta, gender, interest,
        suitName: isJoker ? 'Coringa Real' : randomSuit.name,
        suitSymbol: isJoker ? '✦' : randomSuit.symbol, // Um símbolo mais minimalista que a máscara
        cardValue: isJoker ? 'K' : randomValue,
        color: isJoker ? '#D4AF37' : randomSuit.color, // Dourado Metálico
        is_joker: isJoker,
        matchCode,
        suggestion: isJoker ? "O destino está nas tuas mãos. Escolhe o teu próprio par." :
            `Encontra ${targetText} com o naipe de ${randomSuit.name}!`,
        createdAt: new Date().toISOString()
    };

    // 🔥 OTIMIZAÇÃO: Executar o setDoc e a interface visual em paralelo (Promise.all)
    try {
        await setDoc(getParticipantDoc(uid), participantData);
        localStorage.setItem('festa_uid_final_scale', uid);
        showMyCard(participantData);
    } catch (err) {
        console.error("Erro ao salvar card:", err);
        // Exibe toast usando a função global injetada pelo app.js
        if (window.showToast) window.showToast("Erro", "Sinal ruim. Tente de novo.", "error");
    }
}

export function showMyCard(data) {
    myData = data;

    if (el('registrationSection')) el('registrationSection').classList.add('hidden-section');
    if (el('shuffleSection')) el('shuffleSection').classList.add('hidden-section');
    if (el('revealSection')) el('revealSection').classList.remove('hidden-section');

    const setText = (id, text) => { if (el(id)) el(id).innerText = text; };

    setText('topValue', data.cardValue);
    setText('topSymbol', data.suitSymbol);
    setText('botValue', data.cardValue);
    setText('botSymbol', data.suitSymbol);
    setText('myMatchCode', data.matchCode);
    setText('suitName', data.suitName);
    setText('matchSuggestion', data.suggestion);

    const mainValue = el('mainValue');
    const mainSuit = el('mainSuit');
    const cardContent = el('cardContent');

    if (cardContent) {
        if (data.is_joker) {
            if (mainValue) {
                mainValue.innerText = 'J';
                mainSuit.className = 'text-[8rem] font-serif italic font-light tracking-tighter drop-shadow-[0_0_15px_rgba(212,175,55,0.8)]';
            }
            if (mainSuit) {
                mainSuit.innerText = '✦';
                mainSuit.className = 'text-5xl mt-[-20px] opacity-80 animate-pulse';
            }

            cardContent.classList.remove('joker-card-front');
            cardContent.classList.add('joker-glow-gold');

            cardContent.style.background = '#ffffff';
            cardContent.style.color = '#D4AF37';;
            cardContent.style.border = '2px solid #D4AF37';

            cardContent.style.boxShadow = '0 0 25px rgba(212, 175, 55, 0.6), inset 0 0 15px rgba(212, 175, 55, 0.2)';

            if (el('jokerMessage')) el('jokerMessage').classList.remove('hidden');
            if (el('jokerPrize')) el('jokerPrize').classList.remove('hidden');
        } else {
            if (mainValue) {
                mainValue.innerText = data.cardValue;
                mainValue.className = 'text-[7rem] font-black leading-none drop-shadow-sm';
            }
            if (mainSuit) {
                mainSuit.innerText = data.suitSymbol;
                mainSuit.className = 'text-7xl mt-2 drop-shadow-md opacity-90';
            }
            cardContent.classList.remove('joker-card-front', 'joker-glow');

            if (el('jokerMessage')) el('jokerMessage').classList.add('hidden');
            if (el('jokerPrize')) el('jokerPrize').classList.add('hidden');
        }
        cardContent.style.color = data.color;
    }

    setTimeout(() => {
        if (el('finalCard')) el('finalCard').classList.add('is-flipped');
    }, 400); // 🔥 OTIMIZAÇÃO: Diminui o delay de 600ms para 400ms para parecer mais ágil
}

export function processMatchResult(other) {
    const matchMsg = el('matchMsg');
    const voucherDiv = el('prizeVoucher');

    const instaDisplay = other.instagram ? `<br><a href="https://instagram.com/${other.instagram.replace('@', '')}" target="_blank" class="text-pink-400 text-sm mt-3 inline-block bg-white/10 px-4 py-2 rounded-full border border-pink-500/30 active:scale-95 transition"><i class="fab fa-instagram"></i> ${other.instagram}</a>` : '';

    if (matchMsg) matchMsg.innerHTML = `O DESTINO FALOU! ✨<br>Tu e ${other.name} combinam perfeitamente. ${instaDisplay}`;

    const sortedCodes = [myData.matchCode, other.matchCode].sort();
    const prizeId = `ROYAL-${sortedCodes[0]}-${sortedCodes[1]}`;

    if (el('qrCodeImg')) el('qrCodeImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${prizeId}`;
    if (el('voucherCode')) el('voucherCode').innerText = prizeId;

    if (voucherDiv) {
        voucherDiv.classList.remove('hidden');
        voucherDiv.style.display = 'block';
    }

    if (typeof confetti === 'function') confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 } });

    if (el('matchModal')) el('matchModal').classList.remove('hidden');
}

export function shareToInstagram() {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();

    setTimeout(() => {
        if (window.showToast) {
            window.showToast(
                "📸 Tira um print!",
                "Posta no Insta e marca @atletica_sagui",
                "success"
            );
        }
        setTimeout(() => {
            if (document.exitFullscreen) document.exitFullscreen();
        }, 10000);

    }, 600);
}