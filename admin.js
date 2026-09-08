/**
 * SpotyGen Admin Manager - LP da Semana
 * Painel de gerenciamento com lista idêntica ao site e tela de edição individual.
 */

let playlists = [];
let selectedIndex = null;

// Elementos da DOM
const DOM = {
    screenListView: document.getElementById('screen-list-view'),
    screenEditView: document.getElementById('screen-edit-view'),
    adminSearchInput: document.getElementById('admin-search-input'),
    adminTotalCount: document.getElementById('admin-total-count'),
    adminLoadingState: document.getElementById('admin-loading-state'),
    adminPlaylistsList: document.getElementById('admin-playlists-list'),
    
    // Controles da Tela de Edição
    btnBackToList: document.getElementById('btn-back-to-list'),
    editHeaderTitle: document.getElementById('edit-header-title'),
    editPreviewImg: document.getElementById('edit-preview-img'),
    editPreviewArtist: document.getElementById('edit-preview-artist'),
    editPreviewAlbum: document.getElementById('edit-preview-album'),
    editPreviewDesc: document.getElementById('edit-preview-desc'),
    btnAutoSearchLinks: document.getElementById('btn-auto-search-links'),
    
    // Campos do Formulário
    inputArtist: document.getElementById('input-artist'),
    inputAlbum: document.getElementById('input-album'),
    inputDesc: document.getElementById('input-desc'),
    inputSpotify: document.getElementById('input-spotify'),
    inputYoutube: document.getElementById('input-youtube'),
    inputApple: document.getElementById('input-apple'),
    inputDeezer: document.getElementById('input-deezer'),
    inputAmazon: document.getElementById('input-amazon'),
    inputImage: document.getElementById('input-image'),
    
    btnSaveSingle: document.getElementById('btn-save-single'),
    btnDeleteSingle: document.getElementById('btn-delete-single'),
    
    toastBox: document.getElementById('toast-box'),
    toastMsg: document.getElementById('toast-msg')
};

// -------------------------------------------------------------
// INICIALIZAÇÃO E CARREGAMENTO
// -------------------------------------------------------------
async function initAdmin() {
    // Verificar autenticação
    const token = localStorage.getItem('spotify_access_token');
    if (!token) {
        showToast('Aviso: Você não está conectado ao Spotify no PlaylistGen.', 'warning');
    }

    await loadPlaylists();
    setupEventListeners();
}

async function loadPlaylists() {
    DOM.adminLoadingState.classList.remove('hidden');
    try {
        let response = await fetch('/api/playlists');
        if (!response.ok) {
            response = await fetch('playlists.json');
        }
        playlists = await response.json();
        renderListView();
    } catch (e) {
        console.error(e);
        showToast(`Erro ao carregar playlists: ${e.message}`, 'error');
    } finally {
        DOM.adminLoadingState.classList.add('hidden');
    }
}

// -------------------------------------------------------------
// TELA 1: EXIBIÇÃO DA LISTA (ESTILO LPDASMANA.COM.BR)
// -------------------------------------------------------------
function renderListView(filterText = '') {
    const container = DOM.adminPlaylistsList;
    container.innerHTML = '';

    const filter = (filterText || DOM.adminSearchInput.value || '').toLowerCase().trim();
    
    let itemsToRender = playlists.map((item, originalIndex) => ({ item, originalIndex }));
    if (filter) {
        itemsToRender = itemsToRender.filter(({ item }) => {
            const nameMatch = (item.name || '').toLowerCase().includes(filter);
            const descMatch = (item.description || '').toLowerCase().includes(filter);
            return nameMatch || descMatch;
        });
    }

    DOM.adminTotalCount.textContent = playlists.length;

    if (itemsToRender.length === 0) {
        container.innerHTML = filter ?
            '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhum disco encontrado para a busca.</div>' :
            '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">A coleção está vazia.</div>';
        return;
    }

    itemsToRender.forEach(({ item, originalIndex }) => {
        const card = document.createElement('div');
        card.className = 'playlist-card glass-panel';

        const nameParts = (item.name || '').split(' - ');
        const artistName = nameParts[0] || '';
        const albumName = nameParts.slice(1).join(' - ') || '';
        const imgUrl = item.imageUrl || 'logo.jpg';

        // Contruir os ícones de plataformas
        let linksHtml = '';
        if (item.spotifyUrl) {
            linksHtml += `<a href="${item.spotifyUrl}" target="_blank" class="brand-btn spotify" data-tooltip="Spotify"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.782-8.892-.98-.336.075-.668-.135-.745-.47-.077-.336.136-.668.47-.745 3.856-.88 7.15-.506 9.82 1.13.295.178.387.563.207.858zm1.225-2.72c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.076-1.185-.412.125-.845-.107-.97-.52-.125-.413.108-.846.52-.97 3.667-1.112 8.236-.574 11.34 1.34.368.225.488.706.26 1.075zm.107-2.846C14.48 8.87 8.795 8.682 5.512 9.68a1.002 1.002 0 1 1-.585-1.91c3.78-1.147 10.052-.93 13.997 1.41a1 1 0 1 1-1.018 1.722z"/></svg></a>`;
        }
        if (item.youtubeUrl) {
            linksHtml += `<a href="${item.youtubeUrl}" target="_blank" class="brand-btn youtube" data-tooltip="YouTube Music"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Youtube_Music_icon.svg/1280px-Youtube_Music_icon.svg.png" alt="YouTube Music" class="brand-img-icon" width="22" height="22"></a>`;
        }
        if (item.appleMusicUrl) {
            linksHtml += `<a href="${item.appleMusicUrl}" target="_blank" class="brand-btn apple" data-tooltip="Apple Music"><img src="https://static.vecteezy.com/system/resources/previews/073/495/331/non_2x/apple-music-logo-rounded-glossy-icon-with-transparent-background-free-png.png" alt="Apple Music" class="brand-img-icon" width="22" height="22"></a>`;
        }
        if (item.deezerUrl) {
            linksHtml += `<a href="${item.deezerUrl}" target="_blank" class="brand-btn deezer" data-tooltip="Deezer"><svg viewBox="0 0 49 48" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M41.0955 7.32313C41.5396 4.74914 42.1912 3.13054 42.913 3.12744H42.9146C44.2606 3.13208 45.3517 8.7454 45.3517 15.6759C45.3517 22.6063 44.259 28.2243 42.9115 28.2243C42.3591 28.2243 41.8494 27.2704 41.4389 25.6719C40.7903 31.5233 39.4443 35.5459 37.8862 35.5459C36.6806 35.5459 35.5986 33.1296 34.8722 29.3188C34.3762 36.5662 33.1279 41.708 31.6689 41.708C30.7533 41.708 29.9185 39.6705 29.3005 36.3529C28.5573 43.2014 26.8405 48 24.8382 48C22.836 48 21.1162 43.2029 20.376 36.3529C19.7625 39.6705 18.9278 41.708 18.0075 41.708C16.5486 41.708 15.3033 36.5662 14.8043 29.3188C14.0779 33.1296 12.999 35.5459 11.7903 35.5459C10.2337 35.5459 8.88621 31.5249 8.23763 25.6719C7.83017 27.2751 7.31741 28.2243 6.76497 28.2243C5.41745 28.2243 4.32478 22.6063 4.32478 15.6759C4.32478 8.7454 5.41745 3.12744 6.76497 3.12744C7.48833 3.12744 8.13538 4.75068 8.58405 7.32313C9.30283 2.88473 10.4703 0 11.7903 0C13.3576 0 14.7158 4.07975 15.3583 10.0038C15.987 5.69216 16.9408 2.94348 18.0091 2.94348C19.5061 2.94348 20.7789 8.34964 21.2505 15.8908C22.1371 12.0243 23.4205 9.59876 24.8413 9.59876C26.2621 9.59876 27.5455 12.0259 28.4306 15.8908C28.9037 8.34964 30.1749 2.94348 31.672 2.94348C32.7387 2.94348 33.691 5.69216 34.3228 10.0038C34.9637 4.07975 36.3219 0 37.8892 0C39.2047 0 40.3767 2.88628 41.0955 7.32313ZM0.837891 14.4417C0.837891 11.3436 1.45748 8.83142 2.22204 8.83142C2.9866 8.83142 3.60619 11.3436 3.60619 14.4417C3.60619 17.5397 2.9866 20.0519 2.22204 20.0519C1.45748 20.0519 0.837891 17.5397 0.837891 14.4417ZM46.0693 14.4417C46.0693 11.3436 46.6888 8.83142 47.4534 8.83142C48.218 8.83142 48.8376 11.3436 48.8376 14.4417C48.8376 17.5397 48.218 20.0519 47.4534 20.0519C46.6888 20.0519 46.0693 17.5397 46.0693 14.4417Z"/></svg></a>`;
        }
        if (item.amazonMusicUrl) {
            linksHtml += `<a href="${item.amazonMusicUrl}" target="_blank" class="brand-btn amazon" data-tooltip="Amazon Music"><img src="https://upload.wikimedia.org/wikipedia/commons/3/39/Stacked_Amazon_Music_CharcoalOnCyan_Circle_RGB.png" alt="Amazon Music" class="brand-img-icon" width="22" height="22"></a>`;
        }

        card.innerHTML = `
            <div class="card-main-content">
                <div class="card-cover-container">
                    <img src="${imgUrl}" alt="Capa" class="card-cover" onerror="this.src='logo.jpg'">
                </div>
                <div class="card-info">
                    <h2 class="card-artist">${escapeHtml(artistName)}</h2>
                    <div class="card-album">${escapeHtml(albumName)}</div>
                    <p class="card-description">${escapeHtml(item.description || '')}</p>
                </div>
            </div>
            ${linksHtml ? `<div class="card-links-row">${linksHtml}</div>` : ''}
            <div class="admin-card-actions">
                <button class="btn-admin btn-admin-primary btn-open-edit" data-index="${originalIndex}">
                    <i data-lucide="edit-3"></i> Editar LP
                </button>
                <div style="display: flex; gap: 6px;">
                    <button class="btn-admin-icon btn-move-up" data-index="${originalIndex}" title="Mover para cima" ${originalIndex === 0 ? 'disabled' : ''}>
                        <i data-lucide="chevron-up"></i>
                    </button>
                    <button class="btn-admin-icon btn-move-down" data-index="${originalIndex}" title="Mover para baixo" ${originalIndex === playlists.length - 1 ? 'disabled' : ''}>
                        <i data-lucide="chevron-down"></i>
                    </button>
                    <button class="btn-admin-icon btn-admin-danger btn-delete-item" data-index="${originalIndex}" title="Excluir disco">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    if (window.lucide) {
        lucide.createIcons({ attrs: { class: 'icon-sm' } });
    }

    // Attach card event listeners
    container.querySelectorAll('.btn-open-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-index'));
            openEditScreen(idx);
        });
    });

    container.querySelectorAll('.btn-move-up').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-index'));
            moveItem(idx, -1);
        });
    });

    container.querySelectorAll('.btn-move-down').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-index'));
            moveItem(idx, 1);
        });
    });

    container.querySelectorAll('.btn-delete-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-index'));
            deleteSingleItem(idx);
        });
    });
}

// -------------------------------------------------------------
// TELA 2: EDIÇÃO DO LP SELECIONADO
// -------------------------------------------------------------
function openEditScreen(index) {
    if (index < 0 || index >= playlists.length) return;
    selectedIndex = index;

    const item = playlists[index];
    const nameParts = (item.name || '').split(' - ');
    const artistName = nameParts[0] || '';
    const albumName = nameParts.slice(1).join(' - ') || item.name || '';

    DOM.inputArtist.value = artistName;
    DOM.inputAlbum.value = albumName;
    DOM.inputDesc.value = item.description || '';
    DOM.inputSpotify.value = item.spotifyUrl || '';
    DOM.inputYoutube.value = item.youtubeUrl || '';
    DOM.inputApple.value = item.appleMusicUrl || '';
    DOM.inputDeezer.value = item.deezerUrl || '';
    DOM.inputAmazon.value = item.amazonMusicUrl || '';
    DOM.inputImage.value = item.imageUrl || '';

    updatePreview();

    DOM.editHeaderTitle.textContent = `Editando: ${artistName} - ${albumName}`;
    DOM.screenListView.classList.add('hidden');
    DOM.screenEditView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (window.lucide) {
        lucide.createIcons();
    }
}

function showListView() {
    selectedIndex = null;
    DOM.screenEditView.classList.add('hidden');
    DOM.screenListView.classList.remove('hidden');
    renderListView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updatePreview() {
    const artist = DOM.inputArtist.value || 'Nome do Artista';
    const album = DOM.inputAlbum.value || 'Nome do Álbum';
    const desc = DOM.inputDesc.value || 'LP da Semana';
    const imgUrl = DOM.inputImage.value || 'logo.jpg';

    DOM.editPreviewArtist.textContent = artist;
    DOM.editPreviewAlbum.textContent = album;
    DOM.editPreviewDesc.textContent = desc;
    DOM.editPreviewImg.src = imgUrl;
}

// -------------------------------------------------------------
// EVENT LISTENERS & AÇÕES
// -------------------------------------------------------------
function setupEventListeners() {
    DOM.adminSearchInput.addEventListener('input', (e) => {
        renderListView(e.target.value);
    });

    DOM.btnBackToList.addEventListener('click', showListView);

    // Live preview updating
    [DOM.inputArtist, DOM.inputAlbum, DOM.inputDesc, DOM.inputImage].forEach(input => {
        input.addEventListener('input', updatePreview);
    });

    DOM.btnSaveSingle.addEventListener('click', saveCurrentItem);
    DOM.btnDeleteSingle.addEventListener('click', () => {
        if (selectedIndex !== null) {
            deleteSingleItem(selectedIndex);
        }
    });

    DOM.btnAutoSearchLinks.addEventListener('click', autoSearchOdesliLinks);
}

async function saveCurrentItem() {
    if (selectedIndex === null) return;

    const artist = DOM.inputArtist.value.trim();
    const album = DOM.inputAlbum.value.trim();

    if (!artist || !album) {
        showToast('Preencha pelo menos o Artista e o Álbum.', 'error');
        return;
    }

    const updatedItem = {
        name: `${artist} - ${album}`,
        description: DOM.inputDesc.value.trim(),
        spotifyUrl: DOM.inputSpotify.value.trim(),
        youtubeUrl: DOM.inputYoutube.value.trim(),
        appleMusicUrl: DOM.inputApple.value.trim(),
        deezerUrl: DOM.inputDeezer.value.trim(),
        amazonMusicUrl: DOM.inputAmazon.value.trim(),
        imageUrl: DOM.inputImage.value.trim()
    };

    playlists[selectedIndex] = updatedItem;

    DOM.btnSaveSingle.disabled = true;
    DOM.btnSaveSingle.textContent = 'Salvando...';

    try {
        await persistAllPlaylists();
        showToast(`LP "${updatedItem.name}" atualizado com sucesso!`, 'success');
        showListView();
    } catch (e) {
        showToast(`Erro ao salvar: ${e.message}`, 'error');
    } finally {
        DOM.btnSaveSingle.disabled = false;
        DOM.btnSaveSingle.innerHTML = '<i data-lucide="save"></i> Salvar Alterações deste LP';
        if (window.lucide) lucide.createIcons();
    }
}

async function deleteSingleItem(index) {
    const item = playlists[index];
    if (!item) return;

    if (confirm(`Tem certeza que deseja excluir o LP "${item.name}"?`)) {
        playlists.splice(index, 1);
        try {
            await persistAllPlaylists();
            showToast(`LP "${item.name}" excluído com sucesso.`, 'success');
            if (selectedIndex !== null) {
                showListView();
            } else {
                renderListView();
            }
        } catch (e) {
            showToast(`Erro ao excluir: ${e.message}`, 'error');
        }
    }
}

async function moveItem(index, direction) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= playlists.length) return;

    const temp = playlists[index];
    playlists[index] = playlists[targetIdx];
    playlists[targetIdx] = temp;

    try {
        await persistAllPlaylists();
        renderListView();
        showToast('Ordem atualizada.', 'success');
    } catch (e) {
        showToast(`Erro ao reordenar: ${e.message}`, 'error');
    }
}

async function persistAllPlaylists() {
    const res = await fetch('/api/playlists/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playlists)
    });
    const data = await res.json();
    if (!res.ok || data.status !== 'success') {
        throw new Error(data.error || 'Erro desconhecido ao salvar servidor.');
    }
}

async function autoSearchOdesliLinks() {
    const spotifyUrl = DOM.inputSpotify.value.trim();
    if (!spotifyUrl) {
        showToast('Insira uma URL do Spotify para buscar os links nas outras plataformas.', 'error');
        return;
    }

    DOM.btnAutoSearchLinks.disabled = true;
    DOM.btnAutoSearchLinks.textContent = 'Buscando links...';

    try {
        const res = await fetch(`/api/odesli-proxy?url=${encodeURIComponent(spotifyUrl)}`);
        const data = await res.json();

        if (res.ok && data.linksByPlatform) {
            const links = data.linksByPlatform;
            if (links.youtubeMusic && !DOM.inputYoutube.value) {
                DOM.inputYoutube.value = links.youtubeMusic.url;
            }
            if (links.appleMusic && !DOM.inputApple.value) {
                DOM.inputApple.value = links.appleMusic.url;
            }
            if (links.deezer && !DOM.inputDeezer.value) {
                DOM.inputDeezer.value = links.deezer.url;
            }
            if (links.amazonMusic && !DOM.inputAmazon.value) {
                DOM.inputAmazon.value = links.amazonMusic.url;
            }
            showToast('Links das plataformas preenchidos automaticamente!', 'success');
        } else {
            showToast('Não foi possível encontrar links adicionais via Odesli.', 'warning');
        }
    } catch (e) {
        showToast(`Falha ao buscar no Odesli: ${e.message}`, 'error');
    } finally {
        DOM.btnAutoSearchLinks.disabled = false;
        DOM.btnAutoSearchLinks.innerHTML = '<i data-lucide="sparkles"></i> Buscar links faltantes no Odesli';
        if (window.lucide) lucide.createIcons();
    }
}

function showToast(message, type = 'success') {
    DOM.toastMsg.textContent = message;
    DOM.toastBox.classList.remove('hidden');

    setTimeout(() => {
        DOM.toastBox.classList.add('hidden');
    }, 3500);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Inicializar aplicativo admin
document.addEventListener('DOMContentLoaded', initAdmin);
