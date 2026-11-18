#!/bin/bash
set -e

echo "=========================================="
echo "✦ Eventox - Deploy VPS (Node Standalone)"
echo "=========================================="

# 1. Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. A instalar Node.js 22 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

NODE_MAJOR=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_MAJOR" -lt 22 ]; then
    echo "⚠️ Node.js versão atual: $(node -v). O Eventox requer Node >= 22.13.0."
    echo "A atualizar para Node.js 22 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "✔ Node.js: $(node -v)"
echo "✔ NPM: $(npm -v)"

# 2. Instalar dependências
echo "📦 A instalar dependências..."
npm install

# 3. Compilar bundle Node standalone (sem Wrangler)
echo "🔨 A compilar o Eventox para Node Standalone..."
npm run build:vps

# 4. Criar diretório de dados e importar se houver estado anterior
mkdir -p data
if [ ! -f "data/eventox.db" ]; then
    echo "🗄️ A inicializar base de dados persistente SQLite..."
    node scripts/import-existing-data.mjs || true
fi

# 5. Verificar PM2
if ! command -v pm2 &> /dev/null; then
    echo "⚙️ A instalar PM2 globalmente..."
    sudo npm install -g pm2
fi

# 6. Iniciar ou recarregar serviço no PM2
echo "🚀 A iniciar serviço no PM2 (porta 3050)..."
if pm2 describe eventox > /dev/null 2>&1; then
    pm2 delete eventox
fi
pm2 start ecosystem.vps.config.cjs

pm2 save

echo ""
echo "=========================================="
echo "✅ Eventox está a correr no PM2 em modo Node Standalone!"
echo "Porta local: 127.0.0.1:3050 (sem Wrangler)"
echo "=========================================="
