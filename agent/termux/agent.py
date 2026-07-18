import json
import time
import sys
import os

# Install deps if needed
try:
    import requests
    import websocket
except ImportError:
    os.system("pip install requests websocket-client")
    import requests
    import websocket

from modules.clipboard import ClipboardSync
from modules.monitor import DeviceMonitor
from modules.input import InputInjector
from modules.screen import ScreenStreamer
from modules.heartbeat import Heartbeat

def load_config():
    with open('config.json', 'r') as f:
        return json.load(f)

def main():
    print("Starting CloudPhone Agent...")
    config = load_config()
    
    if not config['device_id'] or not config['device_token']:
        print("Please register the device first and fill config.json")
        return
        
    clipboard = ClipboardSync()
    monitor = DeviceMonitor()
    input_injector = InputInjector()
    
    screen = ScreenStreamer(config, input_injector)
    heartbeat = Heartbeat(config, monitor, clipboard)
    
    # Start screen streamer thread
    import threading
    threading.Thread(target=screen.run, daemon=True).start()
    
    # Main ping loop
    while True:
        heartbeat.ping()
        time.sleep(config.get('ping_interval', 5))

if __name__ == '__main__':
    main()
