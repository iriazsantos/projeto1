# Script para iniciar front e back simultaneamente
Write-Host "🚀 Iniciando INOVATECH CONNECT..."

# Iniciar servidor Node em background
Write-Host "🔧 Iniciando servidor Node na porta 3000..."
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "server/index.js"

# Aguardar um pouco para o servidor iniciar
Start-Sleep -Seconds 2

# Iniciar Vite em background
Write-Host "⚡ Iniciando Vite na porta 5173..."
Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run dev:client"

Write-Host "✅ Ambos os servidores foram iniciados!"
Write-Host "📱 Acesse: http://localhost:5173"
