// ==================== STATE ====================
let downloadUrl     = null;
let productsData    = [];
let currentMode     = 'drive';
let personSets      = [];
let personCounter   = 0;
let customRefFiles  = [null, null, null, null];   // Custom mode ref images

// ==================== MODE SWITCHING ====================
function switchMode(mode) {
    currentMode = mode;

    ['drive', 'upload', 'custom'].forEach(m => {
        document.getElementById(`tab-${m}`).classList.toggle('active', m === mode);
        document.getElementById(`mode-${m}`).style.display = m === mode ? '' : 'none';
    });

    hideError();
    resetUI();

    if (mode === 'upload' && personSets.length === 0) addPersonSet();
    if (mode === 'custom') initCustomRefGrid();
}

// ==================== CUSTOM MODE ====================
function initCustomRefGrid() {
    const grid = document.getElementById('customRefGrid');
    if (grid.children.length > 0) return;   // already rendered
    grid.innerHTML = '';

    for (let i = 0; i < 4; i++) {
        const slot = document.createElement('div');
        slot.className = 'photo-slot';
        slot.id = `custom-slot-${i}`;
        slot.innerHTML = buildCustomSlotInner(i, null);
        grid.appendChild(slot);
        attachCustomSlotEvents(slot, i);
    }
}

function buildCustomSlotInner(i, file) {
    const labels = ['Ref 1', 'Ref 2', 'Ref 3', 'Ref 4'];
    if (file && file._dataUrl) {
        return `<img src="${file._dataUrl}" alt="Ref ${i+1}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">`;
    }
    return `
        <input type="file" accept="image/*" id="custom-file-${i}">
        <div class="slot-empty">
            <span class="slot-icon">📷</span>
            <span class="slot-text">${labels[i]}</span>
        </div>
        <span class="photo-slot-label">${labels[i]}</span>`;
}

function attachCustomSlotEvents(slot, i) {
    // Re-query after innerHTML changes
    const bindEvents = () => {
        const input = document.getElementById(`custom-file-${i}`);
        if (input) {
            input.addEventListener('change', e => {
                handleCustomFileSelect(i, e.target.files[0]);
            });
        }

        slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('drag-over'); });
        slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
        slot.addEventListener('drop', e => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) handleCustomFileSelect(i, file);
        });

        slot.addEventListener('click', e => {
            if (slot.classList.contains('has-image') && e.target.tagName !== 'INPUT') {
                clearCustomSlot(i);
            }
        });
    };
    bindEvents();
}

function handleCustomFileSelect(i, file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
        file._dataUrl = e.target.result;
        customRefFiles[i] = file;

        const slot = document.getElementById(`custom-slot-${i}`);
        slot.classList.add('has-image');
        slot.innerHTML = buildCustomSlotInner(i, file);
        attachCustomSlotEvents(slot, i);
    };
    reader.readAsDataURL(file);
}

function clearCustomSlot(i) {
    customRefFiles[i] = null;
    const slot = document.getElementById(`custom-slot-${i}`);
    slot.classList.remove('has-image');
    slot.innerHTML = buildCustomSlotInner(i, null);
    attachCustomSlotEvents(slot, i);
}

// ==================== PERSON SETS ====================
function addPersonSet() {
    const id = ++personCounter;
    personSets.push({ id, files: [null, null, null, null], description: '' });
    renderPersonSets();
}

function removePersonSet(id) {
    if (personSets.length === 1) return;
    personSets = personSets.filter(p => p.id !== id);
    renderPersonSets();
}

function renderPersonSets() {
    const container = document.getElementById('personsContainer');
    container.innerHTML = '';

    personSets.forEach((person, idx) => {
        const set = document.createElement('div');
        set.className = 'person-set';
        set.id = `person-set-${person.id}`;

        set.innerHTML = `
            <div class="person-set-header">
                <div class="person-set-title">
                    <span class="badge">${idx + 1}</span>
                    Osoba ${idx + 1}
                </div>
                ${personSets.length > 1
                    ? `<button class="btn-remove-person" onclick="removePersonSet(${person.id})" title="Usuń">✕</button>`
                    : ''}
            </div>
            <div class="photo-grid">
                ${[0,1,2,3].map(s => buildSlotHTML(person.id, s, person.files[s])).join('')}
            </div>
            <div class="description-group">
                <label class="description-label">💼 Zawód / opis (np. "Prawnik", "Lekarz")</label>
                <textarea class="neo-textarea" rows="2"
                    placeholder="Podaj zawód lub krótki opis osoby..."
                    id="desc-${person.id}"
                    oninput="updateDescription(${person.id}, this.value)"
                >${person.description}</textarea>
            </div>`;

        container.appendChild(set);

        [0,1,2,3].forEach(slotIdx => {
            const input = document.getElementById(`file-${person.id}-${slotIdx}`);
            if (input) {
                input.addEventListener('change', e =>
                    handleFileSelect(person.id, slotIdx, e.target.files[0]));
            }

            const slot = document.getElementById(`slot-${person.id}-${slotIdx}`);
            if (slot) {
                slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('drag-over'); });
                slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
                slot.addEventListener('drop', e => {
                    e.preventDefault();
                    slot.classList.remove('drag-over');
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) handleFileSelect(person.id, slotIdx, file);
                });
                slot.addEventListener('click', e => {
                    if (slot.classList.contains('has-image') && e.target.tagName !== 'INPUT') {
                        clearSlot(person.id, slotIdx);
                    }
                });
            }
        });
    });
}

function buildSlotHTML(personId, slotIdx, file) {
    const labels   = ['Zdjęcie 1', 'Zdjęcie 2', 'Zdjęcie 3', 'Zdjęcie 4'];
    const hasImage = file !== null;
    return `
        <div class="photo-slot ${hasImage ? 'has-image' : ''}" id="slot-${personId}-${slotIdx}">
            <input type="file" id="file-${personId}-${slotIdx}" accept="image/*" ${hasImage ? 'style="display:none"' : ''}>
            ${hasImage
                ? `<img id="img-${personId}-${slotIdx}" src="${file._dataUrl || ''}" alt="Zdjęcie">`
                : `<div class="slot-empty">
                       <span class="slot-icon">📷</span>
                       <span class="slot-text">${labels[slotIdx]}</span>
                   </div>`}
            ${!hasImage ? `<span class="photo-slot-label">${labels[slotIdx]}</span>` : ''}
        </div>`;
}

function handleFileSelect(personId, slotIdx, file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
        const person = personSets.find(p => p.id === personId);
        if (!person) return;
        file._dataUrl = e.target.result;
        person.files[slotIdx] = file;

        const slot = document.getElementById(`slot-${personId}-${slotIdx}`);
        slot.classList.add('has-image');

        slot.querySelector('.slot-empty')?.remove();
        slot.querySelector('.photo-slot-label')?.remove();
        const input = slot.querySelector('input[type="file"]');
        if (input) input.style.display = 'none';

        let img = slot.querySelector('img');
        if (!img) {
            img = document.createElement('img');
            img.id  = `img-${personId}-${slotIdx}`;
            img.alt = 'Zdjęcie';
            slot.insertBefore(img, slot.firstChild);
        }
        img.src          = e.target.result;
        img.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function clearSlot(personId, slotIdx) {
    const person = personSets.find(p => p.id === personId);
    if (!person) return;
    person.files[slotIdx] = null;
    renderPersonSets();
}

function updateDescription(personId, value) {
    const person = personSets.find(p => p.id === personId);
    if (person) person.description = value;
}

// ==================== VALIDATION ====================
function validateUpload() {
    for (const person of personSets) {
        if (!person.files.some(f => f !== null)) {
            showError(`Osoba #${personSets.indexOf(person) + 1}: brak zdjęć. Dodaj co najmniej 1.`);
            return false;
        }
        if (!person.description.trim()) {
            showError(`Osoba #${personSets.indexOf(person) + 1}: brak opisu / zawodu.`);
            return false;
        }
    }
    return true;
}

function validateCustom() {
    const prompt = document.getElementById('customPrompt').value.trim();
    if (!prompt) {
        showError('Proszę wpisać prompt przed generowaniem.');
        return false;
    }
    if (prompt.length < 10) {
        showError('Prompt jest za krótki – opisz dokładniej co chcesz wygenerować.');
        return false;
    }
    return true;
}

// ==================== ERROR / UI HELPERS ====================
function showError(message) {
    const el = document.getElementById('errorMessage');
    el.innerHTML = `<strong>❌ Błąd:</strong> ${message}`;
    el.style.display = 'block';
}

function hideError() {
    document.getElementById('errorMessage').style.display = 'none';
}

function addLog(message, type = 'info') {
    const lc = document.getElementById('logContainer');
    lc.style.display = 'block';
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    lc.appendChild(entry);
    lc.scrollTop = lc.scrollHeight;
}

function resetUI() {
    document.getElementById('progressContainer').style.display  = 'none';
    document.getElementById('progressFill').style.width         = '0%';
    document.getElementById('progressFill').querySelector('.progress-text').textContent = '0%';
    document.getElementById('statusMessage').textContent        = '';
    document.getElementById('downloadSection').style.display    = 'none';
    document.getElementById('productList').style.display        = 'none';
    document.getElementById('productList').innerHTML            = '';
    document.getElementById('logContainer').style.display       = 'none';
    document.getElementById('logContainer').innerHTML           = '';
    document.getElementById('previewSection').style.display     = 'none';
    document.getElementById('previewGrid').innerHTML            = '';
    productsData = [];
    downloadUrl  = null;

    const btn = document.getElementById('processBtn');
    btn.disabled  = false;
    btn.className = 'btn neo-button';
    btn.innerHTML = `<span class="btn-icon">🚀</span><span class="btn-text">Generuj Kreacje</span>`;
}

// ==================== PRODUCT LIST ====================
function renderProductList(products) {
    const lc = document.getElementById('productList');
    lc.style.display = 'block';
    productsData     = products.map((p, idx) => ({ id: idx, name: p }));
    lc.innerHTML     = productsData.map(product => `
        <div class="product-item" id="product-${product.id}">
            <span class="product-name">${product.name}</span>
            <span class="product-status pending" id="status-${product.id}">Oczekuje</span>
        </div>`).join('');
}

function updateProductStatus(productName, status) {
    const product = productsData.find(p => p.name === productName);
    if (!product) return;
    const el = document.getElementById(`status-${product.id}`);
    if (!el) return;
    el.className   = `product-status ${status}`;
    el.textContent = { pending: 'Oczekuje', processing: 'Przetwarzanie…',
                       complete: 'Gotowe ✓', error: 'Błąd' }[status] || status;
}

// ==================== PREVIEW ====================

function addPreviewImages(productName, base64Images) {
    if (!base64Images || base64Images.length === 0) return;

    const section = document.getElementById('previewSection');
    const grid    = document.getElementById('previewGrid');

    section.style.display = 'block';

    const header = document.createElement('div');
    header.className   = 'preview-product-header';
    header.textContent = productName;
    grid.appendChild(header);

    const tileRow = document.createElement('div');
    tileRow.className = 'preview-tile-row';

    base64Images.forEach((b64, i) => {
        const tile = document.createElement('div');
        tile.className = 'preview-tile';

        const img    = document.createElement('img');
        img.src      = `data:image/png;base64,${b64}`;
        img.alt      = `Kreacja ${i + 1}`;
        img.loading  = 'lazy';

        const label        = document.createElement('div');
        label.className    = 'preview-tile-label';
        label.textContent  = `Wariant ${i + 1}`;

        // ✅ Lightbox on click
        tile.addEventListener('click', () => openLightbox(base64Images, i));

        tile.appendChild(img);
        tile.appendChild(label);
        tileRow.appendChild(tile);
    });

    grid.appendChild(tileRow);
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ==================== SSE STREAM READER ====================
async function readStream(response) {
    const reader        = response.body.getReader();
    const decoder       = new TextDecoder();
    const progressFill  = document.getElementById('progressFill');
    const progressText  = progressFill.querySelector('.progress-text');
    const statusMessage = document.getElementById('statusMessage');
    const downloadSect  = document.getElementById('downloadSection');
    const processBtn    = document.getElementById('processBtn');
    let   totalProducts = 0;

    document.getElementById('progressContainer').style.display = 'block';

    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();   // keep incomplete last line

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            let data;
            try { data = JSON.parse(line.substring(6)); } catch { continue; }

            if (data.heartbeat) continue;

            if (data.error) {
                showError(data.error);
                addLog(`❌ ${data.error}`, 'error');
                // ✅ FIX: Reset wszystkich "Przetwarzanie…" statusów
                productsData.forEach(p => {
                    const el = document.getElementById(`status-${p.id}`);
                    if (el && el.textContent === 'Przetwarzanie…') {
                        el.className   = 'product-status pending';
                        el.textContent = 'Oczekuje';
                    }
                });
                processBtn.disabled  = false;
                processBtn.className = 'btn neo-button';
                processBtn.innerHTML = `<span class="btn-icon">🔄</span><span class="btn-text">Spróbuj ponownie</span>`;
                continue;
            }

            if (data.step === 'init') {
                addLog(data.status, 'info');
                statusMessage.textContent = data.status;
            }

            if (data.step === 'scan') {
                totalProducts = data.total;
                addLog(data.status, 'success');
                statusMessage.textContent = data.status;
                if (data.products) renderProductList(data.products);
            }

            if (data.step === 'processing') {
                updateProductStatus(data.product, 'processing');
                addLog(`[${data.current}/${data.total}] ${data.product}: ${data.status}`, 'info');
                statusMessage.textContent = `[${data.current}/${data.total}] ${data.status}`;
                const pct = Math.round(((data.current - 1) / data.total) * 100);
                progressFill.style.width  = `${pct}%`;
                progressText.textContent  = `${pct}%`;
            }

            if (data.step === 'complete') {
                updateProductStatus(data.product, 'complete');
                addLog(`✅ Zakończono: ${data.product}`, 'success');
                // ✅ Podgląd po każdym ukończonym produkcie
                if (data.preview_images?.length) {
                    addPreviewImages(data.product, data.preview_images);
                }
            }

            if (data.step === 'error') {
                updateProductStatus(data.product, 'error');
                addLog(`❌ Błąd: ${data.product}: ${data.error}`, 'error');
            }

            if (data.step === 'packaging') {
                statusMessage.textContent = data.status;
                addLog(data.status, 'info');
            }

            if (data.step === 'done') {
                progressFill.style.width = '100%';
                progressText.textContent = '100%';
                downloadUrl = data.download_url;
                addLog(`🎉 Zakończono! Przetworzono ${data.total_processed} produktów`, 'success');
                statusMessage.textContent = '✅ Gotowe!';
                processBtn.className = 'btn neo-button success';
                processBtn.innerHTML = `<span class="btn-icon">✓</span><span class="btn-text">Zakończono</span>`;
                downloadSect.style.display = 'block';
                document.getElementById('downloadBtn').onclick = () => window.location.href = downloadUrl;
                downloadSect.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }
}

// ==================== MAIN: START PROCESSING ====================
async function startProcessing() {
    hideError();

    const processBtn = document.getElementById('processBtn');
    processBtn.disabled  = true;
    processBtn.className = 'btn neo-button processing';
    processBtn.innerHTML = `<span class="btn-icon">⏳</span><span class="btn-text">Przetwarzanie w toku...</span>`;

    addLog('🚀 Rozpoczynam przetwarzanie...', 'info');

    try {
        if (currentMode === 'drive')       await processDriveMode();
        else if (currentMode === 'upload') await processUploadMode();
        else if (currentMode === 'custom') await processCustomMode();
    } catch (err) {
        showError(err.message);
        addLog(`❌ ${err.message}`, 'error');
        processBtn.disabled  = false;
        processBtn.className = 'btn neo-button';
        processBtn.innerHTML = `<span class="btn-icon">🔄</span><span class="btn-text">Spróbuj ponownie</span>`;
    }
}

// ── Drive mode ───────────────────────────────────────────────────────────────
async function processDriveMode() {
    const folderLink = document.getElementById('folderLink').value.trim();
    if (!folderLink) {
        showError('Proszę wkleić link do folderu Google Drive');
        throw new Error('Brak linku');
    }
    const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_link: folderLink }),
    });
    await readStream(response);
}

// ── Upload mode ──────────────────────────────────────────────────────────────
async function processUploadMode() {
    if (!validateUpload()) throw new Error('Walidacja nie powiodła się');

    personSets.forEach(person => {
        const ta = document.getElementById(`desc-${person.id}`);
        if (ta) person.description = ta.value;
    });

    const formData = new FormData();
    formData.append('persons_count', personSets.length);

    renderProductList(personSets.map((p, i) => p.description || `Osoba ${i + 1}`));

    personSets.forEach((person, idx) => {
        formData.append(`description_${idx}`, person.description.trim());
        person.files.forEach((file, slotIdx) => {
            if (file) formData.append(`image_${idx}_${slotIdx}`, file, file.name);
        });
    });

    const response = await fetch('/api/process-upload', { method: 'POST', body: formData });
    await readStream(response);
}

// ── Custom mode ──────────────────────────────────────────────────────────────
async function processCustomMode() {
    if (!validateCustom()) throw new Error('Walidacja nie powiodła się');

    const prompt   = document.getElementById('customPrompt').value.trim();
    const formData = new FormData();
    formData.append('prompt', prompt);

    const refCount = customRefFiles.filter(f => f !== null).length;
    customRefFiles.forEach((file, i) => {
        if (file) formData.append(`ref_image_${i}`, file, file.name);
    });

    renderProductList(['Custom kreacja']);
    addLog(`📝 Prompt: ${prompt.substring(0, 80)}...`, 'info');
    if (refCount > 0) addLog(`📸 Dołączono ${refCount} zdjęć referencyjnych`, 'info');

    const response = await fetch('/api/process-custom', { method: 'POST', body: formData });
    await readStream(response);
}
// ==================== LIGHTBOX ====================
let lightboxImages = [];
let lightboxIndex  = 0;

function openLightbox(images, startIndex) {
    lightboxImages = images;
    lightboxIndex  = startIndex;

    // Remove existing
    document.getElementById('lightbox-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.id        = 'lightbox-overlay';

    overlay.innerHTML = `
        <button class="lightbox-close" onclick="closeLightbox()">✕</button>
        <button class="lightbox-nav prev" onclick="lightboxNav(-1)">&#8249;</button>
        <img id="lightbox-img" src="" alt="Podgląd">
        <button class="lightbox-nav next" onclick="lightboxNav(1)">&#8250;</button>
        <div class="lightbox-counter" id="lightbox-counter"></div>`;

    overlay.addEventListener('click', e => {
        if (e.target === overlay) closeLightbox();
    });

    document.body.appendChild(overlay);
    updateLightbox();

    // Keyboard navigation
    document._lightboxKeyHandler = e => {
        if (e.key === 'ArrowLeft')  lightboxNav(-1);
        if (e.key === 'ArrowRight') lightboxNav(1);
        if (e.key === 'Escape')     closeLightbox();
    };
    document.addEventListener('keydown', document._lightboxKeyHandler);
}

function updateLightbox() {
    const img     = document.getElementById('lightbox-img');
    const counter = document.getElementById('lightbox-counter');
    if (!img) return;
    img.src          = `data:image/png;base64,${lightboxImages[lightboxIndex]}`;
    counter.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;

    // Hide nav buttons if only 1 image
    document.querySelectorAll('.lightbox-nav').forEach(btn => {
        btn.style.display = lightboxImages.length <= 1 ? 'none' : '';
    });
}

function lightboxNav(dir) {
    lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
    updateLightbox();
}

function closeLightbox() {
    document.getElementById('lightbox-overlay')?.remove();
    document.removeEventListener('keydown', document._lightboxKeyHandler);
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('folderLink').addEventListener('keypress', e => {
        if (e.key === 'Enter') startProcessing();
    });

    // Custom textarea – Enter nie submituje, Shift+Enter = nowa linia (domyślnie)
    document.getElementById('customPrompt')?.addEventListener('keypress', e => {
        if (e.key === 'Enter' && e.ctrlKey) startProcessing();
    });
});