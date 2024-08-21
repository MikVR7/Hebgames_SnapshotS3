// prerequisites: install 'npm install aws-sdk'

const { exec } = require('child_process');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const S3_BUCKET = 'hebgames.pages';
const S3_ROOT_FOLDER = 'Tools';
const S3_SUB_FOLDER = 'SnapshotS3';
const BUILD_COMMAND = 'npm run build'; // Update this if your build command is different
const BUILD_OUTPUT_DIR = 'dist'; // Update this if your build output directory is different
const CLOUDFRONT_DISTRIBUTION_ID = 'E29DUID5IVGWQM'; // Replace with your CloudFront distribution ID

let S3_FOLDER;

// Configure AWS SDK
AWS.config.update({ region: 'eu-central-1' }); // Update with your AWS region
const s3 = new AWS.S3();
const cloudfront = new AWS.CloudFront();

// Function to run build command
function runBuild() {
    return new Promise((resolve, reject) => {
        exec(BUILD_COMMAND, (error, stdout, stderr) => {
            if (error) {
                console.error(`Build error: ${error}`);
                return reject(error);
            }
            console.log(`Build output: ${stdout}`);
            resolve();
        });
    });
}

// Function to delete all files in the S3 folder
async function deleteExistingFiles() {
    console.log(`Deleting existing files in ${S3_BUCKET}/${S3_FOLDER}...`);

    const listParams = {
        Bucket: S3_BUCKET,
        Prefix: S3_FOLDER
    };

    const listedObjects = await s3.listObjectsV2(listParams).promise();

    if (listedObjects.Contents.length === 0) return;

    const deleteParams = {
        Bucket: S3_BUCKET,
        Delete: { Objects: [] }
    };

    listedObjects.Contents.forEach(({ Key }) => {
        deleteParams.Delete.Objects.push({ Key });
    });

    await s3.deleteObjects(deleteParams).promise();

    // Handle pagination if there are more than 1000 objects
    if (listedObjects.IsTruncated) await deleteExistingFiles();
}

// Function to ensure index.html starts with <!DOCTYPE html>
function ensureDoctype(content, filePath) {
    if (filePath && path.basename(filePath).toLowerCase() === 'index.html') {
        const doctype = '<!DOCTYPE html>';
        if (!content.trim().toLowerCase().startsWith(doctype.toLowerCase())) {
            console.log(`Adding DOCTYPE to ${filePath}`);
            return doctype + '\n' + content;
        }
    }
    return content;
}

// Function to generate a cache-busting version
function generateVersion() {
    return crypto.randomBytes(8).toString('hex');
}

// Function to process file content and replace paths
function processFileContent(content, filePath, version) {
    const fileExt = path.extname(filePath).toLowerCase();
    
    if (['.html', '.js', '.css'].includes(fileExt)) {
        // Replace "dist/" with the S3_FOLDER path, maintaining the rest of the path
        content = content.replace(/dist\//g, S3_FOLDER);
        
        // Add version to asset URLs, ensuring correct path structure
        content = content.replace(
            /(src|href)="([^"]+\.(js|css))"/g, 
            (match, attr, url) => {
                // Skip absolute URLs or links to http/https pages
                if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
                    return `${attr}="${url}?v=${version}"`;
                }
                // For relative paths, ensure we don't add a second S3_FOLDER
                if (url.startsWith(S3_FOLDER)) {
                    return `${attr}="/${url}?v=${version}"`;
                }
                // For other relative paths, add S3_FOLDER and version
                return `${attr}="/${S3_FOLDER}${url}?v=${version}"`;
            }
        );
    }
    
    // Ensure DOCTYPE for index.html files
    content = ensureDoctype(content, filePath);
    
    return content;
}

// Function to upload a file to S3
function uploadFileToS3(filePath, s3Key, version) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, fileContent) => {
            if (err) {
                console.error(`Error reading file ${filePath}: ${err}`);
                reject(err);
                return;
            }

            fileContent = processFileContent(fileContent, filePath, version);

            const params = {
                Bucket: S3_BUCKET,
                Key: s3Key,
                Body: fileContent,
                ContentType: getContentType(filePath)
            };

            s3.upload(params, (err, data) => {
                if (err) {
                    console.error(`Error uploading ${filePath}: ${err}`);
                    reject(err);
                } else {
                    console.log(`Successfully uploaded ${filePath} to ${data.Location}`);
                    resolve();
                }
            });
        });
    });
}


// Function to get content type based on file extension
function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    };
    return contentTypes[ext] || 'application/octet-stream';
}

// Function to recursively upload directory contents
async function uploadDirectory(dirPath, s3Prefix, version) {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        const filePath = path.join(dirPath, file);
        const s3Key = path.join(s3Prefix, file).replace(/\\/g, '/').replace(/^dist\//, '');

        if (fs.statSync(filePath).isDirectory()) {
            await uploadDirectory(filePath, s3Key, version);
        } else {
            // Skip .map files
            if (!filePath.endsWith('.map')) {
                await uploadFileToS3(filePath, s3Key, version);
            } else {
                console.log(`Skipping ${filePath} (source map file)`);
            }
        }
    }
}

// Function to list recent invalidations
async function listInvalidations() {
    const params = {
        DistributionId: CLOUDFRONT_DISTRIBUTION_ID,
        MaxItems: '5'
    };

    try {
        const data = await cloudfront.listInvalidations(params).promise();
        console.log('Recent invalidations:');
        data.InvalidationList.Items.forEach(item => {
            console.log(`ID: ${item.Id}, Status: ${item.Status}, Created: ${item.CreateTime}`);
        });
    } catch (error) {
        console.error('Error listing invalidations:', error);
    }
}

// Main deploy function
async function deploy() {
    try {
        S3_FOLDER = S3_ROOT_FOLDER + '/' + S3_SUB_FOLDER + '/';

        console.log('Starting build process...');
        await runBuild();

        const version = generateVersion();
        console.log(`Generated version: ${version}`);

        console.log('Build complete. Deleting existing files in S3...');
        await deleteExistingFiles();

        console.log('Starting upload to S3...');
        await uploadDirectory(BUILD_OUTPUT_DIR, S3_FOLDER, version);

        console.log('Listing recent invalidations...');
        await listInvalidations();

        console.log('Deployment complete!');
    } catch (error) {
        console.error('Deployment failed:', error);
        if (error.code) {
            console.error(`Error code: ${error.code}`);
        }
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
    }
}


// Run the deploy function
deploy();