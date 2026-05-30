/**
 * Spotify Playlist Generator - Core Logic (OAuth 2.0 PKCE + Spotify API Integration)
 */

// Estado da Aplicação
const state = {
    accessToken: localStorage.getItem('spotify_access_token') || null,
    refreshToken: localStorage.getItem('spotify_refresh_token') || null,
    expiresAt: parseInt(localStorage.getItem('spotify_expires_at') || '0'),
    user: null,
    clientId: localStorage.getItem('spotify_client_id') || CONFIG.CLIENT_ID || '',
    searchType: 'artist-top', // artist-top, album, artist-mix
    searchResults: [],
    selectedItem: null,
    currentTracks: []
};

// Elementos da DOM
const DOM = {
    btnLogin: document.getElementById('btn-login'),
    btnLogout: document.getElementById('btn-logout'),
    userProfile: document.getElementById('user-profile'),
    userAvatar: document.getElementById('user-avatar'),
    userName: document.getElementById('user-name'),
    userEmail: document.getElementById('user-email'),
    setupBanner: document.getElementById('setup-banner'),
    btnSetupNow: document.getElementById('btn-setup-now'),
    btnSettings: document.getElementById('btn-settings'),
    settingsModal: document.getElementById('settings-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    clientIdInput: document.getElementById('client-id-input'),
    uriDisplay: document.getElementById('uri-display'),
    searchInput: document.getElementById('search-input'),
    searchResultsContainer: document.getElementById('search-results-container'),
    searchResults: document.getElementById('search-results'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    previewPlaceholder: document.getElementById('preview-placeholder'),
    previewContent: document.getElementById('preview-content'),
    selectedItemImg: document.getElementById('selected-item-img'),
    selectedItemBadge: document.getElementById('selected-item-badge'),
    selectedItemTitle: document.getElementById('selected-item-title'),
    selectedItemSubtitle: document.getElementById('selected-item-subtitle'),
    trackList: document.getElementById('track-list'),
    playlistMetaSettings: document.getElementById('playlist-meta-settings'),
    playlistTitle: document.getElementById('playlist-title'),
    playlistDesc: document.getElementById('playlist-desc'),
    btnGeneratePlaylist: document.getElementById('btn-generate-playlist'),
    btnRemoveLast: document.getElementById('btn-remove-last'),
    btnClearAll: document.getElementById('btn-clear-all'),
    toastContainer: document.getElementById('toast-container')
};

// -------------------------------------------------------------
// HELPER: Notificações Toast
// -------------------------------------------------------------
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', type === 'success' ? 'check-circle' : 'alert-circle');
    
    const text = document.createElement('span');
    text.className = 'toast-message';
    text.textContent = message;
    
    toast.appendChild(icon);
    toast.appendChild(text);
    
    DOM.toastContainer.appendChild(toast);
    lucide.createIcons({ attrs: { class: 'icon-sm' } });
    
    // Auto remove
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// -------------------------------------------------------------
// PKCE HELPERS (Criptografia para OAuth seguro no Frontend)
// -------------------------------------------------------------
function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values).map((x) => possible[x % possible.length]).join('');
}

async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(a) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(a)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function generateCodeChallenge(v) {
    const hashed = await sha256(v);
    return base64urlencode(hashed);
}

// -------------------------------------------------------------
// SPOTIFY AUTH FLOW
// -------------------------------------------------------------
async function redirectToSpotifyAuth() {
    if (!state.clientId) {
        showToast('Por favor, configure seu Spotify Client ID nas configurações antes de conectar.', 'error');
        openSettingsModal();
        return;
    }

    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    window.localStorage.setItem('spotify_code_verifier', codeVerifier);

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: state.clientId,
        scope: CONFIG.SCOPES,
        redirect_uri: CONFIG.REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        show_dialog: 'true' // Força a tela de aprovação para atualizar o token
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function fetchToken(body) {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(body)
    });
    
    if (!response.ok) {
        throw new Error('Falha ao obter token da API do Spotify');
    }
    
    return response.json();
}

function storeTokens(data) {
    state.accessToken = data.access_token;
    state.refreshToken = data.refresh_token || state.refreshToken;
    state.expiresAt = Date.now() + (data.expires_in * 1000);
    
    console.log('Escopos realmente concedidos pelo Spotify:', data.scope);

    localStorage.setItem('spotify_access_token', state.accessToken);
    if (data.refresh_token) {
        localStorage.setItem('spotify_refresh_token', state.refreshToken);
    }
    localStorage.setItem('spotify_expires_at', state.expiresAt.toString());
}

async function getValidToken() {
    if (!state.accessToken) return null;
    
    // Se o token estiver prestes a expirar (dentro de 1 minuto), atualiza
    if (Date.now() + 60000 > state.expiresAt) {
        if (!state.refreshToken) {
            logout();
            return null;
        }
        try {
            console.log('Atualizando access token...');
            const data = await fetchToken({
                grant_type: 'refresh_token',
                refresh_token: state.refreshToken,
                client_id: state.clientId
            });
            storeTokens(data);
            showToast('Sessão renovada com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao atualizar token', error);
            logout();
            return null;
        }
    }
    
    return state.accessToken;
}

async function handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        const codeVerifier = window.localStorage.getItem('spotify_code_verifier');
        
        // Limpar parâmetros da URL imediatamente
        window.history.replaceState({}, document.title, window.location.pathname);
        
        try {
            const data = await fetchToken({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: CONFIG.REDIRECT_URI,
                client_id: state.clientId,
                code_verifier: codeVerifier
            });
            
            storeTokens(data);
            showToast('Conectado ao Spotify com sucesso!', 'success');
            await initApp();
        } catch (error) {
            console.error(error);
            showToast('Erro na autenticação. Verifique seu Client ID e configurações.', 'error');
        }
    }
}

// -------------------------------------------------------------
// SPOTIFY WEB API FETCHERS
// -------------------------------------------------------------
async function spotifyRequest(endpoint, options = {}) {
    const token = await getValidToken();
    if (!token) {
        showToast('Sua sessão expirou. Conecte-se novamente.', 'error');
        logout();
        return null;
    }

    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (response.status === 401) {
        logout();
        throw new Error('Não autorizado. Token inválido.');
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Erro na API do Spotify: ${response.status}`);
    }

    if (response.status === 204) return null;
    return response.json();
}

async function fetchUserProfile() {
    try {
        const profile = await spotifyRequest('/me');
        state.user = profile;
        
        DOM.userName.textContent = profile.display_name;
        if (DOM.userEmail) {
            DOM.userEmail.textContent = profile.email || 'Sem e-mail';
        }
        if (profile.images && profile.images.length > 0) {
            DOM.userAvatar.src = profile.images[0].url;
        } else {
            DOM.userAvatar.src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
        }
        
        DOM.btnLogin.classList.add('hidden');
        DOM.userProfile.classList.remove('hidden');
        DOM.searchInput.disabled = false;
        DOM.searchInput.placeholder = "Digite o nome do artista ou disco...";
    } catch (e) {
        console.error('Erro ao buscar perfil do usuário', e);
        logout();
    }
}

// -------------------------------------------------------------
// APPLICATION BUSINESS LOGIC
// -------------------------------------------------------------
let searchTimeout;
DOM.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length < 2) {
        DOM.searchResultsContainer.classList.add('hidden');
        return;
    }

    searchTimeout = setTimeout(() => {
        performSearch(query);
    }, 4500); // 450ms debounce
});

// Suportar apertar Enter para busca imediata
DOM.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query.length >= 2) {
            performSearch(query);
        }
    }
});

async function performSearch(query) {
    try {
        // Se buscar por 'album', pesquisamos álbuns. Se for artista, pesquisamos artistas.
        const typeParam = state.searchType === 'album' ? 'album' : 'artist';
        const data = await spotifyRequest(`/search?q=${encodeURIComponent(query)}&type=${typeParam}&limit=5`);
        
        if (!data) return;

        let items = [];
        if (state.searchType === 'album') {
            items = data.albums.items;
        } else {
            items = data.artists.items;
        }

        state.searchResults = items;
        renderSearchResults(items);
    } catch (error) {
        console.error(error);
        showToast('Erro ao realizar busca no Spotify', 'error');
    }
}

function renderSearchResults(items) {
    DOM.searchResults.innerHTML = '';
    
    if (items.length === 0) {
        DOM.searchResults.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-muted);">Nenhum resultado encontrado</div>';
        DOM.searchResultsContainer.classList.remove('hidden');
        return;
    }

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = `search-item ${state.selectedItem?.id === item.id ? 'selected' : ''}`;
        
        const imgUrl = item.images && item.images.length > 0 ? item.images[item.images.length - 1].url : 'https://placehold.co/40x40?text=Disc';
        
        let sub = '';
        if (state.searchType === 'album') {
            sub = item.artists.map(a => a.name).join(', ') + ` (${item.release_date.split('-')[0]})`;
        } else {
            sub = item.genres && item.genres.length > 0 ? item.genres.slice(0, 2).join(', ') : 'Gênero não informado';
        }

        div.innerHTML = `
            <img class="search-item-img" src="${imgUrl}" alt="${item.name}">
            <div class="search-item-info">
                <span class="search-item-title">${item.name}</span>
                <span class="search-item-sub">${sub}</span>
            </div>
        `;

        div.addEventListener('click', () => {
            document.querySelectorAll('.search-item').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            selectItem(item);
        });

        DOM.searchResults.appendChild(div);
    });

    DOM.searchResultsContainer.classList.remove('hidden');
}

async function selectItem(item) {
    state.selectedItem = item;
    DOM.searchResultsContainer.classList.add('hidden');
    DOM.searchInput.value = item.name;

    // Carregar músicas da pré-visualização
    await loadTracksForPreview(item);
}

async function loadTracksForPreview(item) {
    try {
        let tracks = [];
        let subtitle = '';
        let badge = '';

        if (state.searchType === 'artist-top') {
            badge = 'Artista';
            subtitle = 'Top 10 músicas mais populares';
            const data = await spotifyRequest(`/artists/${item.id}/top-tracks?market=BR`);
            tracks = data.tracks;
        } 
        else if (state.searchType === 'album') {
            badge = 'Álbum';
            subtitle = `Por ${item.artists.map(a => a.name).join(', ')}`;
            const data = await spotifyRequest(`/albums/${item.id}/tracks?limit=50`);
            // Músicas de álbum simplificadas não trazem capa. Mapeamos a capa do álbum principal.
            tracks = data.items.map(t => ({
                ...t,
                album: {
                    name: item.name,
                    images: item.images
                }
            }));
        } 
        else if (state.searchType === 'artist-mix') {
            badge = 'Artista Mix';
            subtitle = `Mix de ${item.name} e artistas relacionados`;
            
            // 1. Pegar top 5 faixas do artista alvo
            const topTracksData = await spotifyRequest(`/artists/${item.id}/top-tracks?market=BR`);
            const targetTop = topTracksData.tracks.slice(0, 7);
            
            // 2. Pegar artistas relacionados
            const relatedData = await spotifyRequest(`/artists/${item.id}/related-artists`);
            const relatedArtists = relatedData.artists.slice(0, 4); // pegar top 4 relacionados
            
            let relatedTracks = [];
            for (let related of relatedArtists) {
                try {
                    const rTracksData = await spotifyRequest(`/artists/${related.id}/top-tracks?market=BR`);
                    // Pegar 3 faixas mais tocadas de cada artista relacionado
                    relatedTracks.push(...rTracksData.tracks.slice(0, 3));
                } catch (e) {
                    console.warn(`Falha ao obter faixas para relacionado: ${related.name}`, e);
                }
            }

            // Embaralhar levemente e juntar (artistas principais + relacionados)
            tracks = [...targetTop, ...relatedTracks];
        }

        state.currentTracks = tracks;
        renderTracklist(item, badge, subtitle, tracks);
    } catch (error) {
        console.error(error);
        showToast('Erro ao carregar pré-visualização de faixas', 'error');
    }
}

function renderTracklist(item, badgeText, subtitleText, tracks) {
    const imgUrl = item.images && item.images.length > 0 ? item.images[0].url : 'https://placehold.co/80x80?text=Disc';
    DOM.selectedItemImg.src = imgUrl;
    DOM.selectedItemBadge.textContent = badgeText;
    DOM.selectedItemTitle.textContent = item.name;
    DOM.selectedItemSubtitle.textContent = subtitleText;

    DOM.trackList.innerHTML = '';
    
    if (tracks.length === 0) {
        DOM.trackList.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Nenhuma música disponível</div>';
    } else {
        tracks.forEach((track, index) => {
            const row = document.createElement('div');
            row.className = 'track-row';
            
            const minutes = Math.floor(track.duration_ms / 60000);
            const seconds = ((track.duration_ms % 60000) / 1000).toFixed(0);
            const durationFormatted = `${minutes}:${seconds.padStart(2, '0')}`;
            
            const albumName = track.album?.name || item.name;

            row.innerHTML = `
                <span class="track-index">${index + 1}</span>
                <div class="track-title-cell">
                    <span class="track-title">${track.name}</span>
                    <span class="track-artist">${track.artists.map(a => a.name).join(', ')}</span>
                </div>
                <span class="track-album">${albumName}</span>
                <span class="track-duration">${durationFormatted}</span>
            `;
            DOM.trackList.appendChild(row);
        });
    }

    // Gerar metadados padrão para a playlist
    const date = new Date();
    const month = date.toLocaleString('pt-BR', { month: 'long' });
    const monthCapitalized = month.charAt(0).toUpperCase() + month.slice(1);
    const year = date.getFullYear();
    const formattedDate = `${monthCapitalized}/${year}`;

    DOM.playlistTitle.value = `${item.name} - LP da Semana - ${formattedDate}`;
    DOM.playlistDesc.value = `LP da Semana - Conversar em Vinil\n${item.name} - ${formattedDate}`;

    DOM.previewPlaceholder.classList.add('hidden');
    DOM.previewContent.classList.remove('hidden');
    DOM.playlistMetaSettings.classList.remove('hidden');
}

// -------------------------------------------------------------
// PLAYLIST CREATION FUNCTION
// -------------------------------------------------------------
DOM.btnGeneratePlaylist.addEventListener('click', async () => {
    if (!state.user) {
        showToast('Conecte ao Spotify primeiro!', 'error');
        return;
    }
    if (state.currentTracks.length === 0) {
        showToast('Nenhuma música selecionada.', 'error');
        return;
    }

    DOM.btnGeneratePlaylist.disabled = true;
    DOM.btnGeneratePlaylist.innerHTML = '<i class="spinner"></i> Criando...';

    try {
        const title = DOM.playlistTitle.value.trim() || 'Minha Playlist SpotyGen';
        const description = DOM.playlistDesc.value.trim();

        // 1. Criar Playlist Vazia
        let playlist;
        try {
            playlist = await spotifyRequest('/me/playlists', {
                method: 'POST',
                body: JSON.stringify({
                    name: title,
                    description: description,
                    public: true // cria como pública
                })
            });
        } catch (err1) {
            throw new Error(`Etapa 1 (Criar Playlist) falhou: ${err1.message}`);
        }

        if (playlist && playlist.id) {
            // 2. Adicionar faixas à playlist criada
            const trackUris = state.currentTracks.map(t => t.uri).filter(uri => !!uri);
            console.log('Playlist criada com ID:', playlist.id);
            console.log('Músicas identificadas para adicionar (URIs):', trackUris);
            
            if (trackUris.length === 0) {
                throw new Error("A lista de músicas selecionadas está vazia ou os identificadores são inválidos.");
            }
            
            const chunkSize = 100;
            try {
                for (let i = 0; i < trackUris.length; i += chunkSize) {
                    const chunk = trackUris.slice(i, i + chunkSize);
                    console.log(`Enviando lote de músicas para playlist ${playlist.id}:`, chunk);
                    await spotifyRequest(`/playlists/${playlist.id}/items`, {
                        method: 'POST',
                        body: JSON.stringify({
                            uris: chunk
                        })
                    });
                }
            } catch (err2) {
                throw new Error(`Etapa 2 (Adicionar Músicas) falhou: ${err2.message}`);
            }

            // Registrar no backend público do SpotyGen
            try {
                let imageUrl = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80';
                if (state.selectedItem && state.selectedItem.images && state.selectedItem.images.length > 0) {
                    imageUrl = state.selectedItem.images[0].url;
                } else if (state.currentTracks && state.currentTracks[0] && state.currentTracks[0].album && state.currentTracks[0].album.images && state.currentTracks[0].album.images.length > 0) {
                    imageUrl = state.currentTracks[0].album.images[0].url;
                }

                await fetch('/api/playlists', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: title,
                        description: description || `Playlist criada por SpotyGen`,
                        spotifyUrl: playlist.external_urls.spotify,
                        imageUrl: imageUrl
                    })
                });
                console.log('Playlist cadastrada no backend com sucesso!');
            } catch (errBackend) {
                console.error('Erro ao cadastrar playlist no backend:', errBackend);
            }

            showToast(`Playlist "${title}" criada com sucesso no seu Spotify!`, 'success');
            
            // Resetar formulário
            DOM.playlistMetaSettings.classList.add('hidden');
            DOM.previewContent.classList.add('hidden');
            DOM.previewPlaceholder.classList.remove('hidden');
            DOM.searchInput.value = '';
            state.selectedItem = null;
            state.currentTracks = [];
        }
    } catch (e) {
        console.error(e);
        showToast(`Erro ao criar playlist: ${e.message}`, 'error');
    } finally {
        DOM.btnGeneratePlaylist.disabled = false;
        DOM.btnGeneratePlaylist.innerHTML = '<i data-lucide="plus-circle"></i> Criar no Spotify';
        lucide.createIcons();
    }
});

// -------------------------------------------------------------
// EVENT BINDINGS
// -------------------------------------------------------------

// Tabs de Tipo de Playlist
DOM.tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        DOM.tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.searchType = btn.dataset.type;
        
        // Limpar pré-visualizações anteriores caso o tipo de busca mude
        DOM.searchResultsContainer.classList.add('hidden');
        DOM.playlistMetaSettings.classList.add('hidden');
        DOM.previewContent.classList.add('hidden');
        DOM.previewPlaceholder.classList.remove('hidden');
        state.selectedItem = null;
        state.currentTracks = [];
        
        // Refazer busca se houver algo digitado
        const query = DOM.searchInput.value.trim();
        if (query.length >= 2) {
            performSearch(query);
        }
    });
});

// Botão Conectar Spotify
DOM.btnLogin.addEventListener('click', () => {
    redirectToSpotifyAuth();
});

// Botão Sair
DOM.btnLogout.addEventListener('click', () => {
    logout();
});

function logout() {
    state.accessToken = null;
    state.refreshToken = null;
    state.expiresAt = 0;
    state.user = null;

    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_expires_at');

    DOM.userProfile.classList.add('hidden');
    DOM.btnLogin.classList.remove('hidden');
    DOM.searchInput.disabled = true;
    DOM.searchInput.placeholder = "Conecte-se para pesquisar...";
    DOM.playlistMetaSettings.classList.add('hidden');
    DOM.previewContent.classList.add('hidden');
    DOM.previewPlaceholder.classList.remove('hidden');
    DOM.searchResultsContainer.classList.add('hidden');
    DOM.searchInput.value = '';

    showToast('Sessão encerrada.', 'success');
}

// Modal Configurações
DOM.btnSettings.addEventListener('click', openSettingsModal);
DOM.btnSetupNow.addEventListener('click', openSettingsModal);
DOM.btnCloseModal.addEventListener('click', closeSettingsModal);

function openSettingsModal() {
    DOM.clientIdInput.value = state.clientId;
    DOM.settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
    DOM.settingsModal.classList.add('hidden');
}

DOM.btnSaveSettings.addEventListener('click', () => {
    const id = DOM.clientIdInput.value.trim();
    if (!id) {
        showToast('Client ID não pode ser vazio', 'error');
        return;
    }
    state.clientId = id;
    localStorage.setItem('spotify_client_id', id);
    closeSettingsModal();
    checkSetupBanner();
    showToast('Configurações salvas!', 'success');
});

function checkSetupBanner() {
    if (!state.clientId) {
        DOM.setupBanner.classList.remove('hidden');
        DOM.searchInput.disabled = true;
    } else {
        DOM.setupBanner.classList.add('hidden');
        if (state.accessToken) {
            DOM.searchInput.disabled = false;
        }
    }
}

// -------------------------------------------------------------
// CONTROLES ADMINISTRATIVOS (SHOWCASE PÚBLICO)
// -------------------------------------------------------------
if (DOM.btnRemoveLast) {
    DOM.btnRemoveLast.addEventListener('click', async () => {
        if (!confirm('Tem certeza que deseja remover a última playlist adicionada da página pública?')) {
            return;
        }
        
        DOM.btnRemoveLast.disabled = true;
        try {
            const response = await fetch('/api/playlists/remove-last', {
                method: 'POST'
            });
            const data = await response.json();
            if (response.ok && (data.status === 'success' || data.status === 'ignored')) {
                showToast(data.message || 'Playlist removida com sucesso.', 'success');
            } else {
                throw new Error(data.error || 'Erro desconhecido.');
            }
        } catch (error) {
            console.error(error);
            showToast(`Falha ao remover playlist: ${error.message}`, 'error');
        } finally {
            DOM.btnRemoveLast.disabled = false;
        }
    });
}

if (DOM.btnClearAll) {
    DOM.btnClearAll.addEventListener('click', async () => {
        if (!confirm('ATENÇÃO: Isso removerá TODAS as playlists da página pública! Tem certeza que deseja continuar?')) {
            return;
        }
        
        DOM.btnClearAll.disabled = true;
        try {
            const response = await fetch('/api/playlists/clear-all', {
                method: 'POST'
            });
            const data = await response.json();
            if (response.ok && data.status === 'success') {
                showToast(data.message || 'Todas as playlists foram removidas.', 'success');
            } else {
                throw new Error(data.error || 'Erro desconhecido.');
            }
        } catch (error) {
            console.error(error);
            showToast(`Falha ao limpar playlists: ${error.message}`, 'error');
        } finally {
            DOM.btnClearAll.disabled = false;
        }
    });
}

// -------------------------------------------------------------
// APP INITIALIZATION
// -------------------------------------------------------------
async function initApp() {
    DOM.uriDisplay.textContent = CONFIG.REDIRECT_URI;
    checkSetupBanner();
    
    // Processar retorno do Spotify OAuth se houver code na URL
    await handleCallback();

    // Se já estivermos autenticados, carrega o perfil do usuário
    if (state.accessToken) {
        await fetchUserProfile();
    }
}

// Inicializar aplicativo
initApp();
