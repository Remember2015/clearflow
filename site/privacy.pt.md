# Política de Privacidade do ClearFlow (清流)

Data de vigência: 27 de outubro de 2026

ClearFlow é uma extensão de navegador que organiza seções de comentários e traduz publicações no X, Reddit, YouTube, Xiaohongshu (RedNote) e Hacker News. É publicada pela OhMyAI. Esta política explica o que a extensão lê, o que envia, para quem e o que mantém no seu dispositivo.

**Em resumo:** ClearFlow envia os comentários e as publicações que você está vendo para a OpenRouter, um serviço que você escolhe e paga, usando uma chave de API que você mesmo informa. A OpenRouter encaminha esse conteúdo para o modelo Jev, da TypeSafe (para avaliá-lo), e para um modelo de tradução (para traduzi-lo). Se você também adicionar uma chave opcional da TypeSafe, as solicitações de avaliação serão enviadas diretamente à TypeSafe. Nesse modo de uso, nada é enviado para nós, os desenvolvedores. Se você optar pela assinatura ClearFlow (opcional e paga; consulte a seção abaixo), o mesmo conteúdo passará pelo nosso servidor, que manterá apenas os dados listados nessa seção. A extensão não envia estatísticas de uso, não rastreia seu comportamento de navegação e não executa código remoto. Os outros dados armazenados permanecem no seu navegador.

## Onde funciona

Os scripts da extensão funcionam apenas nestes sites: `x.com`, `twitter.com`, `www.reddit.com`, `www.youtube.com`, `www.xiaohongshu.com`, `www.rednote.com` e `news.ycombinator.com`. A extensão não lê seu histórico de navegação nem qualquer outro site. Nesses sites, ela lê apenas seu nome de usuário, localmente, para não avaliar suas próprias publicações; esse dado nunca é enviado a ninguém.

## O que é enviado e para quem

### Modelo Jev da TypeSafe — avaliação de comentários

Usado para a limpeza (spam, abuso, conteúdo sexual e respostas como "legal" ou "+1") e para avaliar a qualidade das traduções automáticas do X e das legendas traduzidas automaticamente do YouTube. Por padrão, essas solicitações passam pela OpenRouter (`openrouter.ai`) usando sua chave da OpenRouter, que as encaminha à TypeSafe. Se você informar uma chave da TypeSafe (opcional, em Configurações → Avançado), as solicitações serão enviadas diretamente à TypeSafe (`api.typesafe.ai`). Nada será enviado se você não tiver informado nenhuma das chaves.

- Para cada comentário da página que as regras locais não conseguem avaliar: o texto do comentário (até 600 caracteres), o nome de exibição e o nome de usuário de quem comentou, o texto da publicação à qual ele pertence (até 400 caracteres) e o nome de exibição e o nome de usuário de quem publicou. Até 10 comentários por solicitação.
- Nas páginas de perfil e de busca do X e nas páginas de listas do Reddit, são enviadas as publicações da lista em vez dos comentários, com uma descrição fixa de uma linha no lugar do texto da publicação.
- Nas publicações do X traduzidas automaticamente pelo X: o texto original e a tradução do X (Grok), para avaliar se a tradução é boa o suficiente. A retradução feita pelo ClearFlow não é enviada.
- Somente se você informar uma chave da TypeSafe e ativar "Verificar imagens nas respostas" (desativado por padrão): as imagens anexadas aos comentários são reduzidas e enviadas diretamente à TypeSafe junto com o texto. A OpenRouter não encaminha imagens, então nenhuma imagem é enviada sem uma chave da TypeSafe. Para isso, a extensão solicita permissão para ler imagens de `pbs.twimg.com`, `i.redd.it`, `preview.redd.it` e `*.xhscdn.com`; a permissão é removida quando você desativa a opção.
- Somente se você marcar spam por conta própria nesse site ("Ocultar esta resposta" ou o ícone de funil em uma barra de aviso): as 10 respostas mais recentes que você marcou nesse site (texto de até 240 caracteres e a conta) são enviadas junto com esses comentários como exemplos, para que a TypeSafe identifique se um comentário é do mesmo tipo de spam. Logo após você marcar uma resposta, os comentários da página que não foram limpos são verificados mais uma vez com base nesses exemplos (até 25 por solicitação).
- No YouTube, somente quando você escolhe as legendas traduzidas automaticamente pelo YouTube, ativa "Melhorar legendas traduzidas automaticamente" e o vídeo não tem legendas humanas em chinês para usar: são enviadas as primeiras linhas (até 40) das legendas originais e da tradução do YouTube para avaliar a qualidade da tradução.
- Os resultados são armazenados em cache localmente por até 7 dias para reduzir solicitações repetidas sobre o mesmo comentário no mesmo contexto. Um comentário poderá ser enviado novamente se o cache for limpo, uma entrada for removida ou for necessária uma nova avaliação.

### OpenRouter (`openrouter.ai`) — traduções e avaliações por padrão

As solicitações de tradução só são enviadas se você informar uma chave da OpenRouter e ativar a tradução para aquele site. Sem uma chave da TypeSafe, a OpenRouter também encaminha as solicitações de avaliação descritas acima.

- O texto das publicações e dos comentários que precisam ser traduzidos (ou de uma tradução melhor que a do X). Não são enviados o nome de quem publicou, o ID da publicação nem qualquer outro dado da página.
- No YouTube, somente quando a TypeSafe avalia que as legendas traduzidas automaticamente pelo YouTube são ruins (conforme descrito acima): as legendas originais do trecho do vídeo que você está assistindo, cerca de 40 linhas por vez, para traduzi-las novamente. A conversão de legendas em chinês tradicional para chinês simplificado é feita no seu computador, sem enviar nada.
- A OpenRouter encaminha o texto para o modelo de tradução escolhido por você em Configurações (por padrão, um modelo da OpenAI, com um modelo da DeepSeek como alternativa). Cada um desses provedores tem sua própria política de dados.

### Nenhum outro destinatário

Com sua própria chave, o ClearFlow não envia nada à OhMyAI nem a ninguém além dos dois serviços acima (exceto ao usar a assinatura ClearFlow; consulte a seção abaixo). As estatísticas de uso e de custos permanecem no seu dispositivo. Não há envio de dados para análise ou relatórios de falhas, publicidade nem código de rastreamento. Todo o código está no pacote da extensão; nada é baixado para ser executado depois.

Ao clicar em "Testar conexão" em Configurações, um texto curto e fixo de exemplo é enviado ao serviço que está sendo testado.

## O que é armazenado no seu dispositivo

Os dados a seguir são armazenados no armazenamento da extensão no seu navegador (`chrome.storage.local` e IndexedDB). As chaves de API autenticam as solicitações aos respectivos serviços, e o spam que você marcou pode ser enviado à TypeSafe como exemplo, conforme descrito acima. Os demais dados armazenados não são enviados:

- Suas configurações e chaves de API (da OpenRouter e, se você tiver adicionado uma, da TypeSafe). As chaves são mantidas no banco de dados da própria extensão neste navegador, ao qual os sites que você acessa (e os scripts da extensão executados neles) não têm acesso; somente o processo em segundo plano da extensão as utiliza. Elas não são criptografadas.
- Contadores diários (quantos itens foram limpos ou traduzidos e o custo estimado).
- Suas correções ("não é spam", "ocultar esta resposta") e o spam que você marcou, com o texto do comentário (até 300 caracteres; as últimas 3,000 correções e as últimas 500 respostas marcadas).
- Um cache dos resultados da TypeSafe (somente impressões digitais e pontuações, sem texto; excluído 7 dias após a avaliação do comentário) e um cache de traduções (o texto traduzido; excluído depois de 30 dias sem uso). Por padrão, cada cache tem limite de 50 MB; quando fica cheio, as entradas mais antigas são removidas primeiro.

No X e no YouTube, dois pequenos scripts (`pagedata.js`, `ytdata.js`) são executados dentro da página e leem as respostas da API do próprio site que a página já recebeu — para obter o texto original (sem tradução) de uma publicação e saber quem escreveu um comentário. Eles apenas leem dados; nunca enviam solicitações nem alteram o que o site recebe.

## Suas opções

- Desativar o ClearFlow para qualquer site ou desativar separadamente a limpeza ou a tradução no pop-up ou em Configurações.
- Configurações → Dados e privacidade: exportar seus dados (configurações, estatísticas, correções e spam marcado), limpar os caches ou apagar estatísticas e registros, incluindo suas correções. O spam que você marcou aparece em Configurações, onde você pode excluir entradas uma a uma ou todas de uma vez.
- Ao desinstalar a extensão, tudo o que ela armazenou é excluído.
- Você pode revogar ou trocar suas chaves de API com a TypeSafe ou a OpenRouter a qualquer momento.

## Assinatura ClearFlow (opcional e paga)

A assinatura ClearFlow é uma alternativa ao uso da sua própria chave: você entra com seu e-mail e os recursos de IA do ClearFlow funcionam por meio do nosso servidor. Nossos [Termos de Serviço](https://clearflow.ohmyai.app/pt/terms/) se aplicam à assinatura. Se você usar a assinatura, as condições a seguir se aplicam além do restante desta política.

### Para onde o conteúdo é enviado

A extensão envia ao nosso servidor, `api.clearflow.ohmyai.app` (hospedado na Cloudflare), o mesmo conteúdo descrito em "O que é enviado e para quem", em vez de enviá-lo diretamente à OpenRouter. Nosso servidor o encaminha à OpenRouter e à TypeSafe da mesma forma e devolve os resultados. Imagens não são verificadas no modo de assinatura.

### O que nosso servidor mantém

- **Sua conta:** seu endereço de e-mail, seu fuso horário (para que os limites diários sejam redefinidos à meia-noite no seu horário) e a data de início do período de avaliação gratuita.
- **Seus dispositivos:** um ID aleatório criado pela extensão, o nome do dispositivo (navegador e sistema operacional), a versão da extensão e as datas em que o dispositivo entrou na conta e foi visto pela última vez.
- **Acesso à conta:** os códigos de acesso e os tokens são armazenados apenas como hashes, e os que expiraram são excluídos diariamente.
- **Uso:** para cada dia, quanto da sua franquia você usou e quantas solicitações fez. Os dados são mantidos por 13 meses para aplicar limites e responder a dúvidas sobre cobranças.
- **Pagamentos:** dados recebidos da Waffo, nossa processadora de pagamentos e comerciante oficial: IDs de pedidos e pagamentos, plano, valor e moeda, datas e status de reembolso. Nunca recebemos os dados do seu cartão. A Waffo mantém suas informações de pagamento de acordo com a própria política de privacidade.
- **Cache compartilhado de resultados:** para evitar pagar duas vezes pelo mesmo trabalho, as avaliações são armazenadas em cache por 7 dias e as traduções por 30 dias, usando um hash do conteúdo enviado. As avaliações são armazenadas apenas como pontuações; as traduções, como texto traduzido. As entradas do cache não são vinculadas à sua conta.
- **Métricas das solicitações:** para cada solicitação, qual recurso foi usado, seu plano, o custo, os acertos do cache e o tempo de processamento, junto com o ID da sua conta, para acompanhar custos e erros. Os dados são mantidos por cerca de 3 meses.

Fora o cache, nosso servidor não armazena os comentários, as publicações nem as legendas processados, e não usamos esse conteúdo para treinar modelos.

### E-mails

Os códigos de acesso são enviados pelo serviço de e-mail da Cloudflare. Não enviamos e-mails de marketing.

### Exclusão da conta

Você pode excluir sua conta na página da sua conta. Isso exclui seu endereço de e-mail, dispositivos, sessões de acesso e registros de uso. Mantemos os registros de pagamento sem seu endereço de e-mail, pois são necessários para a contabilidade e os reembolsos, e mantemos o ID do dispositivo que usou um período de avaliação gratuita, para impedir que ele seja usado novamente.

Para impedir avaliações gratuitas repetidas, também mantemos, após a exclusão da conta, um resumo criptográfico do endereço de e-mail gerado com uma chave secreta e a data de início da avaliação. Esse registro de elegibilidade não contém o e-mail em texto simples. Ele é mantido enquanto oferecermos avaliações gratuitas, apenas para verificar se uma avaliação já foi usada.

### Provedores de serviços

Cloudflare (hospedagem, banco de dados e e-mail), Waffo (pagamentos), OpenRouter, TypeSafe e os provedores dos modelos de tradução (processamento de conteúdo).

## Crianças

ClearFlow não é destinado a crianças e não coleta conscientemente informações de ninguém.

## Alterações

Se esta política mudar, a nova versão será publicada em https://github.com/remember2015/clearflow/blob/main/PRIVACY.md com uma nova data de vigência, e a alteração será informada no registro de mudanças.

## Contato

developer@ohmyai.app
