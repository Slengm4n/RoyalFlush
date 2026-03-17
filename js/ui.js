// Funções que cuidam apenas do visual (Modais, Dropdowns)
export function openHelp() {
    document.getElementById('helpModal').classList.remove('hidden');
}

export function closeHelp() {
    document.getElementById('helpModal').classList.add('hidden');
}

export function toggleDropdown(type) {
    const options = document.getElementById(type + 'Options');
    const otherType = type === 'gender' ? 'interest' : 'gender';
    const otherOptions = document.getElementById(otherType + 'Options');
    if (otherOptions) otherOptions.classList.remove('active');
    if (options) options.classList.toggle('active');
}

export function selectOption(type, value, label) {
    const input = document.getElementById('user' + type.charAt(0).toUpperCase() + type.slice(1));
    const labelEl = document.getElementById(type + 'Label');
    const optionsEl = document.getElementById(type + 'Options');

    if (input) input.value = value;
    if (labelEl) {
        labelEl.innerText = label;
        labelEl.style.color = '#d4af37';
    }
    if (optionsEl) optionsEl.classList.remove('active');
}

export function closeMatch() {
    document.getElementById('matchModal').classList.add('hidden');
    document.getElementById('targetCode').value = "";
}

// Fecha dropdowns ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select')) {
        document.querySelectorAll('.select-options').forEach(el => el.classList.remove('active'));
    }
});