import { db, participantsCol, jokerRef, getParticipantDoc } from "./firebase.js";
import { setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export let myData = null;

const el = (id) => document.getElementById(id);

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
                if (Math.random() < 0.05) { 
                    isJoker = true;
                    transaction.set(jokerRef, { taken: true, winner: uid, name: name });
                }
            }
        });
    } catch (e) { console.error("Erro na transação do Coringa:", e); }

    // 🔥 AQUI ESTÁ A MÁGICA DO GÊNERO:
    let targetText = "alguém";
    if (interest === 'f') {
        targetText = "uma mulher";
    } else if (interest === 'm') {
        targetText = "um homem";
    } // Se for 'all' (ambos) ou 'party' (só curtição), continua sendo "alguém"

    const participantData = {
        uid, name, instagram: insta, gender, interest,
        suitName: isJoker ? 'Coringa' : randomSuit.name,
        suitSymbol: isJoker ? '🎭' : randomSuit.symbol,
        cardValue: isJoker ? 'J' : randomValue,
        color: isJoker ? '#a855f7' : randomSuit.color,
        is_joker: isJoker,
        matchCode,
        // 🔥 AQUI USAMOS A VARIÁVEL QUE CRIAMOS:
        suggestion: isJoker ? "Tu és o Caos! Encontra quem quiseres para o teu Match Perfeito." :
            `Encontra ${targetText} com o naipe de ${randomSuit.name}!`,
        createdAt: new Date().toISOString()
    };

    await setDoc(getParticipantDoc(uid), participantData);
    localStorage.setItem('festa_uid_final_scale', uid);
    showMyCard(participantData);
}

export function showMyCard(data) {
    myData = data;

    if (el('registrationSection')) el('registrationSection').classList.add('hidden-section');
    if (el('shuffleSection')) el('shuffleSection').classList.add('hidden-section');
    if (el('revealSection')) el('revealSection').classList.remove('hidden-section');

    if (el('topValue')) el('topValue').innerText = data.cardValue;
    if (el('topSymbol')) el('topSymbol').innerText = data.suitSymbol;
    if (el('botValue')) el('botValue').innerText = data.cardValue;
    if (el('botSymbol')) el('botSymbol').innerText = data.suitSymbol;
    
    const mainValue = el('mainValue');
    const mainSuit = el('mainSuit');
    const cardContent = el('cardContent');

    if (cardContent) {
       if (data.is_joker) {
            if (mainValue) mainValue.innerText = ''; 
            if (mainSuit) {
                mainSuit.innerText = '🤡'; 
                mainSuit.className = 'text-[8rem] mt-2 drop-shadow-2xl animate-pulse';
            }
            
            cardContent.classList.remove('joker-card-front'); 
            cardContent.classList.add('joker-glow');
            
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

    if (el('myMatchCode')) el('myMatchCode').innerText = data.matchCode;
    if (el('suitName')) el('suitName').innerText = data.suitName;
    if (el('matchSuggestion')) el('matchSuggestion').innerText = data.suggestion;

    setTimeout(() => {
        if (el('finalCard')) el('finalCard').classList.add('is-flipped');
    }, 600);
}

export function processMatchResult(other) {
    // 1. Definir os elementos primeiro para não dar erro de "undefined"
    const matchMsg = el('matchMsg');
    const voucherDiv = el('prizeVoucher');
    
    // 2. Lógica de Cooldown
    const COOLDOWN_TIME = 30 * 1000; // 30 segundos
    const lastMatch = localStorage.getItem('lastMatchTimeStamp');
    const now = Date.now();

    if (lastMatch && (now - lastMatch < COOLDOWN_TIME)) {
        if (matchMsg) matchMsg.innerHTML = `<span class="text-yellow-500">Aguarde um pouco antes de buscar o próximo destino...</span>`;
        if (el('matchModal')) el('matchModal').classList.remove('hidden');
        return;
    }

    // 3. Verificação de Match (Considerando naipes ou Coringa)
    // Importante: Verifique se 'myData' está disponível neste arquivo
    const cardsMatch = (myData.suitName === other.suitName) || myData.is_joker || other.is_joker;

    const instaDisplay = other.instagram ? `<br><a href="https://instagram.com/${other.instagram.replace('@', '')}" target="_blank" class="text-pink-400 text-sm mt-3 inline-block bg-white/10 px-4 py-2 rounded-full border border-pink-500/30 active:scale-95 transition"><i class="fab fa-instagram"></i> ${other.instagram}</a>` : '';

    // 4. Se deu Match
    if (cardsMatch) {
        // Salva o timestamp apenas se o match for bem-sucedido
        localStorage.setItem('lastMatchTimeStamp', Date.now());

        if (matchMsg) matchMsg.innerHTML = `O DESTINO FALOU! ✨<br>Tu e ${other.name} combinam perfeitamente. ${instaDisplay}`;

        const sortedCodes = [myData.matchCode, other.matchCode].sort();
        const prizeId = `ROYAL-${sortedCodes[0]}-${sortedCodes[1]}`;

        if (el('qrCodeImg')) el('qrCodeImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${prizeId}`;
        if (el('voucherCode')) el('voucherCode').innerText = prizeId;
        
        if (voucherDiv) {
            voucherDiv.classList.remove('hidden');
            voucherDiv.style.display = 'block'; // Força a exibição
        }
        
        if (typeof confetti === 'function') confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 } });
    } else {
        // Se NÃO deu match
        if (matchMsg) matchMsg.innerHTML = `Ops! Os naipes não batem... <br> Tente encontrar alguém de <strong>${myData.suitName}</strong>!`;
        if (voucherDiv) voucherDiv.classList.add('hidden');
    }

    // Abre o modal em ambos os casos
    if (el('matchModal')) el('matchModal').classList.remove('hidden');
}

// 📸 Gera um TEMPLATE de Story (1080x1920) com o layout perfeitamente distribuído e com a carta BRANCA
export async function shareToInstagram() {
    const btn = document.getElementById('shareBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin text-xl"></i> Gerando Story...';
    btn.disabled = true;

    try {
        const logoBase64 = await new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const c = document.createElement('canvas');
                c.width = img.naturalWidth; c.height = img.naturalHeight;
                c.getContext('2d').drawImage(img, 0, 0);
                resolve(c.toDataURL('image/png'));
            };
            img.onerror = () => resolve(null);
            img.src = 'img/sagui_joker.png';
        });

        const isJ = myData.is_joker;
        const valDisplay = isJ ? 'J' : myData.cardValue;
        const symDisplay = isJ ? '🎭' : myData.suitSymbol;
        const isRed = ['red','#dc2626','#ef4444','#b91c1c'].includes(myData.color);
        const suitColor = isJ ? '#c084fc' : (isRed ? '#ef4444' : '#f1f5f9');
        const glowColor = isJ ? 'rgba(192,132,252,0.75)' : (isRed ? 'rgba(239,68,68,0.65)' : 'rgba(212,175,55,0.55)');

     const centerHTML = isJ
            ? `<div style="font-size:280px;line-height:1;filter:drop-shadow(0 0 50px rgba(192,132,252,0.9));">🎭</div>`
            : `<div style="font-size:310px;font-weight:900;line-height:0.85;color:${suitColor};
                font-family:'Georgia',serif;filter:drop-shadow(0 0 50px ${glowColor});">${myData.cardValue}</div>
               <div style="font-size:135px;color:${suitColor};font-family:Arial,sans-serif;
                filter:drop-shadow(0 0 30px ${glowColor});margin-top:10px;">${myData.suitSymbol}</div>`;

        const logoInner = logoBase64
            ? `<img src="${logoBase64}" style="width:130px;height:130px;object-fit:cover;border-radius:50%;">`
            : `<div style="font-size:64px;line-height:1;">🦁</div>`;

        const shareContainer = document.createElement('div');
        shareContainer.id = 'storyTemplateContainer';
        shareContainer.style.cssText = `
            position:fixed;top:-9999px;left:0;
            width:1080px;height:1920px;
            background:#08050a;
            display:grid;
            grid-template-rows:660px 870px 390px;
            box-sizing:border-box;
            font-family:'Georgia','Times New Roman',serif;
            z-index:-99;overflow:hidden;
        `;

        shareContainer.innerHTML = `

            <div style="position:absolute;inset:0;pointer-events:none;z-index:1;
                background:
                    radial-gradient(ellipse 90% 55% at 50% 42%, rgba(80,20,120,0.20) 0%, transparent 70%),
                    radial-gradient(ellipse 100% 35% at 50% 100%, rgba(0,0,0,0.98) 0%, transparent 60%),
                    radial-gradient(ellipse 55% 40% at 0% 50%, rgba(0,0,0,0.55) 0%, transparent 55%),
                    radial-gradient(ellipse 55% 40% at 100% 50%, rgba(0,0,0,0.55) 0%, transparent 55%);
            "></div>

            <div style="position:absolute;inset:0;pointer-events:none;z-index:2;
                background:repeating-linear-gradient(to bottom,
                    transparent 0px,transparent 3px,
                    rgba(0,0,0,0.06) 3px,rgba(0,0,0,0.06) 4px);
            "></div>

            <div style="position:absolute;inset:28px;pointer-events:none;z-index:3;
                border:1px solid rgba(212,175,55,0.18);border-radius:20px;"></div>
            <div style="position:absolute;inset:40px;pointer-events:none;z-index:3;
                border:1px solid rgba(212,175,55,0.06);border-radius:14px;"></div>

            ${['top:28px;left:28px','top:28px;right:28px;transform:scaleX(-1)','bottom:28px;left:28px;transform:scaleY(-1)','bottom:28px;right:28px;transform:scale(-1,-1)'].map(p=>`
            <div style="position:absolute;${p};width:80px;height:80px;pointer-events:none;z-index:4;">
                <div style="position:absolute;top:0;left:0;width:80px;height:2px;
                    background:linear-gradient(to right,#d4af37,transparent);"></div>
                <div style="position:absolute;top:0;left:0;width:2px;height:80px;
                    background:linear-gradient(to bottom,#d4af37,transparent);"></div>
            </div>`).join('')}

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
                    text-shadow:0 0 120px rgba(212,175,55,0.18),0 4px 16px rgba(0,0,0,0.9);
                    flex-shrink:0;">
                    A ÚLTIMA<br>CARTA
                </h1>

                <div style="display:flex;align-items:center;gap:20px;margin-top:18px;flex-shrink:0;">
                    <div style="width:90px;height:1px;background:rgba(212,175,55,0.38);"></div>
                    <div style="width:90px;height:1px;background:rgba(212,175,55,0.38);"></div>
                </div>
            </div>

            <div style="position:relative;z-index:10;
                height:870px;
                display:flex;align-items:center;justify-content:center;">

                <div style="
                    width:600px;height:840px;
                    background:linear-gradient(155deg,#1e1820 0%,#130f18 45%,#0c0a0e 100%);
                    border-radius:44px;
                    border:1px solid rgba(212,175,55,0.28);
                    box-shadow:
                        0 0 0 1px rgba(212,175,55,0.07),
                        0 0 100px rgba(120,40,200,0.12),
                        0 0 50px rgba(212,175,55,0.07),
                        inset 0 1px 0 rgba(255,255,255,0.05),
                        0 40px 80px rgba(0,0,0,0.95);
                    display:flex;flex-direction:column;
                    align-items:center;justify-content:center;
                    overflow:hidden;position:relative;">

                    <div style="position:absolute;top:0;left:0;right:0;height:220px;
                        background:linear-gradient(to bottom,rgba(255,255,255,0.03),transparent);
                        border-radius:44px 44px 0 0;pointer-events:none;"></div>

                    <div style="position:absolute;top:32px;left:32px;text-align:center;line-height:1.1;z-index:10;">
                        <div style="font-size:86px;font-weight:900;color:${suitColor};
                            font-family:Georgia,serif;text-shadow:0 0 28px ${glowColor};">${valDisplay}</div>
                        <div style="font-size:62px;color:${suitColor};
                            text-shadow:0 0 20px ${glowColor};margin-top:4px;">${symDisplay}</div>
                    </div>

                    <div style="position:absolute;bottom:32px;right:32px;
                        text-align:center;line-height:1.1;z-index:10;transform:rotate(180deg);">
                        <div style="font-size:86px;font-weight:900;color:${suitColor};
                            font-family:Georgia,serif;text-shadow:0 0 28px ${glowColor};">${valDisplay}</div>
                        <div style="font-size:62px;color:${suitColor};
                            text-shadow:0 0 20px ${glowColor};margin-top:4px;">${symDisplay}</div>
                    </div>

                    <div style="display:flex;flex-direction:column;
                        align-items:center;justify-content:center;z-index:10;">
                        ${centerHTML}
                    </div>

                    <div style="position:absolute;left:36px;right:36px;top:50%;height:1px;
                        background:linear-gradient(to right,transparent,rgba(212,175,55,0.06),transparent);
                        pointer-events:none;"></div>
                </div>
            </div>

            <div style="position:relative;z-index:10;
                height:390px;
                display:flex;flex-direction:column;align-items:center;justify-content:center;
                padding:0 80px;box-sizing:border-box;gap:0;">

                <div style="text-align:center;margin-bottom:20px;">
                    <p style="margin:0 0 8px;font-size:40px;font-weight:700;
                        color:#f5f0e8;font-family:Georgia,serif;line-height:1.2;">
                        Encontre seu par e ganhe um shot da Sagui!
                    </p>
                    <p style="margin:0;font-size:24px;color:rgba(212,175,55,0.68);
                        letter-spacing:1px;font-family:Georgia,serif;font-style:italic;">
                        — mas primeiro você precisa entrar no jogo.
                    </p>
                </div>

                <div style="width:100%;border:2px solid #d4af37;border-radius:12px;
                    padding:28px 50px;box-sizing:border-box;text-align:center;
                    background:rgba(212,175,55,0.06);position:relative;overflow:hidden;
                    flex-shrink:0;">
                    <div style="position:absolute;top:0;left:0;right:0;height:1px;
                        background:linear-gradient(to right,transparent,rgba(212,175,55,0.5),transparent);"></div>
                    <p style="margin:0 0 2px;font-size:22px;letter-spacing:12px;
                        text-transform:uppercase;color:rgba(212,175,55,0.65);font-family:Georgia,serif;">
                        Esta noite
                    </p>
                    <p style="margin:0;font-size:56px;font-weight:900;text-transform:uppercase;
                        color:#f5f0e8;letter-spacing:4px;font-family:Georgia,serif;
                        text-shadow:0 0 30px rgba(212,175,55,0.22);">
                        VEM PRO TRIPLEX
                    </p>
                    <p style="margin:4px 0 0;font-size:22px;letter-spacing:6px;
                        text-transform:uppercase;color:rgba(212,175,55,0.6);font-family:Georgia,serif;">
                        descobrir o que é isso
                    </p>
                </div>

                <div style="display:flex;align-items:center;gap:18px;margin-top:18px;">
                    <div style="width:110px;height:1px;
                        background:linear-gradient(to right,transparent,rgba(212,175,55,0.3));"></div>
                    <span style="font-size:22px;color:rgba(212,175,55,0.48);letter-spacing:4px;
                        font-family:Georgia,serif;text-transform:uppercase;">
                        @atletica_sagui · @triplex.sp
                    </span>
                    <div style="width:110px;height:1px;
                        background:linear-gradient(to left,transparent,rgba(212,175,55,0.3));"></div>
                </div>
            </div>
        `;

        document.body.appendChild(shareContainer);

        const canvas = await html2canvas(shareContainer, {
            scale: 1, useCORS: true, allowTaint: true,
            logging: false, backgroundColor: '#08050a'
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
                alert("📸 Story salvo! Posta no Instagram e marca a Atlética!");
            }
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 'image/jpeg', 0.95);

    } catch (err) {
        console.error("Erro ao gerar Story:", err);
        alert("Não conseguimos gerar o Story. Tira um print da tela mesmo!");
        btn.innerHTML = originalText;
        btn.disabled = false;
        const temp = document.getElementById('storyTemplateContainer');
        if (temp) document.body.removeChild(temp);
    }
}