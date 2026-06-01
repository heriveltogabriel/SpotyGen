import json
import time
import urllib.request
import urllib.parse

FILE_PATH = 'playlists.json'

def fetch_odesli(target_url):
    encoded = urllib.parse.quote_plus(target_url)
    api_url = f"https://api.song.link/v1-alpha.1/links?url={encoded}"
    req = urllib.request.Request(
        api_url,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    )
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode('utf-8'))
    except Exception as e:
        print(f"Error fetching {target_url}: {e}")
        return None

def main():
    with open(FILE_PATH, 'r', encoding='utf-8') as f:
        playlists = json.load(f)
    
    updated_count = 0
    for idx, pl in enumerate(playlists):
        # Skip if we already have Deezer and Amazon Music URLs
        if pl.get('deezerUrl') and pl.get('amazonMusicUrl'):
            print(f"[{idx+1}/{len(playlists)}] Skipping {pl.get('name')} - already has Deezer and Amazon Music links")
            continue

        # Usamos appleMusicUrl ou youtubeUrl (ou spotifyUrl se for de album)
        search_url = pl.get('appleMusicUrl')
        
        # Se não tiver appleMusicUrl, tenta youtubeUrl ou spotifyUrl
        if not search_url:
            search_url = pl.get('youtubeUrl')
        
        # Se ainda não tiver e for do Spotify (e for album, mas no json é playlist, então não adiantaria muito para o Odesli, mas podemos tentar)
        if not search_url:
            search_url = pl.get('spotifyUrl')
            
        if not search_url:
            print(f"Skipping {pl.get('name')} - no source URL found")
            continue
            
        print(f"[{idx+1}/{len(playlists)}] Resolving links for: {pl.get('name')} using {search_url}...")
        
        data = fetch_odesli(search_url)
        if data and 'linksByPlatform' in data:
            links = data['linksByPlatform']
            
            # YouTube Music
            if not pl.get('youtubeUrl') and 'youtubeMusic' in links:
                pl['youtubeUrl'] = links['youtubeMusic']['url']
                
            # Apple Music
            if not pl.get('appleMusicUrl') and 'appleMusic' in links:
                pl['appleMusicUrl'] = links['appleMusic']['url']
                
            # Deezer
            if not pl.get('deezerUrl') and 'deezer' in links:
                pl['deezerUrl'] = links['deezer']['url']
                updated_count += 1
                
            # Amazon Music
            if not pl.get('amazonMusicUrl') and 'amazonMusic' in links:
                pl['amazonMusicUrl'] = links['amazonMusic']['url']
                updated_count += 1
                

                
        # Atraso para evitar ser bloqueado por limites de taxa (rate limiting)
        time.sleep(10)
        
    with open(FILE_PATH, 'w', encoding='utf-8') as f:
        json.dump(playlists, f, ensure_ascii=False, indent=2)
        
    print(f"Finished migration! Updated {updated_count} platform links.")

if __name__ == '__main__':
    main()
