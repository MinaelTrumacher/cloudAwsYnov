import {
  APIGatewayClient,
  CreateRestApiCommand,
  GetResourcesCommand,
  CreateResourceCommand,
  PutMethodCommand,
  PutIntegrationCommand,
  PutMethodResponseCommand,
  PutIntegrationResponseCommand,
  CreateDeploymentCommand,
  CreateApiKeyCommand,
  CreateUsagePlanCommand,
  CreateUsagePlanKeyCommand,
} from '@aws-sdk/client-api-gateway';
import { IAMClient, GetRoleCommand } from '@aws-sdk/client-iam';

// Configuration
const region = 'eu-west-1';
const apiGatewayClient = new APIGatewayClient({ region });
const iamClient = new IAMClient({ region });

// Nom des ressources
const API_NAME = 'ships-api-capstone';
const STAGE_NAME = 'dev';
const BUCKET_NAME = 'emile-nathan-minh-ec2-instance'; // Nom du bucket S3
const TABLE_NAME = `ENM-VerifMaritime`; // Nom de la table DynamoDB (à adapter)

/**
 * Récupère l'ARN d'un rôle IAM
 */
async function getRoleArn(roleName: string): Promise<string> {
  try {
    const command = new GetRoleCommand({ RoleName: roleName });
    const response = await iamClient.send(command);
    return response.Role!.Arn!;
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération du rôle ${roleName}:`, error);
    throw error;
  }
}

/**
 * Crée l'API REST Gateway
 */
async function createRestApi(): Promise<string> {
  console.log('\n📡 Création de l\'API REST Gateway...');

  const command = new CreateRestApiCommand({
    name: API_NAME,
    description: 'API Gateway pour le projet Capstone - Ships',
    endpointConfiguration: {
      types: ['REGIONAL'],
    },
  });

  const response = await apiGatewayClient.send(command);
  console.log(`✅ API créée avec l'ID: ${response.id}`);

  return response.id!;
}

/**
 * Récupère la ressource racine de l'API
 */
async function getRootResource(apiId: string): Promise<string> {
  const command = new GetResourcesCommand({ restApiId: apiId });
  const response = await apiGatewayClient.send(command);

  const rootResource = response.items?.find((item) => item.path === '/');
  if (!rootResource) {
    throw new Error('Ressource racine non trouvée');
  }

  return rootResource.id!;
}

/**
 * Crée une ressource dans l'API Gateway
 */
async function createResource(
  apiId: string,
  parentId: string,
  pathPart: string
): Promise<string> {
  console.log(`  📁 Création de la ressource: ${pathPart}`);

  const command = new CreateResourceCommand({
    restApiId: apiId,
    parentId: parentId,
    pathPart: pathPart,
  });

  const response = await apiGatewayClient.send(command);
  console.log(`  ✅ Ressource créée: ${response.path}`);

  return response.id!;
}

/**
 * Configure CORS pour une ressource
 */
async function enableCors(apiId: string, resourceId: string): Promise<void> {
  // Méthode OPTIONS pour CORS
  const methodCommand = new PutMethodCommand({
    restApiId: apiId,
    resourceId: resourceId,
    httpMethod: 'OPTIONS',
    authorizationType: 'NONE',
  });
  await apiGatewayClient.send(methodCommand);

  // Intégration MOCK pour OPTIONS
  const integrationCommand = new PutIntegrationCommand({
    restApiId: apiId,
    resourceId: resourceId,
    httpMethod: 'OPTIONS',
    type: 'MOCK',
    requestTemplates: {
      'application/json': '{"statusCode": 200}',
    },
  });
  await apiGatewayClient.send(integrationCommand);

  // Method Response
  const methodResponseCommand = new PutMethodResponseCommand({
    restApiId: apiId,
    resourceId: resourceId,
    httpMethod: 'OPTIONS',
    statusCode: '200',
    responseParameters: {
      'method.response.header.Access-Control-Allow-Headers': true,
      'method.response.header.Access-Control-Allow-Methods': true,
      'method.response.header.Access-Control-Allow-Origin': true,
    },
  });
  await apiGatewayClient.send(methodResponseCommand);

  // Integration Response
  const integrationResponseCommand = new PutIntegrationResponseCommand({
    restApiId: apiId,
    resourceId: resourceId,
    httpMethod: 'OPTIONS',
    statusCode: '200',
    responseParameters: {
      'method.response.header.Access-Control-Allow-Headers':
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
      'method.response.header.Access-Control-Allow-Origin': "'*'",
    },
  });
  await apiGatewayClient.send(integrationResponseCommand);
}

/**
 * Crée une méthode GET avec intégration DynamoDB pour lister tous les bateaux
 */
async function createGetShipsMethod(
  apiId: string,
  resourceId: string,
  roleArn: string
): Promise<void> {
  console.log('  🔧 Configuration GET /ships (DynamoDB Scan)');

  // Créer la méthode GET
  const methodCommand = new PutMethodCommand({
    restApiId: apiId,
    resourceId: resourceId,
    httpMethod: 'GET',
    authorizationType: 'NONE',
    apiKeyRequired: true,
  });
  await apiGatewayClient.send(methodCommand);

  // Intégration avec DynamoDB (Scan)
  const integrationCommand = new PutIntegrationCommand({
    restApiId: apiId,
    resourceId: resourceId,
    httpMethod: 'GET',
    type: 'AWS',
    integrationHttpMethod: 'POST',
    uri: `arn:aws:apigateway:${region}:dynamodb:action/Scan`,
    credentials: roleArn,
    requestTemplates: {
      'application/json': `{
        "TableName": "${TABLE_NAME}"
      }`,
    },
  });
  await apiGatewayClient.send(integrationCommand);

  // Method Response 200
  const methodResponseCommand = new PutMethodResponseCommand({
    restApiId: apiId,
    resourceId: resourceId,
    httpMethod: 'GET',
    statusCode: '200',
    responseParameters: {
      'method.response.header.Access-Control-Allow-Origin': true,
    },
    responseModels: {
      'application/json': 'Empty',
    },
  });
  await apiGatewayClient.send(methodResponseCommand);

  // Integration Response - Transformation pour formatter la réponse
  const integrationResponseCommand = new PutIntegrationResponseCommand({
    restApiId: apiId,
    resourceId: resourceId,
    httpMethod: 'GET',
    statusCode: '200',
    responseParameters: {
      'method.response.header.Access-Control-Allow-Origin': "'*'",
    },
    responseTemplates: {
      'application/json': `#set($inputRoot = $input.path('$'))
{
  "ships": [
    #foreach($item in $inputRoot.Items)
    {
      "id": "$item.id.S",
      "nom": "$item.nom.S",
      "type": "$item.type.S",
      "pavillon": "$item.pavillon.S",
      "taille": "$item.taille.N",
      "nombre_marins": "$item.nombre_marins.N",
      "s3_image_key": "$item.s3_image_key.S"
    }#if($foreach.hasNext),#end
    #end
  ]
}`,
    },
  });
  await apiGatewayClient.send(integrationResponseCommand);

  console.log('  ✅ Méthode GET /ships configurée');
}

/**
 * Crée une méthode GET avec intégration DynamoDB pour récupérer un bateau
 */
async function createGetShipProfileMethod(
  apiId: string,
  resourceId: string,
  roleArn: string
): Promise<void> {
  console.log('  🔧 Configuration GET /ships/profile/{key} (DynamoDB GetItem)');

  // Créer la méthode GET
  const methodCommand = new PutMethodCommand({
    restApiId: apiId,
    resourceId: resourceId,
    httpMethod: 'GET',
    authorizationType: 'NONE',
    apiKeyRequired: true,
    requestParameters: {
      'method.request.path.key': true,
    },
  });
  await apiGatewayClient.send(methodCommand);

  // Intégration avec DynamoDB (GetItem)
  const integrationCommand = new PutIntegrationCommand({
    restApiId: apiId,
    resourceId: resourceId,
    httpMethod: 'GET',
    type: 'AWS',
    integrationHttpMethod: 'POST',
    uri: `arn:aws:apigateway:${region}:dynamodb:action/GetItem`,
    credentials: roleArn,
    requestParameters: {
      'integration.request.path.key': 'method.request.path.key',
    },
    requestTemplates: {
      'application/json': `{
        "TableName": "${TABLE_NAME}",
        "Key": {
          "id": {
            "S": "$input.params('key')"
          }
        }
      }`,
    },
  });
  await apiGatewayClient.send(integrationCommand);

  // Method Response 200
  const methodResponseCommand = new PutMethodResponseCommand({
    restApiId: apiId,
    resourceId: resourceId,
    httpMethod: 'GET',
    statusCode: '200',
    responseParameters: {
      'method.response.header.Access-Control-Allow-Origin': true,
    },
  });
  await apiGatewayClient.send(methodResponseCommand);

  // Integration Response - Transformation
  const integrationResponseCommand = new PutIntegrationResponseCommand({
    restApiId: apiId,
    resourceId: resourceId,
    httpMethod: 'GET',
    statusCode: '200',
    responseParameters: {
      'method.response.header.Access-Control-Allow-Origin': "'*'",
    },
    responseTemplates: {
      'application/json': `#set($item = $input.path('$.Item'))
{
  "id": "$item.id.S",
  "nom": "$item.nom.S",
  "type": "$item.type.S",
  "pavillon": "$item.pavillon.S",
  "taille": "$item.taille.N",
  "nombre_marins": "$item.nombre_marins.N",
  "s3_image_key": "$item.s3_image_key.S"
}`,
    },
  });
  await apiGatewayClient.send(integrationResponseCommand);

  console.log('  ✅ Méthode GET /ships/profile/{key} configurée');
}

/**
 * Crée une méthode GET avec intégration S3 pour récupérer une photo
 */
async function createGetShipPhotoMethod(
  apiId: string,
  resourceId: string,
  roleArn: string
): Promise<void> {
  console.log('  🔧 Configuration GET /ships/photo/{key} (S3 GetObject)');

  // Créer la méthode GET
  const methodCommand = new PutMethodCommand({
    restApiId: apiId,
    resourceId: resourceId,
    httpMethod: 'GET',
    authorizationType: 'NONE',
    apiKeyRequired: true,
    requestParameters: {
      'method.request.path.key': true,
    },
  });
  await apiGatewayClient.send(methodCommand);

  // Intégration avec S3
  const integrationCommand = new PutIntegrationCommand({
    restApiId: apiId,
    resourceId: resourceId,
    httpMethod: 'GET',
    type: 'AWS',
    integrationHttpMethod: 'GET',
    uri: `arn:aws:apigateway:${region}:s3:path/${BUCKET_NAME}/{key}`,
    credentials: roleArn,
    requestParameters: {
      'integration.request.path.key': 'method.request.path.key',
    },
  });
  await apiGatewayClient.send(integrationCommand);

  // Method Response 200
  const methodResponseCommand = new PutMethodResponseCommand({
    restApiId: apiId,
    resourceId: resourceId,
    httpMethod: 'GET',
    statusCode: '200',
    responseParameters: {
      'method.response.header.Content-Type': true,
      'method.response.header.Access-Control-Allow-Origin': true,
    },
  });
  await apiGatewayClient.send(methodResponseCommand);

  // Integration Response
  const integrationResponseCommand = new PutIntegrationResponseCommand({
    restApiId: apiId,
    resourceId: resourceId,
    httpMethod: 'GET',
    statusCode: '200',
    responseParameters: {
      'method.response.header.Content-Type': 'integration.response.header.Content-Type',
      'method.response.header.Access-Control-Allow-Origin': "'*'",
    },
  });
  await apiGatewayClient.send(integrationResponseCommand);

  console.log('  ✅ Méthode GET /ships/photo/{key} configurée');
}

/**
 * Crée une clé API
 */
async function createApiKey(apiName: string): Promise<{ id: string; value: string }> {
  console.log('\n🔑 Création de la clé API...');

  const command = new CreateApiKeyCommand({
    name: `${apiName}-key`,
    description: 'API Key pour l\'API Ships Capstone',
    enabled: true,
  });

  const response = await apiGatewayClient.send(command);
  console.log(`✅ Clé API créée: ${response.name}`);

  return {
    id: response.id!,
    value: response.value!,
  };
}

/**
 * Crée un plan d'utilisation
 */
async function createUsagePlan(
  apiId: string,
  stageName: string,
  apiName: string
): Promise<string> {
  console.log('\n📊 Création du plan d\'utilisation...');

  const command = new CreateUsagePlanCommand({
    name: `${apiName}-usage-plan`,
    description: 'Usage plan pour l\'API Ships Capstone',
    apiStages: [
      {
        apiId: apiId,
        stage: stageName,
      },
    ],
    throttle: {
      rateLimit: 100, // 100 requêtes par seconde
      burstLimit: 200, // 200 requêtes en burst
    },
    quota: {
      limit: 10000, // 10000 requêtes
      period: 'MONTH',
    },
  });

  const response = await apiGatewayClient.send(command);
  console.log(`✅ Plan d'utilisation créé: ${response.name}`);

  return response.id!;
}

/**
 * Associe une clé API à un plan d'utilisation
 */
async function associateApiKeyToUsagePlan(
  usagePlanId: string,
  apiKeyId: string
): Promise<void> {
  console.log('\n🔗 Association de la clé API au plan d\'utilisation...');

  const command = new CreateUsagePlanKeyCommand({
    usagePlanId: usagePlanId,
    keyId: apiKeyId,
    keyType: 'API_KEY',
  });

  await apiGatewayClient.send(command);
  console.log('✅ Clé API associée au plan d\'utilisation');
}

/**
 * Déploie l'API sur un stage
 */
async function deployApi(apiId: string, stageName: string): Promise<string> {
  console.log(`\n🚀 Déploiement de l'API sur le stage "${stageName}"...`);

  const command = new CreateDeploymentCommand({
    restApiId: apiId,
    stageName: stageName,
    description: `Déploiement du ${new Date().toISOString()}`,
  });

  await apiGatewayClient.send(command);
  const invokeUrl = `https://${apiId}.execute-api.${region}.amazonaws.com/${stageName}`;

  console.log(`✅ API déployée avec succès!`);
  console.log(`📍 URL d'invocation: ${invokeUrl}`);

  return invokeUrl;
}

/**
 * Configure complètement l'API Gateway
 */
async function setupApiGateway(): Promise<{ url: string; apiKey: string }> {
  try {
    console.log('\n🌐 Configuration de l\'API Gateway...');

    // Récupérer les ARN des rôles IAM
    console.log('\n🔐 Récupération des rôles IAM...');
    const s3RoleArn = await getRoleArn('APIGatewayS3ServiceRole');
    const dynamoRoleArn = await getRoleArn('APIGatewayDynamoDBServiceRole');
    console.log(`  ✅ Rôle S3: ${s3RoleArn}`);
    console.log(`  ✅ Rôle DynamoDB: ${dynamoRoleArn}`);

    // Créer l'API REST
    const apiId = await createRestApi();

    // Obtenir la ressource racine
    const rootResourceId = await getRootResource(apiId);

    // Créer la ressource /ships
    console.log('\n📁 Création des ressources...');
    const shipsResourceId = await createResource(apiId, rootResourceId, 'ships');

    // Créer la ressource /ships/profile
    const profileResourceId = await createResource(apiId, shipsResourceId, 'profile');

    // Créer la ressource /ships/profile/{key}
    const profileKeyResourceId = await createResource(apiId, profileResourceId, '{key}');

    // Créer la ressource /ships/photo
    const photoResourceId = await createResource(apiId, shipsResourceId, 'photo');

    // Créer la ressource /ships/photo/{key}
    const photoKeyResourceId = await createResource(apiId, photoResourceId, '{key}');

    // Configurer les méthodes
    console.log('\n⚙️  Configuration des méthodes...');

    // GET /ships
    await createGetShipsMethod(apiId, shipsResourceId, dynamoRoleArn);

    // GET /ships/profile/{key}
    await createGetShipProfileMethod(apiId, profileKeyResourceId, dynamoRoleArn);

    // GET /ships/photo/{key}
    await createGetShipPhotoMethod(apiId, photoKeyResourceId, s3RoleArn);

    // Activer CORS pour toutes les ressources
    console.log('\n🔓 Configuration de CORS...');
    await enableCors(apiId, shipsResourceId);
    await enableCors(apiId, profileKeyResourceId);
    await enableCors(apiId, photoKeyResourceId);
    console.log('  ✅ CORS configuré');

    // Déployer l'API
    const invokeUrl = await deployApi(apiId, STAGE_NAME);

    // Créer la clé API
    const apiKeyInfo = await createApiKey(API_NAME);

    // Créer le plan d'utilisation
    const usagePlanId = await createUsagePlan(apiId, STAGE_NAME, API_NAME);

    // Associer la clé API au plan d'utilisation
    await associateApiKeyToUsagePlan(usagePlanId, apiKeyInfo.id);

    return {
      url: invokeUrl,
      apiKey: apiKeyInfo.value,
    };
  } catch (error) {
    console.error('❌ Erreur lors de la configuration de l\'API Gateway:', error);
    throw error;
  }
}

// Main function to execute all operations
async function deploy() {
  try {
    console.log('🚀 Starting Project Deployment...');

    // Create S3 and Insert Objects
    console.log('\n📦 S3 est déjà créé (géré séparément)');

    // Create DynamoDB and Insert Items
    console.log('\n🗄️  DynamoDB sera géré par un collègue');

    // Create API Gateway and Configure S3 / DynamoDB Integration
    const result = await setupApiGateway();

    console.log('\n' + '='.repeat(80));
    console.log('✅ Project deployed successfully!');
    console.log('='.repeat(80));
    console.log(`\n📍 API Gateway URL: ${result.url}`);
    console.log(`\n🔑 API Key: ${result.apiKey}`);
    console.log(`\n📋 Endpoints disponibles:`);
    console.log(`   - GET ${result.url}/ships`);
    console.log(`   - GET ${result.url}/ships/profile/{key}`);
    console.log(`   - GET ${result.url}/ships/photo/{key}`);
    console.log('\n💡 Ouvrez checker/index.html pour tester l\'API');
    console.log('💡 Copiez l\'URL ET la clé API dans l\'interface de test');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Execute the main function
deploy();
