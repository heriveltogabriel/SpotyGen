import json
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

FILE_PATH = '/usr/share/nginx/html/playlists.json'
COUNTER_PATH = '/usr/share/nginx/html/counter.txt'
DEFAULT_PORT = 5000

# Se o diretório do Nginx não existe (rodando localmente), ajusta caminhos e porta padrão
if not os.path.exists(os.path.dirname(FILE_PATH)):
    FILE_PATH = 'playlists.json'
    COUNTER_PATH = 'counter.txt'
    DEFAULT_PORT = 3000

class PlaylistHandler(SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/playlists':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            if os.path.exists(FILE_PATH):
                with open(FILE_PATH, 'r', encoding='utf-8') as f:
                    self.wfile.write(f.read().encode('utf-8'))
            else:
                self.wfile.write(b'[]')
        elif self.path == '/api/access-count':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            count = 0
            if os.path.exists(COUNTER_PATH):
                try:
                    with open(COUNTER_PATH, 'r', encoding='utf-8') as f:
                        count = int(f.read().strip())
                except Exception:
                    pass
            count += 1
            try:
                with open(COUNTER_PATH, 'w', encoding='utf-8') as f:
                    f.write(str(count))
                try:
                    os.chmod(COUNTER_PATH, 0o664)
                except Exception:
                    pass
            except Exception:
                pass
                
            self.wfile.write(json.dumps({"count": count}).encode('utf-8'))
        else:
            # Serve arquivos estáticos locais
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/playlists':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                new_playlist = json.loads(post_data.decode('utf-8'))
                
                # Validação de campos obrigatórios
                required_fields = ['name', 'description', 'spotifyUrl', 'imageUrl']
                if not all(field in new_playlist for field in required_fields):
                    raise ValueError("Faltando campos obrigatórios na playlist.")
                
                # Carregar existentes
                playlists = []
                if os.path.exists(FILE_PATH):
                    try:
                        with open(FILE_PATH, 'r', encoding='utf-8') as f:
                            playlists = json.load(f)
                    except Exception:
                        playlists = []
                
                # Adicionar no topo (mais recente primeiro)
                playlists.insert(0, new_playlist)
                
                # Salvar
                with open(FILE_PATH, 'w', encoding='utf-8') as f:
                    json.dump(playlists, f, ensure_ascii=False, indent=2)
                
                # Permissões do Nginx
                try:
                    os.chmod(FILE_PATH, 0o664)
                except Exception:
                    pass
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        
        elif self.path == '/api/playlists/remove-last':
            try:
                playlists = []
                if os.path.exists(FILE_PATH):
                    with open(FILE_PATH, 'r', encoding='utf-8') as f:
                        playlists = json.load(f)
                
                if len(playlists) > 0:
                    removed = playlists.pop(0) # Remove a mais recente (do topo)
                    with open(FILE_PATH, 'w', encoding='utf-8') as f:
                        json.dump(playlists, f, ensure_ascii=False, indent=2)
                    status = "success"
                    msg = f"Removido: {removed.get('name')}"
                else:
                    status = "ignored"
                    msg = "Lista de playlists já está vazia."
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": status, "message": msg}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))

        elif self.path == '/api/playlists/clear-all':
            try:
                # Grava lista vazia
                with open(FILE_PATH, 'w', encoding='utf-8') as f:
                    json.dump([], f, ensure_ascii=False, indent=2)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "message": "Todas as playlists foram removidas da página pública."}).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    server = HTTPServer(('0.0.0.0', port), PlaylistHandler)
    print(f"Starting server on port {port}...")
    server.serve_forever()
