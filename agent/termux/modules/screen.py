import os
import subprocess
import threading
import time
import io
import websocket
import json

class ScreenStreamer:
    def __init__(self, config, input_handler):
        self.config = config
        self.input_handler = input_handler
        self.ws = None
        self.running = False
        self.connected = False
        self.target_fps = config.get('target_fps', 8)
        self.quality = config.get('jpeg_quality', 40)
        self.max_size = config.get('scrcpy_max_size', 720)

    def capture_frame(self):
        """Capture screen using Android screencap command"""
        try:
            result = subprocess.run(
                ['su', '-c', 'screencap -p'],
                capture_output=True, timeout=5
            )
            if result.returncode == 0 and len(result.stdout) > 100:
                png_data = result.stdout
                # Try to compress with Pillow if available
                try:
                    from PIL import Image
                    img = Image.open(io.BytesIO(png_data))
                    # Resize to max_size
                    w, h = img.size
                    if max(w, h) > self.max_size:
                        ratio = self.max_size / max(w, h)
                        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
                    # Convert RGBA to RGB (JPEG doesn't support alpha)
                    if img.mode == 'RGBA':
                        img = img.convert('RGB')
                    buf = io.BytesIO()
                    img.save(buf, format='JPEG', quality=self.quality)
                    return buf.getvalue()
                except ImportError:
                    # No Pillow, send raw PNG
                    return png_data
        except subprocess.TimeoutExpired:
            pass
        except Exception as e:
            print(f"Capture error: {e}")
        return None

    def connect_ws(self):
        """Connect to panel WebSocket with auto-reconnect"""
        panel_url = self.config['panel_url'].replace('https://', 'wss://').replace('http://', 'ws://')
        url = f"{panel_url}/ws?type=agent&deviceId={self.config['device_id']}&token={self.config['device_token']}"

        while self.running:
            try:
                print("Connecting to panel WebSocket...")
                self.ws = websocket.WebSocketApp(
                    url,
                    on_open=self._on_open,
                    on_message=self._on_message,
                    on_close=self._on_close,
                    on_error=self._on_error
                )
                self.ws.run_forever(ping_interval=20, ping_timeout=10)
            except Exception as e:
                print(f"WS connection error: {e}")

            self.connected = False
            if self.running:
                print("Reconnecting in 3 seconds...")
                time.sleep(3)

    def _on_open(self, ws):
        print("WebSocket connected to panel!")
        self.connected = True

    def _on_message(self, ws, message):
        """Handle control messages from browser"""
        if isinstance(message, str):
            try:
                data = json.loads(message)
                self.input_handler.handle_event(data)
            except:
                pass

    def _on_close(self, ws, close_status_code, close_msg):
        print(f"WebSocket closed: {close_status_code} {close_msg}")
        self.connected = False

    def _on_error(self, ws, error):
        print(f"WebSocket error: {error}")

    def stream_loop(self):
        """Continuously capture and send frames"""
        frame_interval = 1.0 / self.target_fps
        print(f"Streaming at ~{self.target_fps} FPS, JPEG quality: {self.quality}")

        while self.running:
            if not self.connected or not self.ws or not self.ws.sock or not self.ws.sock.connected:
                time.sleep(0.5)
                continue

            start = time.time()
            try:
                frame = self.capture_frame()
                if frame:
                    self.ws.send(frame, opcode=websocket.ABNF.OPCODE_BINARY)
            except Exception as e:
                print(f"Stream error: {e}")
                time.sleep(1)
                continue

            elapsed = time.time() - start
            sleep_time = max(0, frame_interval - elapsed)
            if sleep_time > 0:
                time.sleep(sleep_time)

    def run(self):
        """Main entry point - start streaming"""
        self.running = True
        print("Screen streamer starting (MJPEG mode)...")

        # Install Pillow for JPEG compression (smaller frames)
        try:
            from PIL import Image
            print("Pillow available - using JPEG compression")
        except ImportError:
            print("Installing Pillow for JPEG compression...")
            os.system("pip install Pillow")
            try:
                from PIL import Image
                print("Pillow installed successfully")
            except:
                print("WARNING: Pillow not available, sending raw PNG (larger frames)")

        # Start WebSocket connection thread
        ws_thread = threading.Thread(target=self.connect_ws, daemon=True)
        ws_thread.start()

        # Wait a moment for WS to connect
        time.sleep(2)

        # Start capture and stream loop
        self.stream_loop()
