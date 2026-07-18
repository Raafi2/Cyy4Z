import json
import time
import sys
import os
import threading

# Prevent Termux from sleeping
try:
    os.system("termux-wake-lock")
except:
    pass

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
    
    if not config.get('device_id') or not config.get('device_token'):
        print("Device not registered. Auto-registering to panel...")
        try:
            import subprocess
            name = subprocess.check_output('getprop ro.product.model', shell=True).decode().strip()
            ver = subprocess.check_output('getprop ro.build.version.release', shell=True).decode().strip()
        except:
            name, ver = "CloudPhone", "11"
        try:
            res = requests.post(f"{config['panel_url']}/api/devices/register", json={"name": name, "androidVersion": ver})
            data = res.json()
            if 'deviceId' in data:
                config['device_id'] = data['deviceId']
                config['device_token'] = data['token']
                with open('config.json', 'w') as f:
                    json.dump(config, f, indent=2)
                print(f"Registered successfully! Device ID: {config['device_id']}")
            else:
                print("Failed to register:", data)
                return
        except Exception as e:
            print("Failed to reach panel for registration:", e)
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
