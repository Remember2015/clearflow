# Politique de confidentialité de ClearFlow (清流)

Date d’entrée en vigueur : 26 octobre 2026

ClearFlow est une extension de navigateur qui nettoie les sections de commentaires et traduit les publications sur X, Reddit, YouTube, Xiaohongshu (RedNote) et Hacker News. Elle est publiée par OhMyAI. Cette politique explique ce que l’extension lit, ce qu’elle envoie et à qui, ainsi que les données qu’elle conserve sur votre appareil.

**En bref :** ClearFlow envoie les commentaires et les publications que vous consultez à OpenRouter, un service que vous choisissez et payez, à l’aide d’une clé API que vous saisissez vous-même. OpenRouter les transmet au modèle Jev de TypeSafe (pour les évaluer) et à un modèle de traduction (pour les traduire). Si vous ajoutez également une clé TypeSafe facultative, les demandes d’évaluation sont envoyées directement à TypeSafe. Dans ce mode, rien ne nous est envoyé, à nous, les développeurs. Si vous choisissez plutôt l’abonnement ClearFlow (facultatif et payant, voir la section correspondante ci-dessous), le même contenu transite par notre serveur, qui ne conserve que les données indiquées dans cette section. L’extension n’envoie pas de statistiques d’utilisation, ne suit pas votre navigation et n’exécute aucun code à distance. Les autres données stockées restent dans votre navigateur.

## Où l’extension fonctionne

Les scripts de l’extension s’exécutent uniquement sur les sites suivants : `x.com`, `twitter.com`, `www.reddit.com`, `www.youtube.com`, `www.xiaohongshu.com`, `www.rednote.com` et `news.ycombinator.com`. Elle ne lit ni votre historique de navigation ni aucun autre site web. Sur ces sites, elle lit uniquement votre nom d’utilisateur, localement, afin de ne pas évaluer vos propres publications ; elle ne l’envoie jamais à qui que ce soit.

## Données envoyées et destinataires

### Modèle Jev de TypeSafe — évaluation des commentaires

Utilisé pour le nettoyage (spam, abus, contenu sexuel et réponses comme « sympa » ou « +1 »), ainsi que pour évaluer la qualité des traductions de X et des sous-titres traduits automatiquement par YouTube. Par défaut, ces demandes passent par OpenRouter (`openrouter.ai`) avec votre clé OpenRouter, qui les transmet à TypeSafe. Si vous avez saisi une clé TypeSafe (facultatif, dans Paramètres → Avancé), les demandes sont envoyées directement à TypeSafe (`api.typesafe.ai`). Aucune donnée n’est envoyée si vous n’avez saisi aucune de ces deux clés.

- Pour chaque commentaire de la page que les règles locales ne permettent pas de traiter : le texte du commentaire (jusqu’à 600 caractères), le nom affiché et le pseudo de son auteur, le texte de la publication à laquelle il répond (jusqu’à 400 caractères), ainsi que le nom et le pseudo de l’auteur de la publication. Jusqu’à 10 commentaires par demande.
- Sur les pages de profil et de recherche de X, ainsi que sur les pages de listes de Reddit, les publications de la liste sont envoyées à la place des commentaires, avec une description fixe d’une ligne à la place du texte de la publication.
- Pour les publications X traduites automatiquement par X : le texte d’origine et sa traduction par X (Grok), afin d’évaluer la qualité de cette traduction. La nouvelle traduction de ClearFlow n’est pas envoyée.
- Uniquement si vous avez saisi une clé TypeSafe et activé « Vérifier les images dans les réponses » (désactivé par défaut) : les images jointes à ces commentaires, réduites en taille et accompagnées du texte, sont envoyées directement à TypeSafe. OpenRouter ne transmet pas les images ; aucune image n’est donc envoyée sans clé TypeSafe. Pour cela, l’extension demande l’autorisation de lire les images provenant de `pbs.twimg.com`, `i.redd.it`, `preview.redd.it` et `*.xhscdn.com` ; elle la retire lorsque vous désactivez l’option.
- Uniquement si vous avez vous-même signalé du spam sur ce site (« Masquer cette réponse » ou l’icône d’entonnoir dans une barre d’avis) : vos 10 réponses signalées les plus récemment sur ce site (texte de 240 caractères maximum et compte concerné) sont envoyées avec les commentaires à titre d’exemples, afin que TypeSafe puisse déterminer si un commentaire relève du même type de spam. Juste après le signalement, les commentaires de la page qui n’ont pas été nettoyés sont vérifiés une nouvelle fois à partir de ces exemples (jusqu’à 25 par demande).
- Sur YouTube, uniquement si vous choisissez les sous-titres traduits automatiquement par YouTube et que l’option « Améliorer les sous-titres traduits automatiquement » est activée (et que la vidéo ne comporte pas de sous-titres chinois rédigés par un humain pouvant être utilisés à la place) : les premières lignes des sous-titres d’origine et de leur traduction par YouTube (jusqu’à 40), afin d’évaluer la qualité de la traduction de YouTube.
- Les résultats sont mis en cache localement pendant 7 jours maximum afin de limiter les demandes répétées pour un même commentaire dans un même contexte. Un commentaire peut être envoyé de nouveau si le cache est vidé, si une entrée est supprimée ou si une nouvelle évaluation est nécessaire.

### OpenRouter (`openrouter.ai`) — traduction et évaluation par défaut

Les demandes de traduction sont envoyées uniquement si vous avez saisi une clé OpenRouter et activé la traduction pour ce site. Sans clé TypeSafe, OpenRouter transmet également les demandes d’évaluation décrites ci-dessus.

- Le texte des publications et des commentaires à traduire (ou à retraduire pour obtenir une meilleure traduction que celle de X). Ni l’auteur, ni l’identifiant de la publication, ni aucune autre donnée de la page.
- Sur YouTube, uniquement lorsque TypeSafe a jugé de mauvaise qualité les sous-titres traduits automatiquement par YouTube (voir ci-dessus) : les sous-titres d’origine de la partie de la vidéo que vous regardez, par lots d’environ 40 lignes, pour les retraduire. La conversion des sous-titres en chinois traditionnel vers le chinois simplifié s’effectue sur votre ordinateur et n’envoie aucune donnée.
- OpenRouter transmet le texte au modèle de traduction que vous avez choisi dans Paramètres (par défaut, un modèle OpenAI, avec un modèle DeepSeek en secours). Chacun de ces fournisseurs applique sa propre politique de confidentialité.

### Aucun autre destinataire

Avec votre propre clé, ClearFlow n’envoie rien à OhMyAI ni à aucun autre service que les deux mentionnés ci-dessus (sauf avec l’abonnement ClearFlow, voir ci-dessous). Les statistiques d’utilisation et de coût restent sur votre appareil. Il n’y a ni transmission de données analytiques, ni signalement de plantages, ni publicité, ni code de suivi. Tout le code est inclus dans l’extension ; aucun code n’est téléchargé puis exécuté ultérieurement.

Lorsque vous cliquez sur « Tester la connexion » dans Paramètres, un court texte fixe est envoyé au service testé.

## Données stockées sur votre appareil

Les données suivantes sont stockées dans l’espace de stockage de l’extension de votre navigateur (`chrome.storage.local` et IndexedDB). Les clés API authentifient les demandes auprès des services concernés, et les spams signalés peuvent être envoyés à TypeSafe à titre d’exemples, comme décrit ci-dessus. Les autres données stockées ne sont pas téléversées :

- Vos paramètres et vos clés API (celle d’OpenRouter et, si vous en avez ajouté une, celle de TypeSafe). Les clés sont conservées dans la base de données propre à l’extension, dans ce navigateur. Les sites que vous visitez et les scripts de l’extension qui s’y exécutent ne peuvent pas y accéder ; seul le processus d’arrière-plan de l’extension les utilise. Elles ne sont pas chiffrées.
- Des compteurs quotidiens (nombre d’éléments nettoyés ou traduits, coût estimé).
- Vos corrections (« pas du spam », « masquer cette réponse ») et les spams que vous avez signalés, avec le texte du commentaire (jusqu’à 300 caractères ; les 3 000 dernières corrections et les 500 dernières réponses signalées).
- Un cache des résultats de TypeSafe (empreintes et scores uniquement, sans texte ; supprimé 7 jours après l’évaluation du commentaire) et un cache des traductions (texte traduit ; supprimé après 30 jours sans utilisation). Chaque cache est limité à 50 MB par défaut ; lorsqu’il est plein, les entrées les plus anciennes sont supprimées en premier.

Sur X et YouTube, deux petits scripts (`pagedata.js`, `ytdata.js`) s’exécutent dans la page et lisent les réponses de l’API du site que la page a déjà reçues, afin d’obtenir le texte original (non traduit) d’une publication et l’auteur d’un commentaire. Ils se contentent de lire ces données ; ils n’envoient jamais de demande et ne modifient pas les données reçues par le site.

## Vos choix

- Désactiver ClearFlow pour un site, ou désactiver séparément le nettoyage ou la traduction, dans la fenêtre contextuelle ou dans Paramètres.
- Paramètres → Données et confidentialité : exporter vos données (paramètres, statistiques, corrections et spams signalés), vider les caches ou effacer les statistiques et les données enregistrées, y compris vos corrections. La liste des spams signalés se trouve dans Paramètres ; vous pouvez supprimer les entrées une par une ou toutes à la fois.
- La désinstallation de l’extension supprime tout ce qu’elle a stocké.
- Vous pouvez révoquer ou renouveler vos clés API auprès de TypeSafe ou d’OpenRouter à tout moment.

## Abonnement ClearFlow (facultatif et payant)

L’abonnement ClearFlow permet d’utiliser ClearFlow sans votre propre clé : connectez-vous avec votre adresse e-mail et les fonctionnalités d’IA de ClearFlow passent par notre serveur. Nos [Conditions d’utilisation](https://clearflow.ohmyai.app/fr/terms/) s’appliquent à l’abonnement. Si vous l’utilisez, les modalités suivantes s’ajoutent au reste de cette politique.

### Destination du contenu

L’extension envoie à notre serveur, `api.clearflow.ohmyai.app` (hébergé sur Cloudflare), le même contenu que celui décrit dans « Données envoyées et destinataires », au lieu de l’envoyer directement à OpenRouter. Notre serveur le transmet ensuite à OpenRouter et TypeSafe de la même manière, puis vous renvoie les résultats. Les images ne sont pas vérifiées avec l’abonnement.

### Données conservées par notre serveur

- **Votre compte :** votre adresse e-mail, votre fuseau horaire (pour que les limites quotidiennes soient réinitialisées à minuit chez vous) et la date de début de votre période d’essai gratuite.
- **Vos appareils :** un identifiant aléatoire créé par l’extension, le nom de l’appareil (navigateur et système d’exploitation), la version de l’extension, ainsi que les dates de connexion et de dernière activité de l’appareil.
- **Connexion :** les codes et jetons de connexion ne sont conservés que sous forme d’empreintes ; les éléments expirés sont supprimés chaque jour.
- **Utilisation :** pour chaque jour, la part de votre forfait utilisée et le nombre de demandes effectuées. Ces données sont conservées pendant 13 months pour gérer les limites et répondre aux questions sur la facturation.
- **Paiements :** les données transmises par Waffo, notre prestataire de paiement et marchand officiel : identifiants de commande et de paiement, forfait, montant et devise, dates et statut du remboursement. Nous ne recevons jamais les données de votre carte. Waffo conserve vos informations de paiement selon sa propre politique de confidentialité.
- **Cache de résultats partagé :** pour éviter de payer deux fois le même traitement, les évaluations sont mises en cache pendant 7 jours et les traductions pendant 30 jours, à partir d’une empreinte des données d’entrée. Les évaluations sont conservées sous forme de scores uniquement ; les traductions, sous forme de texte traduit. Les entrées du cache ne sont pas liées à votre compte.
- **Mesures des demandes :** pour chaque demande, la fonctionnalité utilisée, votre forfait, son coût, les résultats du cache et le temps de traitement, associés à l’identifiant de votre compte, afin de surveiller les coûts et les erreurs. Ces données sont conservées pendant environ 3 mois.

À l’exception du cache, notre serveur ne conserve pas les commentaires, les publications ou les sous-titres qu’il traite, et nous ne les utilisons pas pour entraîner des modèles.

### E-mails

Les codes de connexion sont envoyés avec le service de messagerie de Cloudflare. Nous n’envoyons pas d’e-mails publicitaires.

### Suppression de votre compte

Vous pouvez supprimer votre compte depuis la page de votre compte. Cela supprime votre adresse e-mail, vos appareils, vos sessions de connexion et vos données d’utilisation. Nous conservons les données de paiement sans votre adresse e-mail, car elles sont nécessaires à la comptabilité et aux remboursements, ainsi que l’identifiant de l’appareil ayant utilisé une période d’essai gratuite, afin d’empêcher qu’elle soit utilisée une nouvelle fois.

### Prestataires de services

Cloudflare (hébergement, base de données et messagerie), Waffo (paiements), OpenRouter, TypeSafe et les fournisseurs des modèles de traduction (traitement du contenu).

## Enfants

ClearFlow ne s’adresse pas aux enfants et ne collecte sciemment aucune information auprès d’eux.

## Modifications

En cas de modification de cette politique, la nouvelle version sera publiée à l’adresse https://github.com/remember2015/clearflow/blob/main/PRIVACY.md avec une nouvelle date d’entrée en vigueur, et le changement sera indiqué dans le journal des modifications.

## Contact

developer@ohmyai.app
