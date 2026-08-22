import {
  PutBucketCorsCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const bucket = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const endpoint = process.env.AWS_S3_ENDPOINT;
const frontendOrigin =
  process.env.FRONTEND_URL?.replace(/\/$/, '') ?? 'http://localhost:5173';

if (!bucket || !region || !accessKeyId || !secretAccessKey) {
  console.error(
    'Missing AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, or AWS_SECRET_ACCESS_KEY.',
  );
  process.exit(1);
}

const client = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
  ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
});

try {
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'HEAD'],
            AllowedOrigins: [
              frontendOrigin,
              'http://localhost:5173',
              'http://127.0.0.1:5173',
              'https://testtask1-web.vercel.app',
            ],
            ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    }),
  );
  console.log(
    `Configured S3 CORS on ${bucket} for browser uploads from ${frontendOrigin}`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Failed to configure S3 CORS: ${message}`);
  console.error(`
The app IAM user can upload/download objects, but bucket CORS is a bucket-level
admin action. Set it once in the AWS Console:

  1. Open S3 → bucket "${bucket}" → Permissions → Cross-origin resource sharing
  2. Edit and paste:

[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": ["${frontendOrigin}", "http://127.0.0.1:5173"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3000
  }
]

If you want this script to work, attach s3:PutBucketCORS and s3:GetBucketCORS
on arn:aws:s3:::${bucket} to the IAM user, then rerun:
  npm run storage:cors --workspace api
`);
  process.exit(1);
} finally {
  client.destroy();
}
