import subprocess
import os

class DeviceMonitor:
    def get_ip(self):
        try:
            return subprocess.check_output("hostname -I | awk '{print $1}'", shell=True).decode().strip()
        except: return "0.0.0.0"

    def get_stats(self):
        stats = {'cpu': 0, 'ram_used': 0, 'ram_total': 0, 'storage_free': 0, 'storage_total': 0}
        try:
            mem = subprocess.check_output('free -m', shell=True).decode().split('\n')[1].split()
            stats['ram_total'] = float(mem[1]) / 1024
            stats['ram_used'] = float(mem[2]) / 1024
            
            df = subprocess.check_output('df -h /data', shell=True).decode().split('\n')[1].split()
            stats['storage_total'] = float(df[1].replace('G','').replace('M','')) # simplified
            stats['storage_free'] = float(df[3].replace('G','').replace('M',''))
            
            # Simple CPU load average
            load = subprocess.check_output('cat /proc/loadavg', shell=True).decode().split()[0]
            stats['cpu'] = min(100.0, float(load) * 10)
        except:
            pass
        return stats
