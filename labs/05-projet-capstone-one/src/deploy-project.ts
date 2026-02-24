import {
  DynamoDBClient,
  CreateTableCommand,
  DynamoDBClientConfig,
  CreateTableInput,
  PutItemCommand,
  PutItemInput,
} from '@aws-sdk/client-dynamodb'; // ES Modules import


// Main function to execute all operations
async function deploy() {
  try {
    console.log('🚀 Starting Project Deployment...');

    // Create S3 and Insert Objects

    // Create DynamoDB and Insert Items
    const config: DynamoDBClientConfig = {};
    const client = new DynamoDBClient(config);

    const db_name = "ENM-";

    const createTableInput: CreateTableInput = {
      TableName: db_name,
      BillingMode: 'PAY_PER_REQUEST',
      AttributeDefinitions: [
        { AttributeName: 'Id', AttributeType: 'N' },
        { AttributeName: 'Name', AttributeType: 'S' },
        { AttributeName: 'Price', AttributeType: 'N' },
      ],
      KeySchema: [
        { AttributeName: 'Id', KeyType: 'HASH' },
      ],
    };
    // Create API Gateway and Configure S3 / DynamoDB Integration

    console.log('Project deployed...');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Execute the main function
deploy();
