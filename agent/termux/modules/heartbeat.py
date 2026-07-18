import time
import requests
import sys

class Heartbeat:
    def __init__(self, config, monitor, clipboard):
        self.config = config
        self.monitor = monitor
        self.clipboard = clipboard
        self.url = f"{config['panel_url']}/api/agent/ping"
        self.headers = {'Authorization': f"Bearer {config['device_id']}:{config['device_token']}"}
        
    def ping(self):
        stats = self.monitor.get_stats()
        stats['ip'] = self.monitor.get_ip()
        stats['clipboard'] = self.clipboard.get()
        # Add basic screen size
        stats['screen_width'] = 1080
        stats['screen_height'] = 1920
        
        try:
            res = requests.post(self.url, headers=self.headers, json=stats, timeout=5)
            data = res.json()
            if data.get('deleted'):
                print("Device deleted from panel. Exiting agent.")
                sys.exit(0)
            return True
        except Exception as e:
            print("Ping failed:", e)
            return False
