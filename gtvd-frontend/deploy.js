const fs = require('fs');
const path = require('path');
const axios = require('axios');

const OSS_CONFIG = {
  endpoint: process.env.OSS_ENDPOINT || 'oss-cn-hangzhou.aliyuncs.com',
  bucket: process.env.OSS_BUCKET || 'gtvd-static',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  cdnDomain: process.env.CDN_DOMAIN || 'https://your-cdn-domain.com'
};

const REGION_CACHE_CONFIG = {
  'oss-cn-hangzhou': {
    'Cache-Control': 'max-age=0',
    'Content-Type': 'application/json',
    'x-oss-cache-control': 'max-age=31536000'
  },
  'oss-cn-shanghai': {
    'Cache-Control': 'max-age=0',
    'Content-Type': 'application/json',
    'x-oss-cache-control': 'max-age=31536000'
  }
};

function generateSignature(method, path, date, contentType) {
  const stringToSign = `${method}\n\n${contentType}\n${date}\n${path}`;
  return crypto
    .createHmac('sha1', OSS_CONFIG.accessKeySecret)
    .update(stringToSign)
    .digest('base64');
}

async function uploadFile(localPath, remotePath, contentType) {
  if (!OSS_CONFIG.accessKeyId || !OSS_CONFIG.accessKeySecret) {
    throw new Error('OSS credentials not configured');
  }

  const fileBuffer = fs.readFileSync(localPath);
  const date = new Date().toUTCString();

  const signature = generateSignature('PUT', `/${OSS_CONFIG.bucket}/${remotePath}`, date, contentType);
  const auth = `OSS ${OSS_CONFIG.accessKeyId}:${signature}`;

  try {
    const response = await axios.put(
      `https://${OSS_CONFIG.bucket}.${OSS_CONFIG.endpoint}/${remotePath}`,
      fileBuffer,
      {
        headers: {
          'Content-Type': contentType,
          'Date': date,
          'Authorization': auth
        },
        timeout: 60000
      }
    );

    if (response.status === 200) {
      return `https://${OSS_CONFIG.bucket}.${OSS_CONFIG.endpoint}/${remotePath}`;
    }
    throw new Error(`Upload failed with status ${response.status}`);
  } catch (error) {
    throw new Error(`OSS upload error: ${error.message}`);
  }
}

async function setCacheControl(remotePath) {
  const region = OSS_CONFIG.endpoint.split('.')[1];
  const cacheConfig = REGION_CACHE_CONFIG[region] || REGION_CACHE_CONFIG['oss-cn-hangzhou'];

  const manifest = {
    ObjectControl: 'Read',
    CacheControl: cacheConfig['Cache-Control'],
    ContentType: cacheConfig['Content-Type']
  };

  console.log(`[Deploy] Cache config for ${remotePath}:`, manifest);
  return manifest;
}

async function deploy() {
  const distDir = path.join(__dirname, 'dist');

  if (!fs.existsSync(distDir)) {
    console.error('[Deploy] Error: dist directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  console.log('[Deploy] Starting deployment to Alibaba Cloud OSS...');

  const files = getAllFiles(distDir);
  console.log(`[Deploy] Found ${files.length} files to upload`);

  const results = {
    success: [],
    failed: []
  };

  for (const file of files) {
    const relativePath = path.relative(distDir, file);
    const remotePath = relativePath.replace(/\\/g, '/');

    const ext = path.extname(file).toLowerCase();
    const contentType = getContentType(ext);

    try {
      const url = await uploadFile(file, remotePath, contentType);
      await setCacheControl(remotePath);
      results.success.push({ local: file, remote: remotePath, url });
      console.log(`[Deploy] ✓ ${remotePath}`);
    } catch (error) {
      results.failed.push({ local: file, remote: remotePath, error: error.message });
      console.error(`[Deploy] ✗ ${remotePath}: ${error.message}`);
    }
  }

  console.log('\n[Deploy] Deployment summary:');
  console.log(`  Success: ${results.success.length}`);
  console.log(`  Failed: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log('\n[Deploy] Failed files:');
    results.failed.forEach(f => console.log(`  - ${f.remote}: ${f.error}`));
  }

  const manifest = {
    version: new Date().toISOString(),
    total_files: files.length,
    success_count: results.success.length,
    failed_count: results.failed.length,
    cdn_domain: OSS_CONFIG.cdnDomain,
    access_urls: results.success.map(r => r.url)
  };

  fs.writeFileSync(
    path.join(__dirname, 'deploy-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('\n[Deploy] Deployment complete!');
  console.log(`[Deploy] CDN URL: ${OSS_CONFIG.cdnDomain}/daily`);

  return results;
}

function getAllFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function getContentType(ext) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

if (require.main === module) {
  deploy().catch(error => {
    console.error('[Deploy] Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { deploy, uploadFile, setCacheControl };
