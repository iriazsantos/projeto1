import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const cwd = process.cwd();
const note = process.argv.slice(2).join(' ').trim();
const nowIso = new Date().toISOString();

function run(command) {
  try {
    return execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

function toBulletList(raw, fallback = '(vazio)', maxItems = 80) {
  if (!raw) return `- ${fallback}`;
  const lines = raw
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(0, maxItems);
  const rest = raw.split(/\r?\n/).filter(Boolean).length - lines.length;
  const listed = lines.map((line) => `- ${line}`).join('\n');
  if (rest > 0) {
    return `${listed}\n- ... +${rest} linhas ocultadas para manter resumo curto`;
  }
  return listed;
}

function writeTextFile(targetFile, content) {
  const targetPath = path.join(cwd, targetFile);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
}

const branch = run('git rev-parse --abbrev-ref HEAD') || '(sem git)';
const head = run('git rev-parse --short HEAD') || '(nao disponivel)';
const statusShort = run('git status --short');
const stagedFiles = run('git diff --cached --name-only');
const unstagedFiles = run('git diff --name-only');
const untrackedFiles = run('git ls-files --others --exclude-standard');
const recentCommits = run('git log --oneline -n 8');

const checkpointContent = `# Checkpoint de Retomada
Gerado em: ${nowIso}
Branch: ${branch}
Commit atual: ${head}

## Nota da sessao
${note || '(sem nota informada)'}

## Mudancas staged
${toBulletList(stagedFiles, '(vazio)', 30)}

## Mudancas nao staged
${toBulletList(unstagedFiles, '(vazio)', 30)}

## Arquivos nao rastreados
${toBulletList(untrackedFiles, '(vazio)', 30)}

## Status curto
${toBulletList(statusShort, '(vazio)', 60)}

## Commits recentes
${toBulletList(recentCommits, '(vazio)', 20)}

## Proxima sessao
- Revisar CHECKPOINT_RETORNADA.md
- Ler CONTEXTO_ATUAL.md
- Executar a primeira tarefa pendente

## Pendencias manuais (edite aqui)
- [ ] ...
`;

const promptRetomadaContent = `Use este prompt no novo chat:

Continuar projeto INOVATECH CONNECT exatamente de onde paramos.

Passos obrigatorios:
1. Ler "CHECKPOINT_RETORNADA.md".
2. Ler "CONTEXTO_ATUAL.md".
3. Confirmar em 5 linhas:
   - o que ja foi feito
   - o que esta pendente
   - primeiro passo tecnico que voce vai executar agora
4. Nao refatore fora do escopo sem me avisar.
5. Sempre salvar alteracoes de forma persistente (front + backend).

Depois disso, continue a implementacao.
`;

const fluxoContent = `# Fluxo Anti-Limite de Chat

Este fluxo evita perder contexto quando o chat reinicia ou bate limite.

## Sempre que for encerrar a sessao
1. Rode:
   npm run checkpoint -- "resumo rapido do que foi feito e o que falta"
2. Abra o arquivo:
   PROMPT_RETORNADA.md
3. Cole o prompt no novo chat.

## Arquivos usados
- CHECKPOINT_RETORNADA.md: snapshot tecnico automatico (git, status, arquivos, commits)
- CONTEXTO_ATUAL.md: memoria manual do projeto (objetivos, regras, pendencias)
- PROMPT_RETORNADA.md: prompt pronto para retomada

## Regra pratica
- Atualize CONTEXTO_ATUAL.md ao fim de blocos grandes.
- Gere checkpoint antes de fechar terminal ou trocar de chat.
`;

const contextoTemplate = `# Contexto Atual do Projeto

## Objetivo principal
- ...

## Regras de negocio criticas
- ...

## Funcionalidades concluidas
- ...

## Funcionalidades pendentes
- ...

## Decisoes tecnicas importantes
- ...

## Como validar rapido
1. ...
2. ...
3. ...

## Observacoes para proxima sessao
- ...
`;

writeTextFile('CHECKPOINT_RETORNADA.md', checkpointContent);
writeTextFile('PROMPT_RETORNADA.md', promptRetomadaContent);
writeTextFile('FLUXO_ANTILIMITE.md', fluxoContent);

const contextoPath = path.join(cwd, 'CONTEXTO_ATUAL.md');
const contextoJaExiste = fs.existsSync(contextoPath);
if (!contextoJaExiste) {
  writeTextFile('CONTEXTO_ATUAL.md', contextoTemplate);
}

console.log('Checkpoint gerado com sucesso.');
console.log('- CHECKPOINT_RETORNADA.md');
console.log('- PROMPT_RETORNADA.md');
console.log('- FLUXO_ANTILIMITE.md');
if (!contextoJaExiste) {
  console.log('- CONTEXTO_ATUAL.md (criado pela primeira vez)');
}
