// Configurações do Spotify
const CONFIG = {
    // Você pode colocar seu Client ID diretamente aqui, ou inseri-lo na tela da aplicação.
    CLIENT_ID: '', 
    REDIRECT_URI: window.location.origin + window.location.pathname, // Resolve dinamicamente para a página atual (ex: /gerador.html)
    SCOPES: [
        'playlist-modify-public',
        'playlist-modify-private',
        'user-read-private',
        'user-read-email'
    ].join(' '),
    GOOGLE_CLIENT_ID: '',
    GOOGLE_SCOPES: 'https://www.googleapis.com/auth/youtube.force-ssl'
};
