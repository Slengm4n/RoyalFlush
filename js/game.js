import { db, participantsCol, jokerRef, getParticipantDoc } from "./firebase.js";
import { setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export let myData = null;

// Função auxiliar global para este módulo para evitar erros de "null" durante o carregamento
const el = (id) => document.getElementById(id);

/**
 * Processa o sorteio da carta e grava no Firebase
 */
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
    const matchCode = Math.random().toString(36).substring(2, 6).toUpperCase();

    let isJoker = false;
    try {
        await runTransaction(db, async (transaction) => {
            const jokerSnap = await transaction.get(jokerRef);
            if (!jokerSnap.exists() || !jokerSnap.data().taken) {
                // 5% de chance de ser o Coringa da festa
                if (Math.random() < 0.05) { 
                    isJoker = true;
                    transaction.set(jokerRef, { taken: true, winner: uid, name: name });
                }
            }
        });
    } catch (e) { console.error("Erro na transação do Coringa:", e); }

    const participantData = {
        uid, name, instagram: insta, gender, interest,
        suitName: isJoker ? 'Coringa' : randomSuit.name,
        suitSymbol: isJoker ? '🎭' : randomSuit.symbol,
        cardValue: isJoker ? 'J' : randomValue,
        color: isJoker ? '#a855f7' : randomSuit.color,
        is_joker: isJoker,
        matchCode,
        suggestion: isJoker ? "Tu és o Caos! Encontra quem quiseres para o teu Match Perfeito." :
            `Encontra alguém com o naipe de ${randomSuit.name}!`,
        createdAt: new Date().toISOString()
    };

    await setDoc(getParticipantDoc(uid), participantData);
    localStorage.setItem('festa_uid_final_scale', uid);
    showMyCard(participantData);
}

/**
 * Exibe a carta no ecrã de forma segura
 */
export function showMyCard(data) {
    myData = data;

    // Esconde/Mostra secções principais
    if (el('registrationSection')) el('registrationSection').classList.add('hidden-section');
    if (el('shuffleSection')) el('shuffleSection').classList.add('hidden-section');
    if (el('revealSection')) el('revealSection').classList.remove('hidden-section');

    // Atualiza os cantos (Valor e Símbolo pequeno)
    if (el('topValue')) el('topValue').innerText = data.cardValue;
    if (el('topSymbol')) el('topSymbol').innerText = data.suitSymbol;
    if (el('botValue')) el('botValue').innerText = data.cardValue;
    if (el('botSymbol')) el('botSymbol').innerText = data.suitSymbol;
    
    const mainValue = el('mainValue');
    const mainSuit = el('mainSuit');
    const cardContent = el('cardContent');

    if (cardContent) {
       if (data.is_joker) {
            // Layout Especial Coringa (Minimalista Premium no Celular também!)
            if (mainValue) mainValue.innerText = ''; 
            if (mainSuit) {
                mainSuit.innerText = '🤡'; // Pode ser 🤡 ou 🎭, como preferires
                mainSuit.className = 'text-[8rem] mt-2 drop-shadow-2xl animate-pulse';
            }
            
            // Removemos o fundo escuro e deixamos só o brilho neon roxo!
            cardContent.classList.remove('joker-card-front'); 
            cardContent.classList.add('joker-glow');
            
            if (el('jokerMessage')) el('jokerMessage').classList.remove('hidden');
            if (el('jokerPrize')) el('jokerPrize').classList.remove('hidden');
        } else {
            // Layout Carta Normal
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

    // Informações de ID e Missão
    if (el('myMatchCode')) el('myMatchCode').innerText = data.matchCode;
    if (el('suitName')) el('suitName').innerText = data.suitName;
    if (el('matchSuggestion')) el('matchSuggestion').innerText = data.suggestion;

    // Trigger da animação de rotação (CSS transition)
    setTimeout(() => {
        if (el('finalCard')) el('finalCard').classList.add('is-flipped');
    }, 600);
}

/**
 * Processa a validação de um Match bem sucedido
 */
export function processMatchResult(other) {
    const matchMsg = el('matchMsg');
    const voucherDiv = el('prizeVoucher');

    // Lógica de compatibilidade (Preferências sexuais + Naipe/Coringa)
    const iWantThem = ['all', 'party'].includes(myData.interest) || myData.interest === other.gender;
    const theyWantMe = ['all', 'party'].includes(other.interest) || other.interest === myData.gender;
    const cardsMatch = (myData.suitName === other.suitName) || myData.is_joker || other.is_joker;

    const instaDisplay = other.instagram ? `<br><a href="https://instagram.com/${other.instagram.replace('@', '')}" target="_blank" class="text-pink-400 text-sm mt-3 inline-block bg-white/10 px-4 py-2 rounded-full border border-pink-500/30 active:scale-95 transition"><i class="fab fa-instagram"></i> ${other.instagram}</a>` : '';

    if (iWantThem && theyWantMe && cardsMatch) {
        if (matchMsg) matchMsg.innerHTML = `O DESTINO FALOU! ✨<br>Tu e ${other.name} combinam perfeitamente. ${instaDisplay}`;

        // Gera um código de voucher único baseado na ordem alfabética dos IDs
        const sortedCodes = [myData.matchCode, other.matchCode].sort();
        const prizeId = `ROYAL-${sortedCodes[0]}-${sortedCodes[1]}`;

        if (el('qrCodeImg')) {
            el('qrCodeImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${prizeId}`;
        }
        if (el('voucherCode')) {
            el('voucherCode').innerText = prizeId;
        }
        if (voucherDiv) voucherDiv.classList.remove('hidden');
        
        // Atira confetis se a biblioteca estiver carregada
        if (typeof confetti === 'function') {
            confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 } });
        }
    } else {
        if (matchMsg) matchMsg.innerHTML = `Naipes diferentes ou as vossas vibes não batem! Continuem a procurar... 🥃 ${instaDisplay}`;
        if (voucherDiv) voucherDiv.classList.add('hidden');
    }

    if (el('matchModal')) el('matchModal').classList.remove('hidden');
}