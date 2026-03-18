import { auth, participantsCol, getParticipantDoc } from "./firebase.js";
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getDoc, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import * as ui from "./ui.js";
import * as game from "./game.js";
import * as admin from "./admin.js";

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

// Função de Validação de Match
window.checkMatch = async () => {
    if (!currentUser || !game.myData) return;

    const inputCode = document.getElementById('targetCode').value.trim().toUpperCase();
    if (!inputCode || inputCode === game.myData.matchCode) {
        alert("Insere um código de parceiro válido!");
        return;
    }

    try {
        const snapshot = await getDocs(participantsCol);
        const otherDoc = snapshot.docs.find(d => d.data().matchCode === inputCode);

        if (!otherDoc) {
            alert("ID não encontrado nesta mesa!");
            return;
        }

        // Chama a lógica visual de resultado do match no game.js
        game.processMatchResult(otherDoc.data());
    } catch (err) {
        console.error("Erro ao validar encontro:", err);
    }
};

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
});

// Inicia o login anónimo
signInAnonymously(auth).catch(err => {
    console.error("Erro crítico de autenticação:", err);
});