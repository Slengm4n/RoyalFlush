// 1. IMPORTAÇÕES DO SEU FIREBASE.JS (Adicionamos o 'db' aqui)
import { auth, participantsCol, getParticipantDoc, db } from "./firebase.js";

// 2. IMPORTAÇÕES DE AUTENTICAÇÃO
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// 3. IMPORTAÇÕES DO FIRESTORE (Adicionamos addDoc, collection, updateDoc e arrayUnion)
import { 
    getDoc, 
    getDocs, 
    onSnapshot, 
    collection, 
    addDoc, 
    updateDoc, 
    arrayUnion 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 4. IMPORTAÇÕES LOCAIS
import * as ui from "./ui.js";
import * as game from "./game.js";
import * as admin from "./admin.js";

// 🔥 DEFINIMOS A COLEÇÃO AQUI PARA O APP.JS NÃO SE PERDER:
const matchesCol = collection(db, "matches");

let currentUser = null;

/**
 * 1. PENDURAR FUNÇÕES NO WINDOW
 * Necessário para que o HTML consiga chamar as funções via onclick="..."
 */
window.openHelp = ui.openHelp;
window.closeHelp = ui.closeHelp;
window.toggleDropdown = ui.toggleDropdown;
window.selectOption = ui.selectOption;
window.closeMatch = ui.closeMatch;
window.shareToInstagram = game.shareToInstagram;

// Função de Registro/Sorteio
window.handleRegistration = async () => {
    if (!currentUser) {
        alert("A aguardar ligação ao casino...");
        return;
    }

    const name = document.getElementById('userName').value.trim();
    let insta = document.getElementById('userInsta').value.trim();
    const gender = document.getElementById('userGender').value;
    const interest = document.getElementById('userInterest').value;

    if (!name || !insta || !gender || !interest) {
        alert("Por favor, preenche todos os campos para entrar no jogo!");
        return;
    }

    // Normaliza o Instagram
    if (!insta.startsWith('@')) insta = '@' + insta;

    // UI: Esconde formulário e mostra animação de embaralhar
    document.getElementById('registrationSection').classList.add('hidden-section');
    document.getElementById('shuffleSection').classList.remove('hidden-section');

    // Simula o tempo de "embaralhar" as cartas antes de gravar no Firebase
    setTimeout(() => {
        game.processDraw(currentUser, name, insta, gender, interest);
    }, 3000);
};

// 1. Configuração do tempo (60 segundos)
const COOLDOWN_DURATION = 60 * 1000;

// Função de Validação de Match com Cooldown incorporado
window.checkMatch = async () => {
    if (!currentUser || !game.myData) return;

    const targetInput = document.getElementById('targetCode');
    const validateBtn = document.querySelector('button[onclick="checkMatch()"]');
    const inputCode = targetInput.value.trim().toUpperCase();

    // Lógica de Cooldown (conforme fizemos antes)
    const lastAttempt = localStorage.getItem('last_match_attempt');
    if (lastAttempt && (Date.now() - lastAttempt < 60000)) {
        alert("Aguarde o tempo de recarga!");
        return;
    }

    if (!inputCode || inputCode === game.myData.matchCode) {
        alert("Código inválido!");
        return;
    }

    // Inicia Cooldown visual
    game.startCooldownUI?.(validateBtn, targetInput); 

    try {
        const snapshot = await getDocs(participantsCol);
        const otherDoc = snapshot.docs.find(d => d.data().matchCode === inputCode);

        if (!otherDoc) {
            alert("ID não encontrado!");
            return;
        }

        const otherData = otherDoc.data();
        const sortedCodes = [game.myData.matchCode, otherData.matchCode].sort();
        const prizeId = `ROYAL-${sortedCodes[0]}-${sortedCodes[1]}`;

        // Verifica se já ganharam
        if (game.myData.usedMatches?.includes(prizeId)) {
            alert("Este match já foi validado!");
            return;
        }

        const cardsMatch = (game.myData.suitName === otherData.suitName) || game.myData.is_joker || otherData.is_joker;

        if (cardsMatch) {
            // 🔥 REGISTRA O MATCH PARA O TELÃO OUVIR
            await addDoc(matchesCol, {
                p1_name: game.myData.name,
                p2_name: otherData.name,
                prizeId: prizeId,
                timestamp: new Date().toISOString()
            });

            // Atualiza o perfil do usuário para travar reuso
            await updateDoc(getParticipantDoc(game.myData.uid), {
                usedMatches: arrayUnion(prizeId)
            });

            game.processMatchResult(otherData);
        } else {
            alert("Os naipes não combinam!");
        }

    } catch (err) {
        console.error("Erro:", err);
    }
};

/**
 * Função Auxiliar para controlar o visual do cronômetro
 */
function startCooldownUI(button, input) {
    const startTime = Date.now();
    localStorage.setItem('last_match_attempt', startTime);

    button.disabled = true;
    input.disabled = true;

    // Adiciona classes de feedback visual (Tailwind)
    button.classList.add('opacity-50', 'cursor-not-allowed');

    const timer = setInterval(() => {
        const now = Date.now();
        const remaining = Math.ceil((COOLDOWN_DURATION - (now - startTime)) / 1000);

        if (remaining <= 0) {
            clearInterval(timer);
            button.disabled = false;
            input.disabled = false;
            button.innerText = "VALIDAR ENCONTRO";
            button.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            button.innerText = `AGUARDE (${remaining}s)`;
        }
    }, 1000);
}

/**
 * 2. MONITORIZAÇÃO DO ESTADO DO CORINGA
 * Atualiza o painel superior para todos os jogadores
 */
function monitorJokerStatus() {
    onSnapshot(participantsCol, (snapshot) => {
        const el = document.getElementById('jokerStatus');
        if (!el) return;

        const joker = snapshot.docs.find(d => d.data().is_joker);
        if (joker) {
            el.innerHTML = `👑 Coringa encontrado: <span class="text-white underline font-bold ml-1">${joker.data().name}</span>`;
        } else {
            el.innerHTML = `🃏 O Coringa ainda está no baralho...`;
        }
    });
}

/**
 * 3. INICIALIZAÇÃO E AUTENTICAÇÃO
 */
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        console.log("Sessão ativa:", user.uid);

        // Ativa o botão de sorteio
        const btn = document.getElementById('drawBtn');
        if (btn) btn.disabled = false;

        const msg = document.getElementById('authLoadingMsg');
        if (msg) msg.classList.add('hidden');

        // Verifica se o utilizador já tem uma carta sorteada nesta sessão/dispositivo
        const savedUid = localStorage.getItem('festa_uid_final_scale') || user.uid;

        try {
            const docSnap = await getDoc(getParticipantDoc(savedUid));
            if (docSnap.exists()) {
                const data = docSnap.data();
                game.showMyCard(data);
            }
        } catch (e) {
            console.error("Erro ao recuperar sessão:", e);
        }

        // Inicia a escuta global do status do coringa
        monitorJokerStatus();
    }

    // No final do onAuthStateChanged, adicione:
    const lastAttempt = localStorage.getItem('last_match_attempt');
    if (lastAttempt && (Date.now() - lastAttempt < COOLDOWN_DURATION)) {
        const btn = document.querySelector('button[onclick="checkMatch()"]');
        const input = document.getElementById('targetCode');
        if (btn && input) startCooldownUI(btn, input);
    }
});

// Inicia o login anónimo
signInAnonymously(auth).catch(err => {
    console.error("Erro crítico de autenticação:", err);
});