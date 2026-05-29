// Configurações do Spotify
const CONFIG = {
    // Você pode colocar seu Client ID diretamente aqui, ou inseri-lo na tela da aplicação.
    CLIENT_ID: '', 
    REDIRECT_URI: window.location.hostname === 'localhost' 
        ? `http://127.0.0.1:${window.location.port || '3000'}/` 
        : (window.location.origin + '/'), // Garante compatibilidade caso acesse por localhost ou 127.0.0.1
    SCOPES: [
        'playlist-modify-public',
        'playlist-modify-private',
        'user-read-private',
        'user-read-email'
    ].join(' ')
};
