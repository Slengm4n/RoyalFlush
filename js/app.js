// 1. IMPORTAÇÕES DO SEU FIREBASE.JS
import { auth, participantsCol, getParticipantDoc, db, matchesCol } from "./firebase.js";

// 2. IMPORTAÇÕES DE AUTENTICAÇÃO
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// 3. IMPORTAÇÕES DO FIRESTORE (Adicionado query, where e limit para otimização extrema)
import {
    getDoc,
    getDocs,
    onSnapshot,
    collection,
    addDoc,
    updateDoc,
    arrayUnion,
    query,
    where,
    limit
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// 4. IMPORTAÇÕES LOCAIS
import * as ui from "./ui.js";
import * as game from "./game.js";

let currentUser = null;

/**
 * 1. PENDURAR FUNÇÕES NO WINDOW
 */
window.openHelp = ui.openHelp;
window.closeHelp = ui.closeHelp;
window.toggleDropdown = ui.toggleDropdown;
window.selectOption = ui.selectOption;
window.closeMatch = ui.closeMatch;
window.shareToInstagram = game.shareToInstagram;

// --- SISTEMA DE ALERTAS CUSTOMIZADOS ---
window.showToast = (title, message, type = 'warning') => {
    const existingToast = document.getElementById('customToast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'customToast';

    let styleClasses = '';
    let iconHTML = '';

    if (type === 'error') {
        styleClasses = 'bg-red-950/90 border-red-500 text-red-200';
        iconHTML = '<i class="fas fa-times-circle text-3xl mb-1 text-red-500"></i>';
    } else if (type === 'warning') {
        styleClasses = 'bg-yellow-950/90 border-yellow-500 text-yellow-200';
        iconHTML = '<i class="fas fa-exclamation-triangle text-3xl mb-1 text-yellow-500"></i>';
    } else {
        styleClasses = 'bg-green-950/90 border-green-500 text-green-200';
        iconHTML = '<i class="fas fa-check-circle text-3xl mb-1 text-green-500"></i>';
    }

    toast.className = `fixed top-10 left-1/2 transform -translate-x-1/2 z-[999] w-11/12 max-w-sm p-4 rounded-2xl border-2 shadow-2xl backdrop-blur-md text-center transition-all duration-500 opacity-0 -translate-y-10 ${styleClasses}`;
    toast.innerHTML = `
        ${iconHTML}
        <h3 class="font-black uppercase tracking-widest text-lg leading-tight mt-2">${title}</h3>
        <p class="text-sm mt-1 opacity-90 font-medium">${message}</p>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('opacity-0', '-translate-y-10');
        toast.classList.add('opacity-100', 'translate-y-0');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', '-translate-y-10');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
};

// Função de Registro/Sorteio (Otimizada com Loading Visual)
window.handleRegistration = async () => {
    if (!currentUser) {
        window.showToast("Aguarde...", "Conectando ao servidor do cassino.", "warning");
        return;
    }

    const name = document.getElementById('userName').value.trim();
    let insta = document.getElementById('userInsta').value.trim();
    const gender = document.getElementById('userGender').value;
    const interest = document.getElementById('userInterest').value;

    if (!name || !insta || !gender || !interest) {
        window.showToast("Faltam Dados", "Por favor, preencha todos os campos para entrar no jogo!", "warning");
        return;
    }

    if (!insta.startsWith('@')) insta = '@' + insta;

    // 🔥 OTIMIZAÇÃO DE UX: Desabilita o botão e mostra Loading
    const btn = document.getElementById('drawBtn');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Embaralhando...';
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    // UI: Esconde formulário e mostra animação
    document.getElementById('registrationSection').classList.add('hidden-section');
    document.getElementById('shuffleSection').classList.remove('hidden-section');

    setTimeout(() => {
        game.processDraw(currentUser, name, insta, gender, interest);
        // Não precisamos reabilitar o botão aqui porque a tela vai mudar para o Card do usuário
    }, 3000);
};

const COOLDOWN_DURATION = 60 * 1000;

// Função de Validação de Match (Otimizada para Redes 4G lentas)
window.checkMatch = async () => {
    if (!currentUser || !game.myData) return;

    const targetInput = document.getElementById('targetCode');
    const validateBtn = document.querySelector('button[onclick="checkMatch()"]');
    const inputCode = targetInput.value.trim().toUpperCase();

    const lastAttempt = localStorage.getItem('last_match_attempt');
    if (lastAttempt && (Date.now() - Number(lastAttempt) < 60000)) {
        const remaining = Math.ceil((60000 - (Date.now() - lastAttempt)) / 1000);
        window.showToast("Muita Calma!", `Aguarde ${remaining}s antes de tentar novamente.`, "warning");
        return;
    }

    if (!inputCode || inputCode === game.myData.matchCode) {
        window.showToast("Código Inválido", "Insira o código de outra pessoa.", "error");
        targetInput.value = '';
        return;
    }

    startCooldownUI(validateBtn, targetInput);

    try {
        // 🔥 OTIMIZAÇÃO EXTREMA: Em vez de baixar todos, baixa apenas 1 documento
        const q = query(participantsCol, where("matchCode", "==", inputCode), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            window.showToast("Não Encontrado", "Ninguém com esse código na festa.", "error");
            targetInput.value = '';
            targetInput.focus();
            return;
        }

        const otherData = snapshot.docs[0].data();

        const sortedCodes = [game.myData.matchCode, otherData.matchCode].sort();
        const prizeId = `ROYAL-${sortedCodes[0]}-${sortedCodes[1]}`;

        const iAlreadyMatched = game.myData.usedMatches?.includes(prizeId);
        const theyAlreadyMatched = otherData.usedMatches?.includes(prizeId);

        if (iAlreadyMatched || theyAlreadyMatched) {
            window.showToast("Já deram Match!", "A fila anda! Encontre um par diferente para ganharem.", "warning");
            targetInput.value = '';
            return;
        }

        const mySuit = String(game.myData.suitName || "").trim().toLowerCase();
        const theirSuit = String(otherData.suitName || "").trim().toLowerCase();

        const cardsMatch = (mySuit === theirSuit) || (game.myData.is_joker === true) || (otherData.is_joker === true);

        if (cardsMatch) {
            await addDoc(matchesCol, {
                p1_name: game.myData.name,
                p2_name: otherData.name,
                prizeId: prizeId,
                timestamp: new Date().toISOString()
            });

            await updateDoc(getParticipantDoc(game.myData.uid), {
                usedMatches: arrayUnion(prizeId)
            });

            await updateDoc(getParticipantDoc(otherData.uid), {
                usedMatches: arrayUnion(prizeId)
            });

            if (!game.myData.usedMatches) game.myData.usedMatches = [];
            game.myData.usedMatches.push(prizeId);

            targetInput.value = ''; // Limpa para o próximo
            game.processMatchResult(otherData);
        } else {
            window.showToast("Naipes Diferentes!", `Você: ${game.myData.suitName}<br>Alvo: ${otherData.suitName}`, "error");
            targetInput.value = '';
            targetInput.focus();
        }

    } catch (err) {
        console.error("Erro ao validar match:", err);
        window.showToast("Erro na Conexão", "Sua internet oscilou. Tente novamente.", "error");
    }
};

function startCooldownUI(button, input) {
    const startTime = Date.now();
    localStorage.setItem('last_match_attempt', startTime);

    button.disabled = true;
    input.disabled = true;
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

function monitorJokerStatus() {
    // 🔥 OTIMIZAÇÃO: Busca apenas o Coringa em vez de baixar todo mundo o tempo todo
    const jokerQuery = query(participantsCol, where("is_joker", "==", true), limit(1));

    onSnapshot(jokerQuery, (snapshot) => {
        const el = document.getElementById('jokerStatus');
        if (!el) return;

        if (!snapshot.empty) {
            const joker = snapshot.docs[0];
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

        const btn = document.getElementById('drawBtn');
        if (btn) btn.disabled = false;

        const msg = document.getElementById('authLoadingMsg');
        if (msg) msg.classList.add('hidden');

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

        monitorJokerStatus();
    }

    const lastAttempt = localStorage.getItem('last_match_attempt');
    if (lastAttempt && (Date.now() - lastAttempt < COOLDOWN_DURATION)) {
        const btn = document.querySelector('button[onclick="checkMatch()"]');
        const input = document.getElementById('targetCode');
        if (btn && input) startCooldownUI(btn, input);
    }
});

signInAnonymously(auth).catch(err => {
    console.error("Erro crítico de autenticação:", err);
});