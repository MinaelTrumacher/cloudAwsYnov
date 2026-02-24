// Import the DynamoDB client and commands
import {
  DynamoDBClient,
  CreateTableCommand,
  PutItemCommand,
  ScanCommand,
  DeleteItemCommand,
  DeleteTableCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';

// Create DynamoDB client instance
const client = new DynamoDBClient({ region: 'eu-west-1' });

// Define the table name with a unique suffix
const tableName = `StarbucksCoffees-${Date.now()}`;

// Function to create the DynamoDB table
async function createTable() {
  console.log('Création de la table DynamoDB...');
  
  const command = new CreateTableCommand({
    TableName: tableName,
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }, // Partition key
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' }, // S = String
    ],
    BillingMode: 'PAY_PER_REQUEST', // Pay per request mode
  });

  const response = await client.send(command);
  console.log(`✅ Table "${tableName}" créée avec succès !`);
  
  // Wait for the table to be active
  console.log('En attente de l\'activation de la table...');
  await waitUntilTableExists(
    { client, maxWaitTime: 60 },
    { TableName: tableName }
  );
  console.log('La table est active !');
  
  return response;
}

// Function to insert coffee items into the table
async function insertCoffeeItems() {
  console.log('Insertion de type de café...');

  const coffees = [
    {
      id: '1',
      name: 'Espresso',
      size: 'Tall',
      price: '3.50',
    },
    {
      id: '2',
      name: 'Latte',
      size: 'Grande',
      price: '4.20',
    },
    {
      id: '3',
      name: 'Cappuccino',
      size: 'Venti',
      price: '4.80',
    },
  ];

  for (const coffee of coffees) {
    const command = new PutItemCommand({
      TableName: tableName,
      Item: {
        id: { S: coffee.id },
        name: { S: coffee.name },
        size: { S: coffee.size },
        price: { S: coffee.price },
      },
    });

    await client.send(command);
    console.log(`Inséré: ${coffee.name} (${coffee.size}) - €${coffee.price}`);
  }
}

// Function to read and display all items
async function readAllItems() {
  console.log('Lire tous les éléments de la table...');

  const command = new ScanCommand({
    TableName: tableName,
  });

  const response = await client.send(command);
  console.log(`\n Objets trouvés : ${response.Count}`);
  
  response.Items?.forEach((item) => {
    console.log(`  - ${item['name']?.S} (${item['size']?.S}): €${item['price']?.S}`);
  });
  
  return response.Items;
}

// Function to delete one item
async function deleteOneItem(itemId: string) {
  console.log(`Suppression de l'objet avec l\'id: ${itemId}...`);

  const command = new DeleteItemCommand({
    TableName: tableName,
    Key: {
      id: { S: itemId },
    },
  });

  await client.send(command);
  console.log(`Objet avec id "${itemId}" supprimé avec succès`);
}

// Function to delete the table
async function deleteTable() {
  console.log('Suppression de la table...');

  const command = new DeleteTableCommand({
    TableName: tableName,
  });

  await client.send(command);
  console.log(`✅ Table "${tableName}" deleted successfully!`);
}

// Main function to execute all operations
async function main() {
  try {
    console.log('Démarrage des opérations DynamoDB...');

    // Create table
    await createTable();

    // Insert 3 Starbucks coffee items
    await insertCoffeeItems();

    // Read and display all items
    await readAllItems();

    // Delete one item
    await deleteOneItem('1');
    
    // Read and display all items again to verify deletion
    console.log('\n Après suppression :');
    await readAllItems();

    // Clean up: delete the table
    await deleteTable();

    console.log('\nFin de l\'exécution...');
  } catch (error) {
    console.error('Erreur:', error);
  }
}

// Execute the main function
main();

// Export to make this a module and avoid global scope conflicts
export {};
