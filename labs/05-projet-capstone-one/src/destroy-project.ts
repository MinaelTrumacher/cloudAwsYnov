import {
  APIGatewayClient,
  GetRestApisCommand,
  DeleteRestApiCommand,
} from '@aws-sdk/client-api-gateway';

// Configuration
const region = 'eu-west-1';
const apiGatewayClient = new APIGatewayClient({ region });

const API_NAME = 'ships-api-capstone';

/**
 * Supprime l'API Gateway par son nom
 */
async function deleteApiGateway(): Promise<void> {
  try {
    console.log('\n🗑️  Recherche de l\'API Gateway à supprimer...');

    // Lister toutes les APIs
    const listCommand = new GetRestApisCommand({});
    const listResponse = await apiGatewayClient.send(listCommand);

    // Trouver l'API par son nom
    const api = listResponse.items?.find((item) => item.name === API_NAME);

    if (!api) {
      console.log(`⚠️  Aucune API trouvée avec le nom "${API_NAME}"`);
      return;
    }

    console.log(`  📡 API trouvée: ${api.name} (ID: ${api.id})`);

    // Supprimer l'API
    const deleteCommand = new DeleteRestApiCommand({
      restApiId: api.id,
    });

    await apiGatewayClient.send(deleteCommand);
    console.log(`  ✅ API Gateway "${API_NAME}" supprimée avec succès`);
  } catch (error) {
    console.error('❌ Erreur lors de la suppression de l\'API Gateway:', error);
    throw error;
  }
}

// Main function to execute destructive operation
async function main() {
  try {
    console.log('🚀 Starting Project Deletion...');
    console.log('='.repeat(80));

    // Delete API Gateway
    await deleteApiGateway();

    // Delete DynamoDB (sera géré par le collègue)
    console.log('\n🗄️  DynamoDB sera supprimé par le collègue');

    // Delete S3 (sera géré séparément)
    console.log('\n📦 S3 sera supprimé séparément');

    console.log('\n' + '='.repeat(80));
    console.log('✅ Project deleted successfully!');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Execute the main function
main();

// Export to make this a module and avoid global scope conflicts
export {};
