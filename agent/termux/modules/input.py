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
        except Exception as e:
            print(f"Input error: {e}")
