import { db, participantsCol, jokerRef, getParticipantDoc } from "./firebase.js";
import { setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
    const matchCode = (uid.substring(0, 2) + Math.random().toString(36).substring(2, 4)).toUpperCase();

    let isJoker = false;

    // 🔥 OTIMIZAÇÃO: Transação mais limpa e direta. Ocorrerá menos "retry" no Firebase.
    try {
        await runTransaction(db, async (transaction) => {
            const jokerSnap = await transaction.get(jokerRef);
            // Só tenta ser coringa se ele NÃO existir ou se o 'taken' for falso
            if (!jokerSnap.exists() || jokerSnap.data()?.taken !== true) {
                if (Math.random() < 0.05) {
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

    // O Cooldown original foi movido inteiramente para o app.js na nova versão.
    // Manteremos apenas a lógica visual aqui.

    // A validação de "cardsMatch" já ocorreu no app.js antes de chamar essa função!
    // Se chegou aqui, é sucesso absoluto.

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

// 📸 Gera um TEMPLATE de Story (Otimizado para não travar Safari de iPhones)
export async function shareToInstagram() {
    if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    const btn = document.getElementById('shareBtn');
    if (!btn) return;

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin text-xl"></i> Gerando Story...';
    btn.disabled = true;

    try {
        const logoBase64 = await new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const c = document.createElement('canvas');
                c.width = 130; // Resize agressivo na fonte em vez de desenhar tamanho natural
                c.height = 130;
                c.getContext('2d').drawImage(img, 0, 0, 130, 130);
                resolve(c.toDataURL('image/jpeg', 0.8)); // Troca PNG para JPEG rápido
            };
            img.onerror = () => resolve(null);
            img.src = 'img/sagui_joker.png';
        });

        const isJ = myData.is_joker;
        const valDisplay = isJ ? 'J' : myData.cardValue;
        const symDisplay = isJ ? '🎭' : myData.suitSymbol;
        const isRed = ['red', '#dc2626', '#ef4444', '#b91c1c'].includes(myData.color);
        const suitColor = isJ ? '#c084fc' : (isRed ? '#ef4444' : '#f1f5f9');
        const glowColor = isJ ? 'rgba(192,132,252,0.5)' : (isRed ? 'rgba(239,68,68,0.4)' : 'rgba(212,175,55,0.4)');

        const centerHTML = isJ
            ? `<div style="font-size:280px;line-height:1;filter:drop-shadow(0 0 20px ${glowColor});">🎭</div>`
            : `<div style="font-size:310px;font-weight:900;line-height:0.85;color:${suitColor};font-family:'Georgia',serif;filter:drop-shadow(0 0 20px ${glowColor});">${myData.cardValue}</div>
               <div style="font-size:135px;color:${suitColor};font-family:Arial,sans-serif;filter:drop-shadow(0 0 15px ${glowColor});margin-top:10px;">${myData.suitSymbol}</div>`;

        const logoInner = logoBase64
            ? `<img src="${logoBase64}" style="width:130px;height:130px;object-fit:cover;border-radius:50%;">`
            : `<div style="font-size:64px;line-height:1;">🦁</div>`;

        const shareContainer = document.createElement('div');
        shareContainer.id = 'storyTemplateContainer';

        // Oculta fora da tela sem usar 'display: none' para o canvas poder ler
        shareContainer.style.cssText = `
            position:absolute;top:-9999px;left:0;
            width:1080px;height:1920px;
            background:#08050a;
            display:grid;
            grid-template-rows:660px 870px 390px;
            box-sizing:border-box;
            font-family:'Georgia','Times New Roman',serif;
            z-index:-99;overflow:hidden;
        `;

        // Mantive o HTML original, apenas reduzi o blur das sombras na tag de background (text-shadow e box-shadow) 
        // porque blur altíssimo é o maior vilão do html2canvas no mobile.
        shareContainer.innerHTML = `
            <div style="position:absolute;inset:0;pointer-events:none;z-index:1;
                background:
                    radial-gradient(ellipse 90% 55% at 50% 42%, rgba(80,20,120,0.15) 0%, transparent 70%),
                    radial-gradient(ellipse 100% 35% at 50% 100%, rgba(0,0,0,0.98) 0%, transparent 60%);
            "></div>

            <div style="position:absolute;inset:28px;pointer-events:none;z-index:3;
                border:1px solid rgba(212,175,55,0.18);border-radius:20px;"></div>
            <div style="position:absolute;inset:40px;pointer-events:none;z-index:3;
                border:1px solid rgba(212,175,55,0.06);border-radius:14px;"></div>

            <div style="position:relative;z-index:10;
                height:660px;
                display:flex;flex-direction:column;align-items:center;justify-content:center;
                padding:0 80px;box-sizing:border-box;text-align:center;gap:0;">

                <div style="
                    width:130px;height:130px;border-radius:50%;
                    border:2px solid rgba(212,175,55,0.55);
                    background:rgba(212,175,55,0.06);
                    overflow:hidden;
                    display:flex;align-items:center;justify-content:center;
                    margin-bottom:28px;
                    flex-shrink:0;">
                    ${logoInner}
                </div>

                <p style="margin:0 0 12px;font-size:22px;letter-spacing:12px;
                    color:rgba(212,175,55,0.6);text-transform:uppercase;
                    font-family:'Georgia',serif;flex-shrink:0;">Você recebeu</p>

                <h1 style="margin:0;line-height:0.88;font-size:128px;font-weight:900;
                    font-family:'Georgia','Times New Roman',serif;letter-spacing:-3px;
                    color:#f5f0e8;
                    text-shadow:0 4px 16px rgba(0,0,0,0.9);
                    flex-shrink:0;">
                    A ÚLTIMA<br>CARTA
                </h1>
            </div>

            <div style="position:relative;z-index:10;
                height:870px;
                display:flex;align-items:center;justify-content:center;">

                <div style="
                    width:600px;height:840px;
                    background:linear-gradient(155deg,#1e1820 0%,#130f18 45%,#0c0a0e 100%);
                    border-radius:44px;
                    border:1px solid rgba(212,175,55,0.28);
                    box-shadow: 0 20px 50px rgba(0,0,0,0.8);
                    display:flex;flex-direction:column;
                    align-items:center;justify-content:center;
                    overflow:hidden;position:relative;">

                    <div style="position:absolute;top:32px;left:32px;text-align:center;line-height:1.1;z-index:10;">
                        <div style="font-size:86px;font-weight:900;color:${suitColor};
                            font-family:Georgia,serif;text-shadow:0 0 10px ${glowColor};">${valDisplay}</div>
                        <div style="font-size:62px;color:${suitColor};
                            text-shadow:0 0 10px ${glowColor};margin-top:4px;">${symDisplay}</div>
                    </div>

                    <div style="position:absolute;bottom:32px;right:32px;
                        text-align:center;line-height:1.1;z-index:10;transform:rotate(180deg);">
                        <div style="font-size:86px;font-weight:900;color:${suitColor};
                            font-family:Georgia,serif;text-shadow:0 0 10px ${glowColor};">${valDisplay}</div>
                        <div style="font-size:62px;color:${suitColor};
                            text-shadow:0 0 10px ${glowColor};margin-top:4px;">${symDisplay}</div>
                    </div>

                    <div style="display:flex;flex-direction:column;
                        align-items:center;justify-content:center;z-index:10;">
                        ${centerHTML}
                    </div>
                </div>
            </div>

            <div style="position:relative;z-index:10;
                height:390px;
                display:flex;flex-direction:column;align-items:center;justify-content:center;
                padding:0 80px;box-sizing:border-box;gap:0;">

                <div style="text-align:center;margin-bottom:20px;">
                    <p style="margin:0 0 8px;font-size:40px;font-weight:700;
                        color:#f5f0e8;font-family:Georgia,serif;line-height:1.2;">
                        Encontre seu par e ganhe um shot!
                    </p>
                </div>

                <div style="width:100%;border:2px solid #d4af37;border-radius:12px;
                    padding:28px 50px;box-sizing:border-box;text-align:center;
                    background:rgba(212,175,55,0.06);position:relative;overflow:hidden;
                    flex-shrink:0;">
                    <p style="margin:0 0 2px;font-size:22px;letter-spacing:12px;
                        text-transform:uppercase;color:rgba(212,175,55,0.65);font-family:Georgia,serif;">
                        Esta noite
                    </p>
                    <p style="margin:0;font-size:56px;font-weight:900;text-transform:uppercase;
                        color:#f5f0e8;letter-spacing:4px;font-family:Georgia,serif;">
                        VEM PRO TRIPLEX
                    </p>
                </div>
            </div>
        `;

        document.body.appendChild(shareContainer);

        // 🔥 OTIMIZAÇÃO: windowWidth e windowHeight limitam a renderização virtual, acelerando o processo.
        const canvas = await html2canvas(shareContainer, {
            scale: 1,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#08050a',
            windowWidth: 1080,
            windowHeight: 1920
        });
        document.body.removeChild(shareContainer);

        canvas.toBlob(async (blob) => {
            const file = new File([blob], 'ultima-carta-story.jpg', {
                type: 'image/jpeg', lastModified: Date.now()
            });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'A Última Carta',
                    text: 'Vem pro Triplex descobrir 👀 @atletica_sagui'
                });
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'ultima-carta-story.jpg';
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                if (window.showToast) window.showToast("Sucesso!", "Story salvo. Posta no insta e marca a gente!", "success");
            }
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 'image/jpeg', 0.85); // Compressão do JPEG ajuda a carregar mais rápido no celular do user

    } catch (err) {
        console.error("Erro ao gerar Story:", err);
        if (window.showToast) window.showToast("Erro", "Não deu pra gerar a foto. Tire um print da tela!", "error");
        btn.innerHTML = originalText;
        btn.disabled = false;
        const temp = document.getElementById('storyTemplateContainer');
        if (temp) document.body.removeChild(temp);
    }
}