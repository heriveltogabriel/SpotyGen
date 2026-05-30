import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

FILE_PATH = '/usr/share/nginx/html/playlists.json'

class PlaylistHandler(BaseHTTPRequestHandler):
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
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/api/playlists':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                new_playlist = json.loads(post_data.decode('utf-8'))
                
                # Validation of required fields
                required_fields = ['name', 'description', 'spotifyUrl', 'imageUrl']
                if not all(field in new_playlist for field in required_fields):
                    raise ValueError("Faltando campos obrigatórios na playlist.")
                
                # Load existing
                playlists = []
                if os.path.exists(FILE_PATH):
                    try:
                        with open(FILE_PATH, 'r', encoding='utf-8') as f:
                            playlists = json.load(f)
                    except Exception:
                        playlists = []
                
                # Prepend the new playlist (newest first)
                playlists.insert(0, new_playlist)
                
                # Save
                with open(FILE_PATH, 'w', encoding='utf-8') as f:
                    json.dump(playlists, f, ensure_ascii=False, indent=2)
                
                # Set permissions to Nginx-readable
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
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    # Listen on localhost:5000 (proxied via Nginx)
    server = HTTPServer(('127.0.0.1', 5000), PlaylistHandler)
    print("Starting server on port 5000...")
    server.serve_forever()
