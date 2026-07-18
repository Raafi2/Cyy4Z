import subprocess
import threading

class InputInjector:
    def handle_event(self, data):
        # Fire and forget in a thread to not block WS
        threading.Thread(target=self._inject, args=(data,), daemon=True).start()

    def _inject(self, data):
        try:
            t = data.get('type')
            if t == 'touch':
                action = data.get('action') # down, move, up
                x, y = data.get('x'), data.get('y')
                if action == 'down':
                    # scrcpy usually handles down/move/up natively, but fallback to tap
                    subprocess.run(['su', '-c', f'input tap {x} {y}'])
                elif action == 'move':
                    pass # 'input tap' doesn't do move well, would need native scrcpy control socket
            elif t == 'key':
                kc = data.get('keycode')
                subprocess.run(['su', '-c', f'input keyevent {kc}'])
            elif t == 'text':
                text = data.get('text').replace(' ', '%s')
                subprocess.run(['su', '-c', f'input text {text}'])
            elif t == 'rotate':
                val = 1 if data.get('landscape') else 0
                subprocess.run(['su', '-c', 'settings put system accelerometer_rotation 0'])
                subprocess.run(['su', '-c', f'settings put system user_rotation {val}'])
            elif t == 'install_apk':
                url = data.get('url')
                filename = data.get('filename')
                threading.Thread(target=self._download_and_install, args=(url, filename), daemon=True).start()
        except Exception as e:
            print(f"Input error: {e}")

    def _download_and_install(self, url_path, filename):
        print(f"Downloading {filename}...")
        try:
            import requests
            import json
            with open('config.json', 'r') as f:
                config = json.load(f)
            
            full_url = f"{config['panel_url']}{url_path}"
            r = requests.get(full_url, stream=True, timeout=300)
            
            subprocess.run(['su', '-c', 'mkdir -p /sdcard/Download'])
            save_path = f'/sdcard/Download/{filename}'
            
            with open('temp_dl', 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            subprocess.run(['su', '-c', f'mv temp_dl "{save_path}"'])
            
            print(f"Downloaded to {save_path}, installing...")
            if filename.endswith('.apk'):
                res = subprocess.run(['su', '-c', f'pm install -r "{save_path}"'], capture_output=True, text=True)
                print(f"Install output: {res.stdout} {res.stderr}")
        except Exception as e:
            print(f"Install APK error: {e}")
