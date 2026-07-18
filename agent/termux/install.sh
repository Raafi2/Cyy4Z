#!/bin/bash
echo "Installing CloudPhone Termux Agent..."
pkg update -y
pkg install python root-repo tsu termux-api socat git wget -y
pip install requests websocket-client

echo "Downloading agent code..."
cd ~
rm -rf Cyy4Z cloudphone-agent
git clone https://github.com/Raafi2/Cyy4Z.git
mv Cyy4Z/agent/termux cloudphone-agent
rm -rf Cyy4Z

cd cloudphone-agent

echo "Configuring agent for panel..."
cat > config.json << EOF
{
  "panel_url": "https://cyy4z-production.up.railway.app",
  "device_id": "",
  "device_token": "",
  "ping_interval": 5,
  "scrcpy_bitrate": 2000000,
  "scrcpy_max_size": 720
}
EOF

echo "Installation complete!"
echo "Starting agent now..."
python agent.py
