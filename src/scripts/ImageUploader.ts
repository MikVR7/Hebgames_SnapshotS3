import { config } from './config.js';

declare const AWS: any;

export class ImageUploader {
    private s3: any;

    constructor() {
        if (typeof AWS === 'undefined') {
            throw new Error('AWS SDK is not defined. Make sure the SDK is loaded.');
        }
        
        // Configure AWS SDK with your credentials
        AWS.config.update({
            region: config.AWS_REGION,
            credentials: new AWS.Credentials({
                accessKeyId: config.AWS_ACCESS_KEY_ID,
                secretAccessKey: config.AWS_SECRET_ACCESS_KEY
            })
        });

        this.s3 = new AWS.S3({
            endpoint: `https://s3.${config.AWS_REGION}.amazonaws.com`,
            signatureVersion: 'v4'
        });
    }

    public async uploadImage(imageBlob: Blob): Promise<void> {
        const fileName = `Selfshot/image_${Date.now()}.jpg`;
        const params = {
            Bucket: config.AWS_S3_BUCKET_NAME,
            Key: fileName,
            Body: imageBlob,
            ContentType: 'image/jpeg'
        };

        try {
            const result = await this.s3.upload(params).promise();
            console.log('Upload successful:', result.Location);
            return result.Location; // Return the URL of the uploaded image
        } catch (error) {
            console.error('Upload failed:', error);
            if (error instanceof Error) {
                throw new Error(`Failed to upload image: ${error.message}`);
            } else {
                throw new Error('Failed to upload image: Unknown error');
            }
        }
    }
}