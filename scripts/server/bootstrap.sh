#!/usr/bin/env bash
# Prepares a fresh Ubuntu server to run Maschina. Safe to run again: every step checks first.
#
#   ssh ubuntu@<the server> 'bash -s' < scripts/server/bootstrap.sh
#
# It installs Docker, closes everything except SSH, turns on automatic security updates, and makes
# /opt/maschina for the compose file, the environment and the backups. It never handles secrets.
set -euo pipefail

say() { printf '\n== %s\n' "$1"; }

say "Updating the system"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

say "Installing what the server needs"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  ca-certificates curl gnupg ufw fail2ban unattended-upgrades age

if ! command -v docker >/dev/null; then
  say "Installing Docker"
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

say "Closing every port except SSH"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw --force enable

say "Refusing password logins, so only the key works"
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sudo systemctl reload ssh || sudo systemctl reload sshd

say "Turning on automatic security updates"
sudo systemctl enable --now unattended-upgrades
sudo systemctl enable --now fail2ban

say "Making a home for Maschina"
sudo mkdir -p /opt/maschina/backups
sudo chown -R "$USER":"$USER" /opt/maschina

say "Adding swap, so a busy moment cannot kill Postgres"
if ! sudo swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile >/dev/null
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

say "Done. Log out and back in so Docker works without sudo."
