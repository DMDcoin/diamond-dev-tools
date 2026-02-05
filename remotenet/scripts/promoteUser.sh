#!/bin/bash
USER_NAME=$1
TMP_KEY="/root/.ssh/authorized_keys"

# 1. Create user if missing
if ! id "$USER_NAME" &>/dev/null; then
    sudo useradd -m -s /bin/bash "$USER_NAME"
fi

SSH_DIR="/home/$USER_NAME/.ssh"


AUTH_KEYS="$SSH_DIR/authorized_keys"

# 3. Create .ssh directory
sudo mkdir -p "$SSH_DIR"
sudo chmod 700 "$SSH_DIR"

# 4. Move the file from /tmp to the final destination
if [ -f "$TMP_KEY" ]; then
    sudo cp "$TMP_KEY" "$AUTH_KEYS"
    sudo chmod 600 "$AUTH_KEYS"
    sudo chown -R "$USER_NAME:$USER_NAME" "$SSH_DIR"
    echo "Keys installed for $USER_NAME"
else
    echo "Error: Key file not found in /tmp"
    exit 1
fi
