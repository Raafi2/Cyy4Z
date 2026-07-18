import os
import subprocess
import threading
import time
import socket
import websocket
import urllib.request

SCRCPY_VERSION = 'v2.7'
SCRCPY_JAR = f"scrcpy-server-{SCRCPY_VERSION}.jar"

class ScreenStreamer:
    def __init__(self, config, input_handler):
        self.config = config
        self.input_handler = input_handler
        self.ws = None
        self.running = False
        self.server_proc = None

    def download_scrcpy(self):
        abs_jar = os.path.abspath(SCRCPY_JAR)
        if not os.path.exists(abs_jar):
            print(f"Downloading {SCRCPY_JAR}...")
            url = f"https://github.com/Genymobile/scrcpy/releases/download/{SCRCPY_VERSION}/scrcpy-server-{SCRCPY_VERSION}"
            urllib.request.urlretrieve(url, abs_jar)
            subprocess.run(['su', '-c', f'cp "{abs_jar}" /data/local/tmp/scrcpy-server.jar'])
            subprocess.run(['su', '-c', 'chmod 777 /data/local/tmp/scrcpy-server.jar'])

    def start_scrcpy(self):
        bitrate = self.config.get('scrcpy_bitrate', 2000000)
        max_size = self.config.get('scrcpy_max_size', 720)
        cmd = [
            'su', '-c',
            f'CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / com.genymobile.scrcpy.Server '
            f'{SCRCPY_VERSION} tunnel_forward=true audio=false control=false cleanup=false '
            f'video_bit_rate={bitrate} max_size={max_size}'
        ]
        print("Starting scrcpy-server...")
        self.server_proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        time.sleep(2)
        
        # Forward socket
        subprocess.run(['su', '-c', 'am start-foreground-service -a android.intent.action.MAIN']) # dummy keepalive
        # Actually scrcpy-server opens a local abstract socket named 'scrcpy'. We can read it with socat or direct unix socket in python if rooted, but let's use adb/port forwarding if local.
        # For simplicity in Termux, we bind the scrcpy server to a local port by injecting a tiny socat via su, or we use standard abstract unix socket.
        # In a real impl, scrcpy client connects via ADB. Here, we read from abstract socket:
        
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        try:
            # Android abstract namespace socket starts with null byte
            self.sock.connect(b'\0scrcpy')
            print("Connected to scrcpy video socket")
            # Read dummy byte
            self.sock.recv(1)
            # Read metadata (64 bytes device name + 2 bytes width + 2 bytes height)
            meta = self.sock.recv(68)
        except Exception as e:
            print("Socket connect failed:", e)

    def connect_ws(self):
        url = self.config['panel_url'].replace('http', 'ws')
        url = f"{url}/ws?type=agent&deviceId={self.config['device_id']}&token={self.config['device_token']}"
        self.ws = websocket.WebSocketApp(
            url,
            on_message=self.on_message,
            on_close=self.on_close
        )
        threading.Thread(target=self.ws.run_forever, daemon=True).start()

    def on_message(self, ws, message):
        import json
        if isinstance(message, str):
            try:
                data = json.loads(message)
                self.input_handler.handle_event(data)
            except: pass

    def on_close(self, ws, *args):
        print("WebSocket closed")

    def run(self):
        self.download_scrcpy()
        self.start_scrcpy()
        self.connect_ws()
        self.running = True
        
        while self.running:
            if hasattr(self, 'sock') and self.ws and self.ws.sock and self.ws.sock.connected:
                try:
                    # H264 packets
                    data = self.sock.recv(32768)
                    if data:
                        self.ws.send(data, opcode=websocket.ABNF.OPCODE_BINARY)
                except Exception as e:
                    time.sleep(1)
            else:
                time.sleep(1)
