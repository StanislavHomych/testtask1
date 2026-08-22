import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';

const bucket = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const endpoint = process.env.AWS_S3_ENDPOINT;

if (!bucket || !region || !accessKeyId || !secretAccessKey) {
  console.error(
    'Missing AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, or AWS_SECRET_ACCESS_KEY.',
  );
  process.exit(1);
}

if (
  accessKeyId === 'replace_me' ||
  secretAccessKey === 'replace_me' ||
  bucket === 'replace_me'
) {
  console.error(
    'AWS credentials are still placeholders. Put real keys in apps/api/.env first.',
  );
  process.exit(1);
}

const client = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
  ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
});

try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log(`S3 bucket reachable: ${bucket} (${region})`);
} catch (error) {
  const awsError = error ?? {};
  const message = error instanceof Error ? error.message : 'Unknown error';
  const code = awsError.Code || awsError.name || 'UnknownError';
  const status = awsError.$metadata?.httpStatusCode;
  console.error(
    `S3 bucket is not reachable: ${code}${status ? ` (HTTP ${status})` : ''} ${message}`,
  );
  process.exit(1);
} finally {
  client.destroy();
}
