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

# Variáveis configuráveis
DOMAIN="150.136.84.82.nip.io"
EMAIL="heriveltogabriel@gmail.com" # Altere para o seu email de recuperação do Let's Encrypt
BASIC_AUTH_USER="admin"
BASIC_AUTH_PASS="spotygen123"
WEB_ROOT="/usr/share/nginx/html"

echo -e "${YELLOW}[1/6] Atualizando pacotes e instalando dependências...${NC}"
# Ativar repositórios necessários para Oracle Linux / CentOS
if [ -f /etc/oracle-release ]; then
  yum install -y oracle-epel-release-el7 || yum install -y oracle-epel-release-el8 || true
elif [ -f /etc/redhat-release ]; then
  yum install -y epel-release || true
fi

yum update -y
yum install -y nginx certbot python2-certbot-nginx httpd-tools git

echo -e "${YELLOW}[2/6] Configurando Diretório Web e copiando arquivos...${NC}"
mkdir -p "$WEB_ROOT"
# Se executado a partir da pasta clonada do repositório, copia os arquivos do app
if [ -f "index.html" ] && [ -f "app.js" ]; then
  cp index.html style.css app.js config.js "$WEB_ROOT/"
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
}
EOF

# Aplicar contexto do SELinux se ativo
if [ -x "$(command -v restorecon)" ]; then
  echo -e "${YELLOW}Aplicando contextos SELinux para arquivos e configurações...${NC}"
  restorecon -v /etc/nginx/conf.d/spotygen.conf || true
  restorecon -R -v "$WEB_ROOT" || true
fi

echo -e "${YELLOW}[6/6] Reiniciando e habilitando Nginx...${NC}"
systemctl daemon-reload
systemctl enable nginx
systemctl restart nginx

# Testar configuração
nginx -t

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}  Instalação concluída com sucesso!                  ${NC}"
echo -e "${GREEN}  Acesse o aplicativo em: https://$DOMAIN          ${NC}"
echo -e "${GREEN}  Usuário: $BASIC_AUTH_USER                          ${NC}"
echo -e "${GREEN}  Senha: $BASIC_AUTH_PASS                            ${NC}"
echo -e "${GREEN}=====================================================${NC}"
echo -e "${YELLOW}Dica: Altere a senha executando: sudo htpasswd /etc/nginx/.htpasswd $BASIC_AUTH_USER${NC}"
