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
    const all = ['gender', 'interest'];

    all.forEach(d => {
        if (d !== type) {
            document.getElementById(d + 'Options')?.classList.remove('active');
            document.getElementById(d + 'Dropdown')?.classList.remove('active');
        }
    });

    const options = document.getElementById(type + 'Options');
    const dropdown = document.getElementById(type + 'Dropdown');
    options?.classList.toggle('active');
    dropdown?.classList.toggle('active');
}

export function selectOption(type, value, label) {
    const input = el('user' + type.charAt(0).toUpperCase() + type.slice(1));
    const labelEl = el(type + 'Label');
    const optionsEl = el(type + 'Options');
    const dropdownEl = el(type + 'Dropdown');

    if (input) input.value = value;
    if (labelEl) {
        labelEl.innerText = label;
        labelEl.style.color = '#d4af37'; // Dourado
    }
    if (optionsEl) optionsEl.classList.remove('active');
    if (dropdownEl) dropdownEl.classList.remove('active');
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
        document.querySelectorAll('.select-options').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.custom-select').forEach(el => el.classList.remove('active'));
    }
});