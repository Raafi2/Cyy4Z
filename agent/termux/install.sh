#!/bin/bash
echo "Installing CloudPhone Termux Agent..."
pkg update -y
pkg install python root-repo tsu termux-api socat -y
pip install requests websocket-client

echo "Agent installed! Please edit config.json with your panel URL, device ID, and token."
echo "Then run: python agent.py"
