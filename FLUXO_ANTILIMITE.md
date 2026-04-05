# Fluxo Anti-Limite de Chat

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
