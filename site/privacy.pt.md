# Política de privacidade do ClearFlow (清流)

Data de vigência: 21 de outubro de 2026

O ClearFlow é uma extensão de navegador que limpa seções de comentários e traduz publicações no X, Reddit, YouTube, Xiaohongshu (RedNote) e Hacker News. É publicado pela OhMyAI. Esta política explica quais dados a extensão lê, o que envia e para quem, e o que armazena no seu dispositivo.

**Em resumo:** o ClearFlow envia os comentários e as publicações que você está vendo a dois serviços que você escolhe e paga: TypeSafe, para avaliá-los, e OpenRouter, para traduzi-los. Ele usa as chaves de API que você informa. Não envia nada a nós, os desenvolvedores. Não transmite estatísticas de uso, não rastreia sua navegação e não executa código remoto. Os demais dados armazenados ficam no seu navegador.

## Onde funciona

Os scripts da extensão funcionam apenas nestes sites: `x.com`, `twitter.com`, `www.reddit.com`, `www.youtube.com`, `www.xiaohongshu.com`, `www.rednote.com` e `news.ycombinator.com`. A extensão não lê seu histórico de navegação nem outros sites. Nesses sites, ela lê apenas o seu nome de usuário, localmente, para não avaliar suas próprias publicações; nunca o envia a ninguém.

## O que é enviado e para quem

### TypeSafe (`api.typesafe.ai`) — avaliação de comentários

Usado para limpar comentários (spam, ofensas, conteúdo sexual e respostas como “legal” ou “+1”) e, no X, avaliar a qualidade das traduções do próprio X. Os dados só são enviados se você informar uma chave da TypeSafe (Jev).

- Para cada comentário da página que as regras locais não conseguem classificar: o texto do comentário (até 600 caracteres), o nome de exibição e o identificador do autor do comentário, o texto da publicação à qual ele responde (até 400 caracteres) e o nome de exibição e o identificador do autor da publicação. São enviados até dez comentários por solicitação.
- Nas páginas de perfil e busca do X e nas páginas de listas do Reddit, são enviadas as publicações da lista no lugar dos comentários, com uma descrição fixa de uma linha no lugar do texto da publicação.
- Nas publicações que o X traduziu automaticamente: o texto original e a tradução do X (Grok), para avaliar se a tradução do X é boa o suficiente. A retradução feita pelo ClearFlow não é enviada.
- Somente se você ativar “Verificar imagens nas respostas” (desativado por padrão): imagens anexadas a esses comentários, reduzidas de tamanho, são enviadas com o texto. Para isso, a extensão pede permissão para ler imagens de `pbs.twimg.com`, `i.redd.it`, `preview.redd.it` e `*.xhscdn.com`; ela revoga a permissão quando você desativa a opção.
- Somente se você tiver marcado spam nesse site (“Ocultar esta resposta” ou o funil na barra de aviso): as dez respostas que você marcou mais recentemente nesse site (texto de até 240 caracteres e conta associada) são enviadas com esses comentários como exemplos, para que a TypeSafe identifique spam do mesmo tipo. Logo após uma marcação, os comentários da página que não foram limpos são avaliados mais uma vez usando os exemplos (até 25 por solicitação).
- No YouTube, somente quando você escolhe as legendas traduzidas automaticamente pelo YouTube e ativa “Melhorar legendas traduzidas automaticamente”, e o vídeo não tem legendas em chinês produzidas por uma pessoa para usar no lugar: as primeiras linhas das legendas originais (até 40) e a tradução do YouTube são enviadas para avaliar a qualidade dessa tradução.
- Os resultados ficam em cache local por até sete dias para reduzir solicitações repetidas para o mesmo comentário no mesmo contexto. Um comentário pode ser enviado novamente se o cache for limpo, uma entrada for removida ou uma nova avaliação for necessária.

### OpenRouter (`openrouter.ai`) — tradução

Os dados só são enviados se você informar uma chave do OpenRouter e ativar a tradução para aquele site.

- O texto das publicações e dos comentários que precisam de tradução, ou de uma tradução melhor que a do X. Não são enviados o autor, o ID da publicação nem qualquer outra coisa da página.
- No YouTube, somente quando a TypeSafe considera ruim a tradução automática das legendas feita pelo YouTube, conforme explicado acima: as legendas originais do trecho do vídeo que você está assistindo, cerca de 40 linhas por vez, são enviadas para retradução. A conversão de legendas do chinês tradicional para o simplificado acontece no seu computador e não envia nada.
- O OpenRouter repassa o texto ao modelo de tradução escolhido nas Configurações: por padrão, um modelo da OpenAI, com um modelo da DeepSeek como alternativa. Cada um desses provedores tem sua própria política de dados.

### Nenhum outro destinatário

O ClearFlow não envia nada à OhMyAI nem a ninguém além dos dois serviços acima. As estatísticas de uso e custo ficam no seu dispositivo. Não há envio de dados de análise de uso ou relatórios de falhas, publicidade nem código de rastreamento. Todo o código está no pacote da extensão; nada é baixado e executado depois.

Quando você clica em “Testar conexão” nas Configurações, um pequeno texto de exemplo fixo é enviado ao serviço testado.

## O que fica armazenado no seu dispositivo

Os dados a seguir ficam no armazenamento da extensão no seu navegador (`chrome.storage.local` e IndexedDB). As chaves de API autenticam as solicitações aos respectivos serviços, e o spam que você marcou pode ser enviado à TypeSafe como exemplo, conforme explicado acima. Os demais dados armazenados não são enviados:

- Suas configurações e suas duas chaves de API. As chaves ficam no banco de dados da própria extensão neste navegador, que os sites visitados (e os scripts da extensão executados neles) não conseguem ler; só o processo em segundo plano da extensão as usa. Elas não são criptografadas.
- Contadores diários (quantos itens foram limpos ou traduzidos e custo estimado).
- Suas correções (“não é spam”, “ocultar esta resposta”) e o spam que você marcou, com o texto do comentário (até 300 caracteres; as últimas 3.000 correções e as últimas 500 respostas marcadas).
- Um cache dos resultados da TypeSafe (apenas impressões digitais e pontuações, sem texto; excluídos sete dias após a avaliação do comentário) e um cache de traduções (o texto traduzido; excluído após 30 dias sem uso). Cada cache tem limite padrão de 50 MB; quando fica cheio, as entradas mais antigas são removidas primeiro.

No X e no YouTube, dois pequenos scripts (`pagedata.js` e `ytdata.js`) são executados na página e leem respostas da própria API do site que a página já recebeu. Eles obtêm o texto original, não traduzido, de uma publicação e identificam o autor de um comentário. Esses scripts apenas leem: não fazem solicitações nem alteram o que o site recebe.

## Suas escolhas

- Desative o ClearFlow em qualquer site, ou desative a limpeza e a tradução separadamente, na janela da extensão ou nas Configurações.
- Em Configurações → Dados e privacidade, exporte seus dados (configurações, estatísticas, correções e spam marcado), limpe os caches ou apague as estatísticas e os registros, inclusive suas correções. O spam que você marcou aparece em uma lista nas Configurações; é possível excluir entradas uma a uma ou todas de uma vez.
- Ao desinstalar a extensão, todos os dados armazenados por ela são apagados.
- Você pode revogar ou trocar suas chaves de API na TypeSafe ou no OpenRouter a qualquer momento.

## Crianças

O ClearFlow não se destina a crianças e não coleta intencionalmente informações de ninguém.

## Alterações

Se esta política mudar, a nova versão será publicada em https://github.com/remember2015/clearflow/blob/main/PRIVACY.md com uma nova data de vigência, e a mudança será registrada no histórico de versões.

## Contato

developer@ohmyai.app
