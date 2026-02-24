import {
  DynamoDBClient,
  CreateTableCommand,
  DynamoDBClientConfig,
  CreateTableInput,
  PutItemCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb';
import path from "node:path";
import * as fs from "node:fs"; // ES Modules import


// Main function to execute all operations
async function deploy() {
  try {
    console.log('🚀 Starting Project Deployment...');

    // Create S3 and Insert Objects

    // Create DynamoDB and Insert Items
    const config: DynamoDBClientConfig = {};
    const client = new DynamoDBClient(config);
    const db_name = "ENM-VerifMaritime";

    // Vérification si la table existe déjà
    let tableExists = false;
    try {
      await client.send(new DescribeTableCommand({ TableName: db_name }));
      tableExists = true;
    } catch (error: any) {
      if (error.name !== 'ResourceNotFoundException') {
        throw error; // Si erreur inattendue, on la remonte
      }
    }

    if (tableExists) {
      console.log(`⚠️  Table "${db_name}" déjà existante, création ignorée.`);
    } else {
      const createTableInput: CreateTableInput = {
        TableName: db_name,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'id', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'id', KeyType: 'HASH' },
        ],
      };

      await client.send(new CreateTableCommand(createTableInput));
      console.log(`✅ Table "${db_name}" créée avec succès.`);
    }

    const filePath = path.resolve('./data/ships.json');
    const ships = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    for (const ship of ships) {
      await client.send(
          new PutItemCommand({
            TableName: db_name,
            Item: ship,
          })
      );
      console.log(`✓ Inséré : ${ship.id.S} — ${ship.nom.S}`);
    }

    // Create API Gateway and Configure S3 / DynamoDB Integration

    console.log('Project deployed...');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Execute the main function
deploy();
