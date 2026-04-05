[CmdletBinding()]
param(
  [switch]$IncludeNodeModules,
  [switch]$SkipDatabase
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-PathExists([string]$Root, [string]$RelativePath, [string]$ExpectedType) {
  $targetPath = Join-Path $Root $RelativePath
  if ($ExpectedType -eq 'Directory') {
    if (-not (Test-Path -LiteralPath $targetPath -PathType Container)) {
      throw "Diretorio obrigatorio nao encontrado: $RelativePath"
    }
    return
  }

  if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
    throw "Arquivo obrigatorio nao encontrado: $RelativePath"
  }
}

function Remove-DirectoryRobust([string]$DirectoryPath) {
  if (-not (Test-Path -LiteralPath $DirectoryPath -PathType Container)) {
    return
  }

  try {
    Remove-Item -LiteralPath $DirectoryPath -Recurse -Force -ErrorAction Stop
    return
  } catch {
    # Fallback para caminhos longos (node_modules pesado em Windows).
  }

  $parentDir = Split-Path -Parent $DirectoryPath
  $emptyDir = Join-Path $parentDir ("_cleanup_empty_" + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $emptyDir -Force | Out-Null

  try {
    & robocopy $emptyDir $DirectoryPath /MIR /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    try {
      Remove-Item -LiteralPath $DirectoryPath -Recurse -Force -ErrorAction Stop
    } catch {
      cmd /c "rmdir /s /q `"$DirectoryPath`"" | Out-Null
    }
  } finally {
    if (Test-Path -LiteralPath $emptyDir -PathType Container) {
      Remove-Item -LiteralPath $emptyDir -Recurse -Force -ErrorAction SilentlyContinue
    }
  }

  if (Test-Path -LiteralPath $DirectoryPath -PathType Container) {
    Write-Warning "Nao foi possivel remover a pasta temporaria: $DirectoryPath"
  }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
Set-Location $projectRoot

$requiredFiles = @(
  'app.js',
  'package.json',
  'package-lock.json'
)
$requiredDirs = @(
  'server',
  'prisma'
)

foreach ($file in $requiredFiles) {
  Assert-PathExists -Root $projectRoot -RelativePath $file -ExpectedType 'File'
}
foreach ($dir in $requiredDirs) {
  Assert-PathExists -Root $projectRoot -RelativePath $dir -ExpectedType 'Directory'
}

if ($IncludeNodeModules) {
  Assert-PathExists -Root $projectRoot -RelativePath 'node_modules' -ExpectedType 'Directory'
}

Write-Step 'Gerando build de producao (frontend + prisma client)...'
npm run build:prod
if ($LASTEXITCODE -ne 0) {
  throw 'Falha ao executar npm run build:prod'
}

Assert-PathExists -Root $projectRoot -RelativePath 'dist\index.html' -ExpectedType 'File'

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$modeLabel = if ($SkipDatabase) {
  'update'
} elseif ($IncludeNodeModules) {
  'full'
} else {
  'min'
}
$modulesLabel = if ($IncludeNodeModules) { 'with-modules' } else { 'no-modules' }

$outputRoot = Join-Path $projectRoot 'deploy-packages\linknacional'
$stageDir = Join-Path $outputRoot "staging-$timestamp-$modeLabel-$modulesLabel"
$zipPath = Join-Path $outputRoot "inovatech-linknacional-$timestamp-$modeLabel-$modulesLabel.zip"

Write-Step "Preparando pasta de empacotamento: $stageDir"
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
if (Test-Path -LiteralPath $stageDir) {
  Remove-DirectoryRobust -DirectoryPath $stageDir
}
New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

$rootFilesToCopy = @(
  'app.js',
  'package.json',
  'package-lock.json',
  'env.linknacional.example',
  'LINKNACIONAL_DEPLOY.md',
  'LINKNACIONAL_SEM_TERMINAL.md'
)
$rootDirsToCopy = @(
  'dist',
  'server',
  'prisma',
  'scripts'
)

Write-Step 'Copiando arquivos principais...'
foreach ($relativeFile in $rootFilesToCopy) {
  $sourceFile = Join-Path $projectRoot $relativeFile
  if (Test-Path -LiteralPath $sourceFile -PathType Leaf) {
    Copy-Item -LiteralPath $sourceFile -Destination (Join-Path $stageDir $relativeFile) -Force
  }
}

Write-Step 'Copiando pastas da aplicacao...'
foreach ($relativeDir in $rootDirsToCopy) {
  $sourceDir = Join-Path $projectRoot $relativeDir
  Copy-Item -LiteralPath $sourceDir -Destination $stageDir -Recurse -Force
}

$uploadsSource = Join-Path $projectRoot 'uploads'
$uploadsTarget = Join-Path $stageDir 'uploads'
if (Test-Path -LiteralPath $uploadsSource -PathType Container) {
  Write-Step 'Copiando uploads...'
  Copy-Item -LiteralPath $uploadsSource -Destination $stageDir -Recurse -Force
} else {
  New-Item -ItemType Directory -Path $uploadsTarget -Force | Out-Null
}

if ($IncludeNodeModules) {
  Write-Step 'Incluindo node_modules no pacote...'
  $nodeModulesSource = Join-Path $projectRoot 'node_modules'
  $nodeModulesTarget = Join-Path $stageDir 'node_modules'
  New-Item -ItemType Directory -Path $nodeModulesTarget -Force | Out-Null

  & robocopy $nodeModulesSource $nodeModulesTarget /E /R:2 /W:2 /NFL /NDL /NJH /NJS /NP | Out-Null
  $robocopyExitCode = $LASTEXITCODE
  if ($robocopyExitCode -gt 7) {
    throw "Falha ao copiar node_modules com robocopy. Codigo: $robocopyExitCode"
  }
} else {
  $noModulesWarning = @(
    'Pacote gerado sem node_modules.',
    'No cPanel, abra Setup Node.js App e clique em "Run NPM Install" apos extrair o ZIP.'
  ) -join [Environment]::NewLine
  Set-Content -LiteralPath (Join-Path $stageDir 'NO_NODE_MODULES.txt') -Value $noModulesWarning -Encoding UTF8
}

if ($SkipDatabase) {
  Write-Step 'Removendo banco e dados de runtime para pacote de update...'

  $databaseFiles = @(
    'prisma\dev.db',
    'prisma\dev.db-journal',
    'prisma\dev.db-shm',
    'prisma\dev.db-wal',
    'prisma\dev.db.tmp'
  )
  foreach ($relativeDbFile in $databaseFiles) {
    $targetDbFile = Join-Path $stageDir $relativeDbFile
    if (Test-Path -LiteralPath $targetDbFile) {
      Remove-Item -LiteralPath $targetDbFile -Force
    }
  }

  $runtimeStateFiles = @(
    'server\data\state.json',
    'server\data\state.json.bak',
    'server\data\app-state.json'
  )
  foreach ($relativeStateFile in $runtimeStateFiles) {
    $targetStateFile = Join-Path $stageDir $relativeStateFile
    if (Test-Path -LiteralPath $targetStateFile) {
      Remove-Item -LiteralPath $targetStateFile -Force
    }
  }

  if (Test-Path -LiteralPath $uploadsTarget -PathType Container) {
    Get-ChildItem -LiteralPath $uploadsTarget -Force | Remove-Item -Recurse -Force
  } else {
    New-Item -ItemType Directory -Path $uploadsTarget -Force | Out-Null
  }

  $preserveDataHint = @(
    'Este pacote de update nao inclui banco e uploads para preservar dados do servidor.',
    'Mantenha o prisma/dev.db e a pasta uploads ja existentes na hospedagem.'
  ) -join [Environment]::NewLine
  Set-Content -LiteralPath (Join-Path $uploadsTarget 'README.txt') -Value $preserveDataHint -Encoding UTF8
}

$metadata = @(
  "generated_at=$(Get-Date -Format o)",
  "mode=$modeLabel",
  "include_node_modules=$($IncludeNodeModules.IsPresent)",
  "skip_database=$($SkipDatabase.IsPresent)",
  "startup_file=app.js"
)
Set-Content -LiteralPath (Join-Path $stageDir 'DEPLOY_METADATA.txt') -Value ($metadata -join [Environment]::NewLine) -Encoding UTF8

if (Test-Path -LiteralPath $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Write-Step "Gerando ZIP final: $zipPath"
Push-Location $stageDir
try {
  & tar -a -c -f $zipPath *
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao compactar com tar. Codigo: $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

if (-not (Test-Path -LiteralPath $zipPath -PathType Leaf)) {
  throw 'Falha ao gerar o arquivo ZIP final.'
}

Write-Step 'Limpando pasta temporaria de staging...'
Remove-DirectoryRobust -DirectoryPath $stageDir

$latestInfoPath = Join-Path $outputRoot 'ULTIMO_PACOTE.txt'
$latestInfo = @(
  "zip=$zipPath",
  "generated_at=$(Get-Date -Format o)",
  "mode=$modeLabel",
  "include_node_modules=$($IncludeNodeModules.IsPresent)",
  "skip_database=$($SkipDatabase.IsPresent)"
)
Set-Content -LiteralPath $latestInfoPath -Value ($latestInfo -join [Environment]::NewLine) -Encoding UTF8

Write-Step 'Pacote pronto para upload no cPanel.'
Write-Host "Arquivo: $zipPath" -ForegroundColor Green
Write-Host "Resumo: $latestInfoPath" -ForegroundColor Green

if ($IncludeNodeModules) {
  Write-Warning 'Este node_modules foi montado no Windows. Em hospedagem Linux, prefira clicar em "Run NPM Install" no cPanel quando possivel.'
}
