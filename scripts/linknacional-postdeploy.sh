#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SKIP_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --skip-build)
      SKIP_BUILD=true
      ;;
    *)
      echo "Parametro desconhecido: $arg"
      echo "Uso: bash scripts/linknacional-postdeploy.sh [--skip-build]"
      exit 1
      ;;
  esac
done

if [[ "${SKIP_BUILD_ENV:-false}" == "true" ]]; then
  SKIP_BUILD=true
fi

# cPanel/WHM often installs Node in /opt/cpanel/ea-nodejsXX/bin.
# If node/npm are not in PATH, auto-discover and export.
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  NODE_BIN_DIR="$(ls -d /opt/cpanel/ea-nodejs*/bin 2>/dev/null | sort -V | tail -n 1 || true)"
  if [[ -n "${NODE_BIN_DIR:-}" ]]; then
    export PATH="$NODE_BIN_DIR:$PATH"
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERRO: comando 'node' nao encontrado no PATH."
  echo "No WHM, instale pacote ea-nodejs (ex: ea-nodejs20/ea-nodejs22) e habilite Application Manager."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERRO: comando 'npm' nao encontrado no PATH."
  echo "Verifique instalacao do ea-nodejs no WHM (EasyApache 4)."
  exit 1
fi

echo "[1/6] Validando versoes de runtime..."
node -v
npm -v

echo "[2/6] Instalando dependencias (incluindo dev para build/prisma)..."
NPM_CI_INCLUDE_DEV_SUPPORTED=false
if npm ci --help 2>/dev/null | grep -q -- '--include'; then
  NPM_CI_INCLUDE_DEV_SUPPORTED=true
fi

if [[ -f package-lock.json ]]; then
  if [[ "$NPM_CI_INCLUDE_DEV_SUPPORTED" == "true" ]]; then
    npm ci --include=dev
  else
    # Compatibilidade com npm antigo (sem --include=dev).
    NPM_CONFIG_PRODUCTION=false npm ci
  fi
else
  if npm install --help 2>/dev/null | grep -q -- '--include'; then
    npm install --include=dev
  else
    NPM_CONFIG_PRODUCTION=false npm install
  fi
fi

if [[ "$SKIP_BUILD" == "true" ]]; then
  echo "[3/6] Build pulado (--skip-build). Validando dist/index.html..."
  if [[ ! -f dist/index.html ]]; then
    echo "ERRO: dist/index.html nao encontrado. Rode sem --skip-build ou envie pacote com frontend compilado."
    exit 1
  fi
else
  echo "[3/6] Gerando client do Prisma + build do frontend..."
  npm run build:prod
fi

echo "[4/6] Aplicando migracoes de producao..."
npm run db:migrate:prod

echo "[5/6] Garantindo pastas e arquivos persistentes..."
mkdir -p uploads server/data prisma
touch prisma/dev.db
if [[ ! -f server/data/state.json ]]; then
  echo "{}" > server/data/state.json
fi
chmod -R u+rwX uploads server/data prisma

if [[ "${RUN_SEED:-false}" == "true" ]]; then
  echo "[6/6] Executando seed (RUN_SEED=true)..."
  npm run db:seed
else
  echo "[6/6] Seed ignorado (defina RUN_SEED=true para executar)."
fi

echo "Deploy concluido. Agora reinicie o app no Setup Node.js App do cPanel."
