# Capstone One — Ships API

Architecture serverless AWS : **API Gateway → DynamoDB / S3**

## Ce qui a été fait

### Bucket S3 (`src/create-bucket.ts`)

Le bucket est automatiquement créé et configuré via un script dédié (après avoir défini son nom dans create-bucket.ts & deploy-project.ts) qui :
- Crée le bucket en `eu-west-1`
- Configure CORS (GET, HEAD, PUT, POST depuis `*`)
- Ouvre l'accès public en lecture (`s3:GetObject` pour tous)
- Upload les images `fisher.jpg` et `tanker.jpg` depuis `assets/`

### Table DynamoDB

Table `ENM-VerifMaritime` avec `id` (String) comme clé de partition, en mode `PAY_PER_REQUEST`. Les données (`data/ships.json`) sont insérées au déploiement.

### API Gateway

Trois endpoints REST exposés sur le stage `dev` :

| Méthode | Endpoint | Backend |
|--------|----------|---------|
| GET | `/ships` | DynamoDB Scan |
| GET | `/ships/profile/{key}` | DynamoDB GetItem |
| GET | `/ships/photo/{key}` | S3 GetObject |

- Les endpoints DynamoDB utilisent le rôle `APIGatewayDynamoDBServiceRole`
- L'endpoint S3 utilise le rôle `APIGatewayS3ServiceRole`
- CORS activé (méthode OPTIONS + headers `Access-Control-Allow-*`) sur toutes les ressources
- Les images sont retournées en binaire (`CONVERT_TO_BINARY`)
- Chaque requête nécessite une **API Key** associée à un usage plan (100 rps, 10 000 req/mois)

---

## Utilisation

### 1. Créer le bucket S3

```bash
npm run create-bucket
```

Crée le bucket, configure CORS + accès public, et upload les images.

### 2. Déployer

```bash
npm run deploy
```

Ce script :
1. Vérifie si la table DynamoDB existe déjà (skip si oui)
2. Insère les bateaux depuis `data/ships.json`
3. Crée l'API Gateway avec tous les endpoints et le CORS
4. Déploie sur le stage `dev`
5. Crée une API Key + usage plan et affiche les infos de connexion

### 3. Tester

Ouvrir `checker/index.html` avec Live Server, coller l'URL et la clé API affichées après le déploiement.

### 4. Détruire

```bash
npm run destroy
```

Supprime l'API Gateway (par nom `ships-api-capstone`) et la table DynamoDB `ENM-VerifMaritime`.

> Le bucket S3 est à supprimer manuellement depuis la console ou la CLI.

---

## Prérequis

- Session AWS SSO active avec le profil `aws-labs` (région `eu-west-1`)
- Node.js + `npm install`
- Rôles IAM `APIGatewayDynamoDBServiceRole` et `APIGatewayS3ServiceRole` existants
