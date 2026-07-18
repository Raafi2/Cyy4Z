import subprocess
class ClipboardSync:
    def __init__(self):
        self.last_content = ""
    def get(self):
        try:
            res = subprocess.check_output(['termux-clipboard-get'], stderr=subprocess.DEVNULL)
            return res.decode('utf-8', errors='ignore')
        except:
            return ""
    def set(self, text):
        try:
            subprocess.run(['termux-clipboard-set', text])
        except:
            pass
