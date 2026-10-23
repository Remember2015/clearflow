# Politique de confidentialité de ClearFlow (清流)

Date d'entrée en vigueur : 23 octobre 2026

ClearFlow est une extension de navigateur qui nettoie les espaces de commentaires et traduit des publications sur X, Reddit, YouTube, Xiaohongshu (RedNote) et Hacker News. Elle est publiée par OhMyAI. Cette politique explique quelles données l'extension lit, ce qu'elle envoie et à qui, ainsi que ce qu'elle conserve sur votre appareil.

**En bref :** ClearFlow envoie les commentaires et publications que vous consultez à OpenRouter, un service que vous choisissez et payez vous-même, à l'aide d'une clé API que vous saisissez. OpenRouter les transmet au modèle Jev de TypeSafe, pour les évaluer, et à un modèle de traduction, pour les traduire. Si vous ajoutez aussi une clé TypeSafe facultative, les demandes d'évaluation sont envoyées directement à TypeSafe. Elle ne nous envoie rien, à nous les développeurs. Elle ne transmet aucune statistique d'utilisation, ne suit pas votre navigation et n'exécute aucun code distant. Les autres données enregistrées restent dans votre navigateur.

## Sites concernés

Les scripts de l'extension ne s'exécutent que sur les sites suivants : `x.com`, `twitter.com`, `www.reddit.com`, `www.youtube.com`, `www.xiaohongshu.com`, `www.rednote.com` et `news.ycombinator.com`. L'extension ne lit ni votre historique de navigation ni aucun autre site. Sur ces sites, elle lit uniquement votre propre nom d'utilisateur, en local, pour éviter d'évaluer vos propres publications ; elle ne l'envoie jamais ailleurs.

## Données envoyées et destinataires

### Modèle Jev de TypeSafe — évaluation des commentaires

TypeSafe sert au nettoyage des commentaires (spam, insultes, contenu sexuel et réponses comme « sympa » ou « +1 ») et à l'évaluation de la qualité des traductions fournies par X ainsi que des sous-titres traduits automatiquement par YouTube. Par défaut, ces demandes passent par OpenRouter (`openrouter.ai`), à l'aide de votre clé OpenRouter, qui les transmet à TypeSafe. Si vous avez saisi une clé TypeSafe (facultative, dans Paramètres → Avancé), elles sont envoyées directement à TypeSafe (`api.typesafe.ai`). Aucune donnée n'est envoyée si vous n'avez saisi ni l'une ni l'autre de ces clés.

- Pour chaque commentaire affiché que les règles locales ne peuvent pas classer : le texte du commentaire (600 caractères maximum), le nom affiché et l'identifiant de son auteur, le texte de la publication à laquelle il répond (400 caractères maximum), ainsi que le nom affiché et l'identifiant de l'auteur de cette publication. Dix commentaires au maximum sont envoyés par requête.
- Sur les pages de profil et de recherche de X et les pages de listes de Reddit, les publications de la liste sont envoyées à la place des commentaires, avec une description fixe d'une ligne à la place du texte de la publication.
- Pour les publications traduites automatiquement par X : le texte original et la traduction de X (Grok), afin de juger si celle-ci est suffisamment bonne. La retraduction produite par ClearFlow n'est pas envoyée.
- Uniquement si vous avez saisi une clé TypeSafe et activez « Vérifier les images des réponses » (désactivé par défaut) : les images jointes à ces commentaires, réduites, sont envoyées directement à TypeSafe avec le texte (OpenRouter ne transmet pas les images ; aucune image n'est donc envoyée sans clé TypeSafe). Pour cela, l'extension demande l'autorisation de lire les images provenant de `pbs.twimg.com`, `i.redd.it`, `preview.redd.it` et `*.xhscdn.com`. Elle retire cette autorisation lorsque vous désactivez l'option.
- Uniquement si vous avez vous-même marqué des spams sur ce site (« Masquer cette réponse » ou l'icône d'entonnoir dans une barre d'avis) : vos dix réponses marquées les plus récentes sur ce site (texte limité à 240 caractères et compte associé) sont envoyées avec ces commentaires comme exemples, afin que TypeSafe puisse reconnaître le même type de spam. Juste après un nouveau marquage, les commentaires de la page qui n'ont pas été nettoyés sont réévalués une fois à l'aide de ces exemples (25 commentaires au maximum par requête).
- Sur YouTube, uniquement si vous choisissez les sous-titres traduits automatiquement par YouTube et activez « Améliorer les sous-titres traduits automatiquement », et si la vidéo ne propose pas de sous-titres en chinois rédigés par une personne pouvant être utilisés à la place : les premières lignes des sous-titres originaux (40 au maximum) et leur traduction par YouTube sont envoyées pour évaluer la qualité de cette traduction.
- Les résultats sont mis en cache localement pendant sept jours au maximum pour éviter de renvoyer le même commentaire dans le même contexte. Un commentaire peut être renvoyé si le cache est vidé, si une entrée est supprimée ou si une nouvelle évaluation est nécessaire.

### OpenRouter (`openrouter.ai`) — traduction et évaluation par défaut

Les demandes de traduction ne sont envoyées que si vous avez saisi une clé OpenRouter et activé la traduction pour le site concerné. Sans clé TypeSafe, OpenRouter transmet également les demandes d'évaluation décrites ci-dessus.

- Le texte des publications et commentaires à traduire, ou pour lesquels une meilleure traduction que celle de X est nécessaire. Ni l'auteur, ni l'identifiant de la publication, ni aucun autre élément de la page ne sont envoyés.
- Sur YouTube, uniquement si TypeSafe a jugé insuffisante la traduction automatique des sous-titres par YouTube, comme décrit ci-dessus : les sous-titres originaux de la partie de la vidéo que vous regardez, environ 40 lignes à la fois, sont envoyés pour être retraduits. La conversion des sous-titres du chinois traditionnel vers le chinois simplifié se fait sur votre ordinateur, sans aucun envoi.
- OpenRouter transmet le texte au modèle de traduction choisi dans les paramètres : par défaut un modèle OpenAI, avec un modèle DeepSeek en secours. Chacun de ces fournisseurs applique sa propre politique de traitement des données.

### Aucun autre destinataire

ClearFlow n'envoie rien à OhMyAI ni à quiconque en dehors des deux services indiqués ci-dessus. Les statistiques d'utilisation et de coût restent sur votre appareil. L'extension ne contient aucun système de remontée de statistiques ou de rapports de plantage, ni publicité ou code de suivi. Tout son code se trouve dans le paquet de l'extension ; aucun code n'est téléchargé puis exécuté ultérieurement.

Lorsque vous cliquez sur « Tester la connexion » dans les paramètres, un court texte d'exemple fixe est envoyé au service testé.

## Données conservées sur votre appareil

Les données suivantes sont conservées dans l'espace de stockage de l'extension dans votre navigateur (`chrome.storage.local` et IndexedDB). Les clés API servent à authentifier les requêtes auprès des services concernés ; les spams que vous avez marqués peuvent être envoyés à TypeSafe comme exemples, selon les conditions décrites ci-dessus. Les autres données enregistrées ne sont pas transmises :

- Vos paramètres et vos clés API (celle d'OpenRouter et, si vous en avez ajouté une, celle de TypeSafe). Les clés sont conservées dans la base de données propre à l'extension, dans ce navigateur. Les sites que vous visitez, ainsi que les scripts de l'extension qui s'exécutent sur ces sites, ne peuvent pas les lire ; seul le processus d'arrière-plan de l'extension les utilise. Elles ne sont pas chiffrées.
- Les compteurs quotidiens (nombre d'éléments nettoyés ou traduits et coût estimé).
- Vos corrections (« ce n'est pas du spam », « masquer cette réponse ») et les spams que vous avez marqués, avec le texte du commentaire (300 caractères maximum ; les 3 000 dernières corrections et les 500 dernières réponses marquées).
- Un cache des résultats de TypeSafe (empreintes et scores seulement, sans texte ; suppression sept jours après l'évaluation du commentaire) et un cache des traductions (texte traduit ; suppression après 30 jours sans utilisation). Chaque cache est limité par défaut à 50 Mo ; lorsqu'il est plein, les entrées les plus anciennes sont supprimées en premier.

Sur X et YouTube, deux petits scripts (`pagedata.js` et `ytdata.js`) s'exécutent dans la page et lisent les réponses des API du site que la page a déjà reçues, afin d'obtenir le texte original, non traduit, d'une publication et l'auteur d'un commentaire. Ils se contentent de lire ces réponses : ils n'envoient aucune requête et ne modifient pas ce que le site reçoit.

## Vos choix

- Dans la fenêtre de l'extension ou les paramètres, désactivez ClearFlow pour n'importe quel site, ou désactivez séparément le nettoyage ou la traduction.
- Dans Paramètres → Données et confidentialité, exportez vos données (paramètres, statistiques, corrections et spams marqués), videz les caches ou supprimez les statistiques et les enregistrements, y compris vos corrections. La liste des spams que vous avez marqués figure dans les paramètres ; vous pouvez supprimer ses entrées une par une ou toutes à la fois.
- La désinstallation de l'extension supprime tout ce qu'elle a enregistré.
- Vous pouvez révoquer ou renouveler vos clés API auprès de TypeSafe ou d'OpenRouter à tout moment.

## Enfants

ClearFlow ne s'adresse pas aux enfants et ne collecte sciemment aucune information auprès de quiconque.

## Modifications

Si cette politique change, sa nouvelle version sera publiée sur https://github.com/remember2015/clearflow/blob/main/PRIVACY.md avec une nouvelle date d'entrée en vigueur, et la modification sera signalée dans le journal des versions.

## Contact

developer@ohmyai.app
