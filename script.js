document.addEventListener('DOMContentLoaded', () => {
            const GITHUB_CLIENT_ID = 'Ov23li37SgznSIABGOVP'; 
            const MIN_ANIMATION_TIME = 3000;
            const UPLOAD_COUNT_FOR_SUPPORT_MODAL = 3;

            // --- State Global ---
            let accessToken = null;
            let selectedFiles = [];
            let selectedRepo = '';
            let targetFolder = '';
            let filesToExtract = [];
            let isRepoInitiallyEmpty = false;
            let uploadCount = parseInt(localStorage.getItem('uploadPro_uploadCount')) || 0;

            const views = {
                login: document.getElementById('login-view'),
                dashboard: document.getElementById('dashboard-view'),
                modalContainer: document.getElementById('modal-container'),
                uploading: document.getElementById('uploading-view'),
            };
            const userElements = { name: document.getElementById('user-name'), avatar: document.getElementById('user-avatar') };
            const buttons = { login: document.getElementById('login-btn'), logout: document.getElementById('logout-btn'), startUpload: document.getElementById('start-upload-btn') };
            const fileInput = document.getElementById('file-input');
            const dropZone = document.getElementById('drop-zone');
            const fileList = document.getElementById('file-list');
            const uploadStatusText = document.getElementById('upload-status-text');
            const toast = document.getElementById('toast');
            const toastMessage = document.getElementById('toast-message');

            const showView = (viewName) => {
                Object.values(views).forEach(view => view.classList.add('hidden'));
                if (views[viewName]) views[viewName].classList.remove('hidden');
            };
            
            const showModal = (modalHtml) => {
                views.modalContainer.innerHTML = modalHtml;
                showView('modalContainer');
                const modalCard = views.modalContainer.querySelector('.card');
                if (modalCard) modalCard.classList.add('modal-enter');
            };

            const closeModal = () => {
                const modalCard = views.modalContainer.querySelector('.card');
                if (modalCard) {
                    modalCard.classList.remove('modal-enter');
                    modalCard.classList.add('modal-leave');
                    setTimeout(() => {
                        views.modalContainer.innerHTML = '';
                        showView('dashboard');
                    }, 300);
                } else {
                     showView('dashboard');
                }
            };

            const showToast = (message, isError = false) => {
                toastMessage.textContent = message;
                toast.classList.remove('hidden', 'bg-red-500', 'bg-green-500');
                toast.classList.add(isError ? 'bg-red-500' : 'bg-green-500');
                setTimeout(() => toast.classList.add('hidden'), 4000);
            };

            const showSupportModal = () => {
                const modalHtml = `
                    <div class="card support-modal w-full max-w-md rounded-2xl p-8 text-center relative">
                        <button onclick="window.closeSupportModal()" class="close-btn absolute top-4 right-4 text-2xl font-bold transition">&times;</button>
                        <div class="mb-6">
                            <h2 class="text-2xl font-bold text-white mb-2">Support Developer Yukk! 🚀</h2>
                            <p class="text-gray-400">UploadPro dikembangkan dengan ❤️ oleh Gxyenn. Bantu developer untuk terus berkarya dengan memberikan dukungan.</p>
                        </div>
                        <a href="https://saweria.co/Gxyenn" target="_blank" class="support-btn text-white font-bold py-3 px-6 rounded-lg text-base transition inline-block w-full">
                            Yuk Support!
                        </a>
                        <p class="text-gray-500 text-sm mt-4">Terima kasih atas dukungannya! 🙏</p>
                    </div>`;
                showModal(modalHtml);
            };

            const closeSupportModal = () => {
                closeModal();
            };

            const apiCall = async (endpoint, options = {}) => {
                if (!accessToken) throw new Error("Access token is missing.");
                const headers = { ...options.headers, 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/vnd.github.v3+json' };
                const response = await fetch(`https://api.github.com${endpoint}`, { ...options, headers });
                if (!response.ok) {
                    if (response.status === 401) handleLogout();
                    const errorData = await response.json().catch(() => ({}));
                    throw Object.assign(new Error(errorData.message || `GitHub API Error: ${response.status}`), { status: response.status });
                }
                return response.json();
            };

            const handleLogin = () => {
                const redirectUri = `${window.location.origin}/api/callback`;
                const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=repo,user&redirect_uri=${redirectUri}`;
                window.location.href = authUrl;
            };
            
            const handleLogout = () => {
                accessToken = null;
                sessionStorage.removeItem('github_token');
                showView('login');
            };

            const initApp = async () => {
                try {
                    const userData = await apiCall('/user');
                    userElements.name.textContent = userData.login;
                    userElements.avatar.src = userData.avatar_url;
                    showView('dashboard');
                } catch (error) {
                    handleLogout();
                }
            };

            const handlePageLoad = () => {
                const urlParams = new URLSearchParams(window.location.search);
                const tokenFromRedirect = urlParams.get('token');
                if (tokenFromRedirect) {
                    accessToken = tokenFromRedirect;
                    sessionStorage.setItem('github_token', accessToken);
                    window.history.replaceState({}, document.title, "/");
                } else {
                    accessToken = sessionStorage.getItem('github_token');
                }
                if (accessToken) initApp();
                else showView('login');
            };
            
            const handleFileSelection = (files) => {
                selectedFiles = Array.from(files);
                fileList.innerHTML = selectedFiles.map(f => `<p class="file-item">${f.name} <span class="text-gray-500">(${(f.size / 1024).toFixed(1)} KB)</span></p>`).join('');
                buttons.startUpload.disabled = selectedFiles.length === 0;
                
                // Add pulse animation to upload button when files are selected
                if (selectedFiles.length > 0) {
                    buttons.startUpload.classList.add('btn-primary');
                } else {
                    buttons.startUpload.classList.remove('btn-primary');
                }
            };
            
            const openRepoSelection = async () => {
                const repoListModal = `
                    <div class="card w-full max-w-lg rounded-2xl p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-bold text-white">Pilih Repositori Tujuan</h2>
                            <button onclick="window.closeModal()" class="close-btn text-2xl font-bold transition">&times;</button>
                        </div>
                        <div id="repo-list-modal" class="max-h-80 overflow-y-auto bg-gray-800 rounded-lg p-2 text-sm">
                            <p class="text-gray-400 p-4 text-center">Memuat repositori...</p>
                        </div>
                    </div>`;
                showModal(repoListModal);
                
                try {
                    const repos = await apiCall('/user/repos?sort=pushed&per_page=100');
                    const repoListEl = document.getElementById('repo-list-modal');
                    repoListEl.innerHTML = repos.length > 0 ? '' : '<p class="text-gray-400 p-4 text-center">Anda tidak memiliki repositori.</p>';
                    repos.forEach(repo => {
                        const repoEl = document.createElement('div');
                        repoEl.className = 'flex items-center p-3 hover:bg-indigo-700 rounded-md cursor-pointer transition';
                        repoEl.innerHTML = `<span>${repo.full_name}</span>`;
                        repoEl.onclick = () => {
                            selectedRepo = repo.full_name;
                            checkRepoContentAndProceed();
                        };
                        repoListEl.appendChild(repoEl);
                    });
                } catch (error) {
                    document.getElementById('repo-list-modal').innerHTML = `<p class="text-red-400 p-4 text-center">Gagal memuat repositori.</p>`;
                }
            };
            
            const checkRepoContentAndProceed = async () => {
                try {
                    await apiCall(`/repos/${selectedRepo}/contents`);
                    isRepoInitiallyEmpty = false;
                } catch (error) {
                    if (error.status === 404) {
                        isRepoInitiallyEmpty = true;
                    } else {
                        showToast(`Error: ${error.message}`, true);
                        closeModal();
                        return;
                    }
                }
                openFileBrowser();
            };

            const openFileBrowser = async (path = '') => {
                const folderIcon = `<i class="fas fa-folder text-yellow-400 mr-3"></i>`;
                const fileIcon = `<i class="fas fa-file text-gray-400 mr-3"></i>`;
                const browserModal = `
                    <div class="card w-full max-w-lg rounded-2xl p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-bold text-white truncate">Pilih Folder Tujuan di ${selectedRepo}</h2>
                            <button onclick="window.closeModal()" class="close-btn text-2xl font-bold transition">&times;</button>
                        </div>
                        <div id="breadcrumb-modal" class="bg-gray-800 rounded-md p-2 text-sm text-gray-400 mb-4 whitespace-nowrap overflow-x-auto"></div>
                        <div id="file-list-modal" class="max-h-80 overflow-y-auto bg-gray-800 rounded-lg p-2 text-sm">
                            <p class="text-gray-400 p-4 text-center">Memuat konten...</p>
                        </div>
                        <div class="mt-5 flex gap-3">
                            <button onclick="window.setTargetFolderAndOpenExtractModal('${path}')" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-md text-sm transition">Pilih Folder Ini</button>
                        </div>
                    </div>`;
                showModal(browserModal);

                const breadcrumbEl = document.getElementById('breadcrumb-modal');
                breadcrumbEl.innerHTML = `<span class="cursor-pointer hover:text-white" onclick="window.openFileBrowser('')">root</span>`;
                path.split('/').filter(p=>p).reduce((acc, part) => {
                    const currentPath = `${acc}/${part}`;
                    breadcrumbEl.innerHTML += ` / <span class="cursor-pointer hover:text-white" onclick="window.openFileBrowser('${currentPath.substring(1)}')">${part}</span>`;
                    return currentPath;
                }, '');

                const fileListEl = document.getElementById('file-list-modal');
                try {
                    const contents = await apiCall(`/repos/${selectedRepo}/contents/${path}`);
                    fileListEl.innerHTML = '';
                    contents.sort((a, b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'dir' ? -1 : 1));
                    contents.forEach(item => {
                        const itemEl = document.createElement('div');
                        itemEl.className = `flex items-center p-2 hover:bg-gray-700 rounded-md transition ${item.type === 'dir' ? 'cursor-pointer' : ''}`;
                        itemEl.innerHTML = `${item.type === 'dir' ? folderIcon : fileIcon}<span>${item.name}</span>`;
                        if (item.type === 'dir') itemEl.onclick = () => openFileBrowser(item.path);
                        fileListEl.appendChild(itemEl);
                    });
                } catch (error) {
                    fileListEl.innerHTML = `<p class="text-gray-400 p-4 text-center">${error.status === 404 ? 'Folder ini kosong.' : 'Gagal memuat konten.'}</p>`;
                }
            };

            const setTargetFolderAndOpenExtractModal = (folder) => {
                targetFolder = folder;
                openAutoExtractModal();
            };
            
            const openAutoExtractModal = () => {
                filesToExtract = [];
                const zipFiles = selectedFiles.filter(f => {
                    const fileName = f.name.toLowerCase();
                    return fileName.endsWith('.zip') || fileName.endsWith('.7z');
                });
                
                // Only show the auto-extract modal if there are zip files
                if (zipFiles.length === 0) {
                    initiateUploadSequence(false);
                    return;
                }

                const fileItemsHtml = zipFiles.map(file => `
                    <div onclick="window.toggleExtractSelection(this, '${file.name}')" class="file-to-extract-item flex items-center p-3 hover:bg-indigo-700 rounded-md cursor-pointer transition">
                        <div class="w-5 h-5 mr-3 border-2 border-gray-400 rounded bg-gray-700 flex-shrink-0"></div>
                        <span>${file.name}</span>
                    </div>`).join('');

                showModal(`
                    <div class="card w-full max-w-lg rounded-2xl p-6">
                        <h2 class="text-xl font-bold text-white mb-4">Aktifkan Auto Ekstrak?</h2>
                        <p class="text-gray-400 text-sm mb-4">Pilih file kompresi untuk diekstrak. File lain akan diupload seperti biasa.</p>
                        <div class="max-h-60 overflow-y-auto bg-gray-800 rounded-lg p-2 text-sm">${fileItemsHtml}</div>
                        <div class="mt-5 flex gap-3">
                            <button onclick="window.initiateUploadSequence(false)" class="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded-md text-sm transition">Skip</button>
                            <button id="confirm-extract-btn" onclick="window.initiateUploadSequence(true)" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-md text-sm transition" ${zipFiles.length === 0 ? 'disabled' : ''}>Lanjutkan</button>
                        </div>
                    </div>`);
            };

            const initiateUploadSequence = (shouldExtract) => {
                if (!shouldExtract) filesToExtract = [];
                if (isRepoInitiallyEmpty) showCachePromptModal();
                else startUploadProcess();
            };

            const showCachePromptModal = () => {
                showModal(`
                    <div class="card w-full max-w-lg rounded-2xl p-8 text-center">
                         <h2 class="text-2xl font-bold text-white mb-2">Repositori Baru Terdeteksi</h2>
                         <p class="text-gray-400 mb-6">Repositori ini kosong. Buat file "Cache" sebagai pancingan agar upload berhasil?</p>
                         <div class="flex gap-4">
                            <button onclick="window.closeModal()" class="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition">Tidak</button>
                            <button onclick="window.createCache()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition">Ya, Buat Cache</button>
                         </div>
                    </div>`);
            };

            const createCache = async () => {
                showView('uploading');
                uploadStatusText.textContent = "Membuat cache pancingan...";
                try {
                    const response = await fetch('/api/create-cache', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ repo: selectedRepo })
                    });
                    if (!response.ok) {
                         const errorData = await response.json().catch(() => ({}));
                         throw new Error(errorData.message || 'Gagal membuat file cache.');
                    }
                    await response.json();
                    showToast('Cache pancingan berhasil dibuat!');
                    startUploadProcess();
                } catch (error) {
                    showModal(`<div class="card w-full max-w-lg rounded-2xl p-8 text-center"><h2 class="text-2xl font-bold text-white mb-2">Pancingan Cache Gagal</h2><p class="text-gray-400 mb-6">${error.message}</p><a href="/ercc" target="_blank" class="text-indigo-400 hover:text-indigo-300 transition">Lihat Caranya</a></div>`);
                }
            };
            
            const toggleExtractSelection = (element, fileName) => {
                const checkboxDiv = element.querySelector('div');
                if (filesToExtract.includes(fileName)) {
                    filesToExtract = filesToExtract.filter(f => f !== fileName);
                    element.classList.remove('selected');
                    checkboxDiv.innerHTML = '';
                } else {
                    filesToExtract.push(fileName);
                    element.classList.add('selected');
                    checkboxDiv.innerHTML = `<i class="fas fa-check text-green-400 w-full h-full"></i>`;
                }
                document.getElementById('confirm-extract-btn').disabled = filesToExtract.length === 0;
            };

            const startUploadProcess = async () => {
                showView('uploading');
                uploadStatusText.textContent = `Mengupload ${selectedFiles.length} file...`;
                const formData = new FormData();
                selectedFiles.forEach(file => formData.append('files', file));
                formData.append('repo', selectedRepo);
                formData.append('folderPath', targetFolder);
                formData.append('extract', JSON.stringify(filesToExtract));

                const uploadPromise = fetch('/api/upload', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    body: formData,
                }).then(async res => {
                    if (res.ok) return res.json();
                    const errorData = await res.json().catch(() => ({ message: 'Gagal memproses respons error dari server.' }));
                    return Promise.reject(new Error(errorData.message || 'Terjadi kesalahan saat upload.'));
                });
                
                try {
                    await Promise.all([uploadPromise, new Promise(res => setTimeout(res, MIN_ANIMATION_TIME))]);
                    
                    // Increment upload count and show support modal if needed
                    uploadCount++;
                    localStorage.setItem('uploadPro_uploadCount', uploadCount.toString());
                    
                    showToast('Upload berhasil!');
                    
                    // Show support modal every UPLOAD_COUNT_FOR_SUPPORT_MODAL uploads
                    if (uploadCount % UPLOAD_COUNT_FOR_SUPPORT_MODAL === 0) {
                        setTimeout(() => {
                            showSupportModal();
                        }, 1000);
                    }
                } catch (error) {
                    showToast(`Error: ${error.message}`, true);
                } finally {
                    closeModal();
                    fileList.innerHTML = '';
                    selectedFiles = [];
                    buttons.startUpload.disabled = true;
                    buttons.startUpload.classList.remove('btn-primary');
                }
            };

            // Create particles background
            function createParticles() {
                const particlesContainer = document.getElementById('particles');
                const particleCount = 20;
                
                for (let i = 0; i < particleCount; i++) {
                    const particle = document.createElement('div');
                    particle.classList.add('particle');
                    
                    // Random size, position, and animation delay
                    const size = Math.random() * 6 + 2;
                    const posX = Math.random() * 100;
                    const posY = Math.random() * 100;
                    const delay = Math.random() * 5;
                    const duration = Math.random() * 4 + 4;
                    
                    particle.style.width = `${size}px`;
                    particle.style.height = `${size}px`;
                    particle.style.left = `${posX}%`;
                    particle.style.top = `${posY}%`;
                    particle.style.animationDelay = `${delay}s`;
                    particle.style.animationDuration = `${duration}s`;
                    particle.style.background = `rgba(255, 107, 107, ${Math.random() * 0.3 + 0.1})`;
                    
                    particlesContainer.appendChild(particle);
                }
            }

            Object.assign(window, { 
                closeModal, 
                createCache, 
                toggleExtractSelection, 
                initiateUploadSequence, 
                setTargetFolderAndOpenExtractModal, 
                openFileBrowser,
                closeSupportModal
            });
            
            buttons.login.addEventListener('click', handleLogin);
            buttons.logout.addEventListener('click', handleLogout);
            dropZone.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => handleFileSelection(e.target.files));
            dropZone.addEventListener('dragover', (e) => { 
                e.preventDefault(); 
                e.currentTarget.classList.add('drag-over');
            });
            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('drag-over');
            });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('drag-over');
                handleFileSelection(e.dataTransfer.files);
            });
            buttons.startUpload.addEventListener('click', openRepoSelection);
            
            // Create particles on load
            createParticles();
            
            handlePageLoad();
        });