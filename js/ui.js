// Funções que cuidam apenas do visual (Modais, Dropdowns)

// 🔥 OTIMIZAÇÃO: Um atalho rápido para não ficar repetindo document.getElementById
const el = (id) => document.getElementById(id);

export function openHelp() {
    const modal = el('helpModal');
    if (modal) modal.classList.remove('hidden');
}

export function closeHelp() {
    const modal = el('helpModal');
    if (modal) modal.classList.add('hidden');
}

export function toggleDropdown(type) {
    const options = el(type + 'Options');
    const otherType = type === 'gender' ? 'interest' : 'gender';
    const otherOptions = el(otherType + 'Options');
    
    if (otherOptions) otherOptions.classList.remove('active');
    if (options) options.classList.toggle('active');
}

export function selectOption(type, value, label) {
    const input = el('user' + type.charAt(0).toUpperCase() + type.slice(1));
    const labelEl = el(type + 'Label');
    const optionsEl = el(type + 'Options');

    if (input) input.value = value;
    if (labelEl) {
        labelEl.innerText = label;
        labelEl.style.color = '#d4af37'; // Dourado
    }
    if (optionsEl) optionsEl.classList.remove('active');
}

export function closeMatch() {
    const modal = el('matchModal');
    const input = el('targetCode');
    
    if (modal) modal.classList.add('hidden');
    if (input) input.value = ""; // Já limpa o código quando a pessoa fecha a janela
}

// Fecha dropdowns ao clicar fora (Já estava perfeito e super otimizado)
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select')) {
        document.querySelectorAll('.select-options').forEach(opt => opt.classList.remove('active'));
    }
});