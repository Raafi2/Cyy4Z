#!/bin/bash
echo "Installing CloudPhone Termux Agent..."
pkg update -y
pkg install python root-repo tsu termux-api git wget libjpeg-turbo -y
pip install requests websocket-client Pillow

# Backup existing config if present
BACKUP_CONFIG=""
if [ -f ~/cloudphone-agent/config.json ]; then
    BACKUP_CONFIG=$(cat ~/cloudphone-agent/config.json)
    echo "Found existing config, preserving device credentials..."
fi

echo "Downloading agent code..."
cd ~
rm -rf Cyy4Z
git clone https://github.com/Raafi2/Cyy4Z.git
rm -rf cloudphone-agent
mv Cyy4Z/agent/termux cloudphone-agent
rm -rf Cyy4Z

cd cloudphone-agent

# Restore existing config or create new one
if [ -n "$BACKUP_CONFIG" ]; then
    echo "$BACKUP_CONFIG" > config.json
    echo "Restored existing device credentials!"
else
    echo "Configuring agent for panel..."
    cat > config.json << EOF
{
  "panel_url": "https://cyy4z-production.up.railway.app",
  "device_id": "",
  "device_token": "",
  "ping_interval": 5,
  "target_fps": 6,
  "jpeg_quality": 40,
  "scrcpy_max_size": 720
}
EOF
fi

echo "Installation complete!"
echo "Starting agent now..."
python agent.py
