#!/bin/bash
set -e

echo "=========================================="
echo "✦ Eventox - Script de Deploy na VPS"
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
    echo "Atualizando para Node.js 22 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "✔ Node.js: $(node -v)"
echo "✔ NPM: $(npm -v)"

# 2. Instalar dependências
echo "📦 Instalando dependências..."
npm install

# 3. Compilar a aplicação
echo "🔨 Compilando o Eventox (Vinext / Next)..."
npm run build

# 4. Aplicar migrações da base de dados D1
echo "🗄️ Aplicando migrações da base de dados D1..."
npx wrangler d1 migrations apply eventox --local || echo "Migrações já aplicadas ou verificadas."

# 5. Verificar PM2
if ! command -v pm2 &> /dev/null; then
    echo "⚙️ Instalando PM2 globalmente..."
    sudo npm install -g pm2
fi

# 6. Iniciar ou Reiniciar processo no PM2
echo "🚀 Iniciando/Reiniciando serviço no PM2..."
if pm2 describe eventox > /dev/null 2>&1; then
    pm2 reload eventox
else
    pm2 start ecosystem.config.cjs
fi

pm2 save

echo ""
echo "=========================================="
echo "✅ Eventox está a correr com sucesso no PM2!"
echo "Porta local: 127.0.0.1:3000"
echo "=========================================="
