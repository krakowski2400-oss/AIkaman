// State management
let authToken = localStorage.getItem('auth_token');
let selectedStyleId = null;
let currentTaskId = null;
let selectedFiles = [];

// DOM Elements - Global
const loginOverlay = document.getElementById('login-overlay');
const appContainer = document.getElementById('app-container');
const pinInput = document.getElementById('pin-input');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const userLimitDisplay = document.getElementById('user-limit');
const logoutBtn = document.getElementById('logout-btn');

// DOM Elements - Wizard
const step1Zone = document.getElementById('step1-zone');
const step2Zone = document.getElementById('step2-zone');
const step3Zone = document.getElementById('step3-zone');
const indStep1 = document.getElementById('indicator-step1');
const indStep2 = document.getElementById('indicator-step2');
const indStep3 = document.getElementById('indicator-step3');

// DOM Elements - Step 1
const stylesListFullscreen = document.getElementById('styles-list-fullscreen');

// DOM Elements - Step 2
const backToStep1Btn = document.getElementById('back-to-step1-btn');
const selectedStyleLabel = document.getElementById('selected-style-label');
const fileInput = document.getElementById('file-input');
const dropArea = document.getElementById('drop-area');
const imagePreviewContainer = document.getElementById('image-preview-container');
const previewsGrid = document.getElementById('previews-grid');
const addMoreImagesBtn = document.getElementById('add-more-images-btn');
const customPromptContainer = document.getElementById('custom-prompt-container');
const customPromptInput = document.getElementById('custom-prompt-input');
const generateBtn = document.getElementById('generate-btn');

// DOM Elements - Step 3
const processingState = document.getElementById('processing-state');
const resultState = document.getElementById('result-state');
const processStatus = document.getElementById('process-status');
const processProgress = document.getElementById('process-progress');
const resultsGrid = document.getElementById('results-grid');
const downloadZipBtn = document.getElementById('download-zip-btn');
const finishBtn = document.getElementById('finish-btn');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        showApp();
    }
});

// Auth Functions
async function login() {
    const pin = pinInput.value;
    if (!pin) return;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            localStorage.setItem('auth_token', authToken);
            showApp();
            updateLimitDisplay(data.user);
        } else {
            loginError.textContent = data.error || 'Błąd logowania';
        }
    } catch (err) {
        loginError.textContent = 'Błąd połączenia z serwerem';
    }
}

function showApp() {
    loginOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');
    loadStyles();
    goToStep(1);
}

function logout() {
    localStorage.removeItem('auth_token');
    location.reload();
}

function updateLimitDisplay(user) {
    if(user) {
        userLimitDisplay.textContent = `Limit: ${user.usedToday}/${user.dailyLimit}`;
    }
}

// Wizard Navigation
function goToStep(step) {
    // Reset indicators
    indStep1.classList.remove('active');
    indStep2.classList.remove('active');
    indStep3.classList.remove('active');

    // Reset zones
    step1Zone.classList.add('hidden');
    step2Zone.classList.add('hidden');
    step3Zone.classList.add('hidden');

    if (step === 1) {
        indStep1.classList.add('active');
        step1Zone.classList.remove('hidden');
    } else if (step === 2) {
        indStep2.classList.add('active');
        step2Zone.classList.remove('hidden');
    } else if (step === 3) {
        indStep3.classList.add('active');
        step3Zone.classList.remove('hidden');
    }
}

// Step 1 Logic
async function loadStyles() {
    try {
        const response = await fetch('/api/styles');
        const styles = await response.json();

        stylesListFullscreen.innerHTML = styles.map(style => `
            <div class="style-card" onclick="selectStyle('${style.id}', '${style.name}')">
                <img src="${style.thumbnail}" alt="${style.name}">
                <div class="style-info">
                    <h4>${style.name}</h4>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Błąd ładowania stylów:', err);
    }
}

window.selectStyle = (id, name) => {
    selectedStyleId = id;
    selectedStyleLabel.textContent = `Wybrany styl: ${name}`;
    
    if (id === 'custom') {
        customPromptContainer.classList.remove('hidden');
    } else {
        customPromptContainer.classList.add('hidden');
    }

    goToStep(2);
};

backToStep1Btn.addEventListener('click', () => {
    goToStep(1);
});

// Step 2 Logic: Upload
dropArea.addEventListener('click', () => fileInput.click());
addMoreImagesBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFilesSelect(Array.from(e.target.files));
    }
});

// Opcjonalne: Drag & Drop
dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropArea.parentElement.classList.add('dragover');
});
dropArea.addEventListener('dragleave', () => {
    dropArea.parentElement.classList.remove('dragover');
});
dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dropArea.parentElement.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFilesSelect(Array.from(e.dataTransfer.files));
    }
});

function handleFilesSelect(files) {
    const remainingSlots = 5 - selectedFiles.length;
    const filesToAdd = files.slice(0, remainingSlots);

    if (files.length > remainingSlots && remainingSlots > 0) {
        alert(`Możesz dodać jeszcze tylko ${remainingSlots} zdjęć (Max: 5).`);
    } else if (remainingSlots === 0) {
        alert('Osiągnięto limit 5 zdjęć.');
        return;
    }

    selectedFiles = [...selectedFiles, ...filesToAdd];
    updatePreviews();
}

function updatePreviews() {
    if (selectedFiles.length > 0) {
        dropArea.classList.add('hidden');
        imagePreviewContainer.classList.remove('hidden');
        
        previewsGrid.innerHTML = '';
        selectedFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewItem = document.createElement('div');
                previewItem.className = 'preview-item';
                previewItem.innerHTML = `
                    <img src="${e.target.result}" alt="Preview">
                    <button class="remove-btn" onclick="removeImage(${index})">×</button>
                `;
                previewsGrid.appendChild(previewItem);
            };
            reader.readAsDataURL(file);
        });

        if (selectedFiles.length >= 5) {
            addMoreImagesBtn.classList.add('hidden');
        } else {
            addMoreImagesBtn.classList.remove('hidden');
        }
    } else {
        dropArea.classList.remove('hidden');
        imagePreviewContainer.classList.add('hidden');
    }
}

window.removeImage = (index) => {
    selectedFiles.splice(index, 1);
    fileInput.value = ''; // Reset input to allow re-selecting the same file
    updatePreviews();
};

// Generation Trigger
generateBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
        alert('Najpierw wgraj co najmniej jedno zdjęcie produktu!');
        return;
    }

    if (!selectedStyleId) {
        alert('Wybierz studio!');
        return;
    }

    const formData = new FormData();
    selectedFiles.forEach(file => {
        formData.append('images', file);
    });
    
    formData.append('styleId', selectedStyleId);

    // Get Aspect Ratio
    const arElement = document.querySelector('input[name="aspectRatio"]:checked');
    const aspectRatio = arElement ? arElement.value : '1:1';
    formData.append('aspectRatio', aspectRatio);

    // Get Resolution
    const resElement = document.querySelector('input[name="resolution"]:checked');
    const resolution = resElement ? resElement.value : '4K';
    formData.append('resolution', resolution);

    if (selectedStyleId === 'custom') {
        const prompt = customPromptInput.value.trim();
        if (!prompt) {
            alert('Wpisz opis dla własnego promptu!');
            return;
        }
        formData.append('customPrompt', prompt);
    }

    // Switch UI to processing (Step 3)
    goToStep(3);
    processingState.classList.remove('hidden');
    resultState.classList.add('hidden');
    processStatus.textContent = 'Wysyłanie danych...';
    processProgress.textContent = '';

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            startSSE(data.taskId);
        } else {
            if (response.status === 401 || response.status === 403) {
                alert('Sesja wygasła. Zaloguj się ponownie.');
                logout();
            } else {
                alert(data.error || 'Błąd podczas uruchamiania generowania');
                goToStep(2); // Go back on error
            }
        }
    } catch (err) {
        alert('Błąd połączenia z serwerem');
        goToStep(2);
    }
});

// Step 3 Logic: SSE & Results
function startSSE(taskId) {
    currentTaskId = taskId;
    const eventSource = new EventSource(`/api/stream/${taskId}`);

    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.error) {
            alert(data.error);
            eventSource.close();
            goToStep(2);
            return;
        }

        processStatus.textContent = data.status === 'processing' ? 'Magia w toku...' : 'W kolejce...';
        processProgress.textContent = data.progress;

        // Update Progress Bar
        const progressBarFill = document.getElementById('progress-bar-fill');
        if (progressBarFill) {
            if (data.progress.includes('1 z 4')) progressBarFill.style.width = '25%';
            else if (data.progress.includes('2 z 4')) progressBarFill.style.width = '50%';
            else if (data.progress.includes('3 z 4')) progressBarFill.style.width = '75%';
            else if (data.progress.includes('4 z 4')) progressBarFill.style.width = '90%';
            else if (data.progress.includes('Pakowanie')) progressBarFill.style.width = '95%';
            else if (data.status === 'completed') progressBarFill.style.width = '100%';
            else if (data.status === 'queued') progressBarFill.style.width = '5%';
            else if (data.progress.includes('Inicjalizacja')) progressBarFill.style.width = '15%';
        }

        if (data.status === 'completed') {
            eventSource.close();
            showResults(data.resultUrls, data.zipUrl);
            fetchUserStatus();
        }

        if (data.status === 'error') {
            eventSource.close();
            alert(data.error || 'Wystąpił nieznany błąd');
            goToStep(2);
        }
    };
}

async function fetchUserStatus() {
    // Placeholder - would call api to get latest usedToday
}

function showResults(urls, zipUrl) {
    processingState.classList.add('hidden');
    resultState.classList.remove('hidden');

    resultsGrid.innerHTML = urls.map(url => `
        <div class="result-card">
            <img src="${url}" alt="Wariant">
            <div class="card-overlay">
                <a href="${url}" download class="btn-primary">Pobierz</a>
            </div>
        </div>
    `).join('');

    if (zipUrl) {
        downloadZipBtn.href = zipUrl;
    }
}

function resetWizard() {
    selectedFiles = [];
    fileInput.value = '';
    customPromptInput.value = '';
    updatePreviews();
    currentTaskId = null;
    
    // Reset radio buttons to default
    const defaultAr = document.querySelector('input[name="aspectRatio"][value="1:1"]');
    if(defaultAr) defaultAr.checked = true;
    
    const defaultRes = document.querySelector('input[name="resolution"][value="4K"]');
    if(defaultRes) defaultRes.checked = true;
    
    goToStep(1);
}

// Event Listeners
loginBtn.addEventListener('click', login);
pinInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') login(); });
logoutBtn.addEventListener('click', logout);

finishBtn.addEventListener('click', () => {
    if (currentTaskId) {
        fetch(`/api/cleanup/${currentTaskId}`, { method: 'DELETE' });
    }
    resetWizard();
});
