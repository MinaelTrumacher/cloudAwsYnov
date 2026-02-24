import {
  S3Client,
  CreateBucketCommand,
  PutBucketCorsCommand,
  PutPublicAccessBlockCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { readFileSync } from 'fs';
import * as path from 'path';

// Configuration du client S3 avec le profil AWS SSO
const s3Client = new S3Client({
  region: 'eu-west-1',
  credentials: fromIni({ profile: 'aws-labs' }),
});

// Nom du bucket à créer
const BUCKET_NAME = 's3-lab-cli-emile-nathan-minh-1771927656'; // Modifiez ce nom si nécessaire

/**
 * Crée un bucket S3 avec la configuration appropriée
 */
async function createBucket(bucketName: string): Promise<void> {
  try {
    console.log(`\n📦 Création du bucket: ${bucketName}`);
    
    const createCommand = new CreateBucketCommand({
      Bucket: bucketName,
      CreateBucketConfiguration: {
        LocationConstraint: 'eu-west-1',
      },
    });

    await s3Client.send(createCommand);
    console.log('✅ Bucket créé avec succès');
  } catch (error: any) {
    if (error.name === 'BucketAlreadyOwnedByYou') {
      console.log('ℹ️  Le bucket existe déjà et vous appartient');
    } else if (error.name === 'BucketAlreadyExists') {
      console.log('⚠️  Le bucket existe déjà (appartient à quelqu\'un d\'autre)');
      throw error;
    } else {
      throw error;
    }
  }
}

/**
 * Configure CORS pour permettre l'accès depuis l'interface web
 */
async function configureCors(bucketName: string): Promise<void> {
  try {
    console.log('\n🔧 Configuration CORS...');
    
    const corsCommand = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'HEAD', 'PUT', 'POST'],
            AllowedOrigins: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    });

    await s3Client.send(corsCommand);
    console.log('✅ CORS configuré avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de la configuration CORS:', error);
    throw error;
  }
}

/**
 * Configure l'accès public au bucket
 */
async function configurePublicAccess(bucketName: string): Promise<void> {
  try {
    console.log('\n🌐 Configuration de l\'accès public...');
    
    // Désactiver le blocage d'accès public
    const publicAccessCommand = new PutPublicAccessBlockCommand({
      Bucket: bucketName,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: false,
        IgnorePublicAcls: false,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false,
      },
    });

    await s3Client.send(publicAccessCommand);
    console.log('✅ Paramètres d\'accès public configurés');
  } catch (error) {
    console.error('❌ Erreur lors de la configuration de l\'accès public:', error);
    throw error;
  }
}

/**
 * Configure la politique du bucket pour permettre la lecture publique
 */
async function configureBucketPolicy(bucketName: string): Promise<void> {
  try {
    console.log('\n📜 Configuration de la politique du bucket...');
    
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${bucketName}/*`,
        },
      ],
    };

    const policyCommand = new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(bucketPolicy),
    });

    await s3Client.send(policyCommand);
    console.log('✅ Politique du bucket configurée avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de la configuration de la politique:', error);
    throw error;
  }
}

/**
 * Upload un fichier vers S3
 */
async function uploadFile(bucketName: string, filePath: string, key: string): Promise<void> {
  try {
    const fileContent = readFileSync(filePath);
    
    // Déterminer le type MIME en fonction de l'extension
    const contentType = key.endsWith('.jpg') || key.endsWith('.jpeg') 
      ? 'image/jpeg' 
      : key.endsWith('.png') 
        ? 'image/png' 
        : 'application/octet-stream';

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
    });

    await s3Client.send(command);
    console.log(`  ✅ ${key} uploadé avec succès`);
  } catch (error) {
    console.error(`❌ Erreur lors de l'upload de ${key}:`, error);
    throw error;
  }
}

/**
 * Upload les images depuis le dossier assets
 */
async function uploadAssets(bucketName: string): Promise<void> {
  try {
    console.log('\n📤 Upload des images depuis le dossier assets...');
    
    const assetsDir = path.join(__dirname, '..', 'assets');
    const images = ['fisher.jpg', 'tanker.jpg'];

    for (const image of images) {
      const filePath = path.join(assetsDir, image);
      await uploadFile(bucketName, filePath, image);
    }

    console.log('✅ Toutes les images ont été uploadées');
  } catch (error) {
    console.error('❌ Erreur lors de l\'upload des images:', error);
    throw error;
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🚀 Démarrage de la création du bucket S3 pour le projet Ships API');
  console.log(`📦 Nom du bucket: ${BUCKET_NAME}`);

  try {
    // 1. Créer le bucket
    await createBucket(BUCKET_NAME);

    // 2. Configurer CORS
    await configureCors(BUCKET_NAME);

    // 3. Configurer l'accès public
    await configurePublicAccess(BUCKET_NAME);

    // 4. Configurer la politique du bucket
    await configureBucketPolicy(BUCKET_NAME);

    // 5. Upload des images
    await uploadAssets(BUCKET_NAME);

    console.log('\n🎉 Configuration du bucket terminée avec succès!');
    console.log(`\n📍 Région: eu-west-1`);
    console.log(`📦 Nom du bucket: ${BUCKET_NAME}`);
    console.log(`🌐 URL du bucket: https://${BUCKET_NAME}.s3.eu-west-1.amazonaws.com/`);
    console.log('\n📸 Images uploadées :');
    console.log(`   - https://${BUCKET_NAME}.s3.eu-west-1.amazonaws.com/fisher.jpg`);
    console.log(`   - https://${BUCKET_NAME}.s3.eu-west-1.amazonaws.com/tanker.jpg`);
    console.log('\n✨ Votre bucket est maintenant prêt avec toutes les ressources!');
  } catch (error) {
    console.error('\n❌ Erreur lors de la configuration du bucket:', error);
    process.exit(1);
  }
}

// Exécuter le script
main();
