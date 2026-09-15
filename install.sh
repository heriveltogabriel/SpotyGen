#!/bin/bash

# SpotyGen - Script de Instalação e Configuração Automática (Nginx + SSL + Basic Auth)
# Desenvolvido para Oracle Linux 7/8 / CentOS 7/8 / RHEL

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}       SpotyGen - Instalador Automatizado            ${NC}"
echo -e "${GREEN}=====================================================${NC}"

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Erro: Por favor, execute este script como root ou usando sudo.${NC}"
  exit 1
fi

# Variáveis configuráveis (podem ser alteradas aqui, via argumentos ou env vars)
DOMAIN="${1:-${DOMAIN:-seu-dominio.com}}"
EMAIL="${2:-${EMAIL:-seu-email@provedor.com}}" # Usado para recuperação do Let's Encrypt
BASIC_AUTH_USER="admin"
BASIC_AUTH_PASS="spotygen123"
WEB_ROOT="/usr/share/nginx/html"

# Se o domínio não foi passado e não é interativo, tentar inferir usando nip.io com o IP público
if [ "$DOMAIN" = "seu-dominio.com" ]; then
  if [ -t 0 ]; then
    read -p "Digite o seu domínio/IP (ex: 150.136.84.82.nip.io ou app.meudominio.com): " INPUT_DOMAIN
    [ -n "$INPUT_DOMAIN" ] && DOMAIN="$INPUT_DOMAIN"
  else
    PUB_IP=$(curl -s --connect-timeout 5 https://ifconfig.me || echo "")
    if [ -n "$PUB_IP" ]; then
      DOMAIN="${PUB_IP}.nip.io"
      echo -e "${YELLOW}Ambiente não-interativo detectado. Usando domínio automático: $DOMAIN${NC}"
    fi
  fi
fi

if [ "$EMAIL" = "seu-email@provedor.com" ]; then
  if [ -t 0 ]; then
    read -p "Digite seu e-mail para alertas do Let's Encrypt: " INPUT_EMAIL
    [ -n "$INPUT_EMAIL" ] && EMAIL="$INPUT_EMAIL"
  else
    EMAIL="admin@$DOMAIN"
  fi
fi

echo -e "${YELLOW}[1/6] Atualizando pacotes e instalando dependências...${NC}"
# Ativar repositórios necessários para Oracle Linux / CentOS / RHEL (7, 8, 9)
if [ -f /etc/oracle-release ]; then
  dnf install -y oracle-epel-release-el9 2>/dev/null || dnf install -y oracle-epel-release-el8 2>/dev/null || yum install -y oracle-epel-release-el7 2>/dev/null || dnf install -y epel-release 2>/dev/null || yum install -y epel-release 2>/dev/null || true
elif [ -f /etc/redhat-release ]; then
  dnf install -y epel-release 2>/dev/null || yum install -y epel-release 2>/dev/null || true
fi

if command -v dnf >/dev/null 2>&1; then
  dnf update -y || true
  dnf install -y nginx certbot python3-certbot-nginx httpd-tools git python3
else
  yum update -y || true
  yum install -y nginx certbot python3-certbot-nginx httpd-tools git python3 || yum install -y nginx certbot python2-certbot-nginx httpd-tools git python3
fi

# Liberar portas no Firewalld se estiver ativo
if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
  echo -e "${YELLOW}Configurando regras do Firewalld (HTTP/HTTPS)...${NC}"
  firewall-cmd --permanent --add-service=http || true
  firewall-cmd --permanent --add-service=https || true
  firewall-cmd --reload || true
fi

echo -e "${YELLOW}[2/6] Configurando Diretório Web e copiando arquivos...${NC}"
mkdir -p "$WEB_ROOT"
# Se executado a partir da pasta clonada do repositório, copia os arquivos do app
if [ -f "index.html" ] && [ -f "app.js" ]; then
  cp -rf index.html admin.html admin.js app.js config.js gerador.html lps.html lps.css logo.jpg playlists.json server.py style.css "$WEB_ROOT/" 2>/dev/null || true
  # Copiar serviço systemd
  if [ -f "spotygen-backend.service" ]; then
    cp spotygen-backend.service /etc/systemd/system/
    chown root:root /etc/systemd/system/spotygen-backend.service
    chmod 644 /etc/systemd/system/spotygen-backend.service
  fi
  echo -e "${GREEN}Arquivos copiados com sucesso para $WEB_ROOT${NC}"
else
  echo -e "${YELLOW}Aviso: Arquivos fonte não encontrados no diretório atual. Clone o repositório ou copie os arquivos manualmente para $WEB_ROOT.${NC}"
fi

# Ajustar permissões dos arquivos web
chown -R nginx:nginx "$WEB_ROOT"
find "$WEB_ROOT" -type d -exec chmod 755 {} \;
find "$WEB_ROOT" -type f -exec chmod 644 {} \;

echo -e "${YELLOW}[3/6] Configurando Autenticação Básica (Basic Auth)...${NC}"
htpasswd -bc /etc/nginx/.htpasswd "$BASIC_AUTH_USER" "$BASIC_AUTH_PASS"
chmod 600 /etc/nginx/.htpasswd
chown nginx:nginx /etc/nginx/.htpasswd
echo -e "${GREEN}Usuário '$BASIC_AUTH_USER' criado com sucesso com a senha padrão!${NC}"

echo -e "${YELLOW}[4/6] Gerando Certificado SSL Let's Encrypt para $DOMAIN...${NC}"
# Certificar que o Nginx está parado temporariamente se usarmos standalone, 
# ou rodar com o nginx ativo e o plugin. Vamos usar --nginx de forma não interativa.
systemctl start nginx || true
certbot --nginx --non-interactive --agree-tos --email "$EMAIL" -d "$DOMAIN" --redirect || true

echo -e "${YELLOW}[5/6] Configurando Nginx para SpotyGen...${NC}"
# Criar ou substituir o arquivo de configuração do bloco do servidor do Nginx
cat <<EOF > /etc/nginx/conf.d/spotygen.conf
server {
    listen       80;
    server_name  $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen       443 ssl http2;
    listen       [::]:443 ssl http2;
    server_name  $DOMAIN;
    root         $WEB_ROOT;

    auth_basic "Acesso Restrito - SpotyGen";
    auth_basic_user_file /etc/nginx/.htpasswd;

    ssl_certificate "/etc/letsencrypt/live/$DOMAIN/fullchain.pem";
    ssl_certificate_key "/etc/letsencrypt/live/$DOMAIN/privkey.pem";
    ssl_session_cache shared:SSL:1m;
    ssl_session_timeout  10m;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    include /etc/nginx/default.d/*.conf;

    location / {
        try_files \$uri \$uri/ =404;
    }

    # Página pública do showcase (LP da Semana)
    location = /lps.html {
        auth_basic off;
        try_files \$uri =404;
    }

    # Estilos da página pública
    location = /lps.css {
        auth_basic off;
        try_files \$uri =404;
    }

    # Logotipo público
    location = /logo.jpg {
        auth_basic off;
        try_files \$uri =404;
    }

    # Proxy para API de persistência das playlists
    location /api/playlists {
        auth_basic off;
        limit_except GET {
            auth_basic "Acesso Restrito - SpotyGen Admin";
            auth_basic_user_file /etc/nginx/.htpasswd;
        }
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Aplicar contexto do SELinux se ativo
if [ -x "$(command -v restorecon)" ]; then
  echo -e "${YELLOW}Aplicando contextos SELinux para arquivos e configurações...${NC}"
  restorecon -v /etc/nginx/conf.d/spotygen.conf || true
  restorecon -R -v "$WEB_ROOT" || true
fi

# Configurar SELinux para permitir que o Nginx conecte no backend Python local
if [ -x "$(command -v setsebool)" ]; then
  echo -e "${YELLOW}Configurando permissões de rede do SELinux para o Nginx...${NC}"
  setsebool -P httpd_can_network_connect 1 || true
fi

echo -e "${YELLOW}[6/6] Reiniciando e habilitando serviços...${NC}"
systemctl daemon-reload
# Ativar e rodar o backend
if [ -f "/etc/systemd/system/spotygen-backend.service" ]; then
  systemctl enable spotygen-backend.service
  systemctl restart spotygen-backend.service
fi
# Ativar e rodar o nginx
systemctl enable nginx
systemctl restart nginx

# Testar configuração
nginx -t

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}  Instalação concluída com sucesso!                  ${NC}"
echo -e "${GREEN}  Gerador Admin: https://$DOMAIN                      ${NC}"
echo -e "${GREEN}  Página Pública (LP da Semana): https://$DOMAIN/lps.html ${NC}"
echo -e "${GREEN}  Usuário Admin: $BASIC_AUTH_USER                    ${NC}"
echo -e "${GREEN}  Senha Admin: $BASIC_AUTH_PASS                      ${NC}"
echo -e "${GREEN}=====================================================${NC}"
echo -e "${YELLOW}Dica: Altere a senha executando: sudo htpasswd /etc/nginx/.htpasswd $BASIC_AUTH_USER${NC}"
