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
    const matchMsg = el('matchMsg');
    const voucherDiv = el('prizeVoucher');

    const iWantThem = ['all', 'party'].includes(myData.interest) || myData.interest === other.gender;
    const theyWantMe = ['all', 'party'].includes(other.interest) || other.interest === myData.gender;
    const cardsMatch = (myData.suitName === other.suitName) || myData.is_joker || other.is_joker;

    const instaDisplay = other.instagram ? `<br><a href="https://instagram.com/${other.instagram.replace('@', '')}" target="_blank" class="text-pink-400 text-sm mt-3 inline-block bg-white/10 px-4 py-2 rounded-full border border-pink-500/30 active:scale-95 transition"><i class="fab fa-instagram"></i> ${other.instagram}</a>` : '';

    if (iWantThem && theyWantMe && cardsMatch) {
        if (matchMsg) matchMsg.innerHTML = `O DESTINO FALOU! ✨<br>Tu e ${other.name} combinam perfeitamente. ${instaDisplay}`;

        const sortedCodes = [myData.matchCode, other.matchCode].sort();
        const prizeId = `ROYAL-${sortedCodes[0]}-${sortedCodes[1]}`;

        if (el('qrCodeImg')) el('qrCodeImg').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${prizeId}`;
        if (el('voucherCode')) el('voucherCode').innerText = prizeId;
        if (voucherDiv) voucherDiv.classList.remove('hidden');
        
        if (typeof confetti === 'function') confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 } });
    } else {
        if (matchMsg) matchMsg.innerHTML = `Naipes diferentes ou as vossas vibes não batem! Continuem a procurar... 🥃 ${instaDisplay}`;
        if (voucherDiv) voucherDiv.classList.add('hidden');
    }

    if (el('matchModal')) el('matchModal').classList.remove('hidden');
}

/**
 * 📸 Gera um print da carta e abre o menu de compartilhamento do celular
 */
/**
 * 📸 Gera um TEMPLATE de Story (1080x1920) e abre o menu de compartilhamento
 */
/**
 * 📸 Gera um TEMPLATE de Story (1080x1920) à prova de bugs de CORS e Rotação
 */
/**
 * 📸 Gera um TEMPLATE de Story (1080x1920) à prova de bugs de CORS e Rotação
 */
export async function shareToInstagram() {
    const btn = document.getElementById('shareBtn');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin text-xl"></i> Gerando Story...';
    btn.disabled = true;

    try {
        // Extrair dados da carta
        const isJ = myData.is_joker;
        const valDisplay = isJ ? 'J' : myData.cardValue;
        const symDisplay = isJ ? '🎭' : myData.suitSymbol;
        
        // 🔥 CORREÇÃO 1: O centro agora tem o Valor GIGANTE e o Naipe embaixo (ou só a máscara se for Coringa)
        const centerHTML = isJ 
            ? `<div style="font-size: 320px; text-shadow: 0 10px 20px rgba(0,0,0,0.2);">🎭</div>`
            : `<div style="font-size: 320px; font-weight: 900; line-height: 0.85; text-shadow: 0 10px 20px rgba(0,0,0,0.2);">${myData.cardValue}</div>
               <div style="font-size: 140px; margin-top: 10px; text-shadow: 0 5px 10px rgba(0,0,0,0.2);">${myData.suitSymbol}</div>`;
        
        const cardBg = '#ffffff';
        const cardBorder = isJ ? '#a855f7' : '#d4af37';
        const textCol = isJ ? '#a855f7' : myData.color;

        // Criar o container do Story
        const shareContainer = document.createElement('div');
        shareContainer.id = "storyTemplateContainer"; 
        shareContainer.style.position = 'fixed';
        shareContainer.style.top = '-9999px'; 
        shareContainer.style.left = '0';
        shareContainer.style.width = '1080px';
        shareContainer.style.height = '1920px';
        shareContainer.style.background = 'linear-gradient(to bottom, #450a0a, #000000)'; 
        shareContainer.style.display = 'flex';
        shareContainer.style.flexDirection = 'column';
        shareContainer.style.alignItems = 'center';
        shareContainer.style.justifyContent = 'center';
        shareContainer.style.fontFamily = "sans-serif"; 
        shareContainer.style.zIndex = '-99';

        shareContainer.innerHTML = `
            <div style="text-align: center; margin-bottom: 70px;">
                <img src="img/sagui_joker.png" crossorigin="anonymous" style="width: 280px; height: 280px; margin: 0 auto 30px auto; object-fit: cover; display: block;">
                
                <h1 style="color: #d4af37; font-size: 130px; font-weight: 900; margin: 0; line-height: 1; text-transform: uppercase;">A última Carta</h1>
                
                <p style="color: #d4af37; font-size: 32px; letter-spacing: 12px; font-weight: 900; text-transform: uppercase; margin-top: 15px;">COLA NO TRIPLEX! VEM CURTIR COM A SAGUI</p>
            </div>

            <div style="width: 650px; height: 950px; background-color: ${cardBg}; border: 15px solid ${cardBorder}; border-radius: 40px; position: relative; padding: 40px; color: ${textCol}; box-sizing: border-box;">
                
                <div style="position: absolute; top: 40px; left: 40px; text-align: center; line-height: 1;">
                    <div style="font-size: 90px; font-weight: 900;">${valDisplay}</div>
                    <div style="font-size: 70px; margin-top: 5px;">${symDisplay}</div>
                </div>

                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
                    ${centerHTML}
                </div>

                <div style="position: absolute; bottom: 40px; right: 40px; text-align: center; line-height: 1; transform: rotate(180deg);">
                    <div style="font-size: 90px; font-weight: 900;">${valDisplay}</div>
                    <div style="font-size: 70px; margin-top: 5px;">${symDisplay}</div>
                </div>
            </div>

            <div style="margin-top: 100px; background-color: #2a0505; border: 4px solid #d4af37; padding: 40px 60px; border-radius: 60px; text-align: center; box-shadow: 0 15px 30px rgba(0,0,0,0.5);">
                <p style="font-size: 45px; font-weight: 900; margin: 0; color: white;">Me ache no triplex e ganhe um Shot da Sagui! 🥂</p>
                
                <p style="font-size: 32px; font-weight: bold; margin: 15px 0 0 0; color: #d4af37;">@atletica_sagui | @triplex.sp</p>
            </div>
        `;

        document.body.appendChild(shareContainer);

        // Tirar a foto
        const canvas = await html2canvas(shareContainer, {
            scale: 1, 
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: null 
        });

        // Limpar o DOM
        document.body.removeChild(shareContainer);

        // Converter e Partilhar
        canvas.toBlob(async (blob) => {
            const file = new File([blob], 'matchparty-story.jpg', { type: 'image/jpeg', lastModified: Date.now() });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'A Última Carta',
                    text: 'Quem é o meu par? 👀 @atletica_sagui',
                });
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'matchparty-story.jpg';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                alert("📸 Story salvo na galeria! Abre o Instagram e posta marcando a Atlética!");
            }
            
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 'image/jpeg', 0.95);

    } catch (err) {
        console.error("Erro ao gerar Story:", err);
        alert("Ops, não conseguimos gerar o Story automático. Tira um print da tela mesmo!");
        btn.innerHTML = originalText;
        btn.disabled = false;
        const temp = document.getElementById('storyTemplateContainer');
        if(temp) document.body.removeChild(temp);
    }
}