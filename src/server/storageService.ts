import { put, del } from '@vercel/blob';
import path from 'path';
import fs from 'fs';

export async function uploadProductImage(
  fileBuffer: Buffer | string,
  filename: string,
  mimeType: string = 'image/png'
): Promise<string> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

  if (blobToken) {
    try {
      const buffer = typeof fileBuffer === 'string'
        ? Buffer.from(fileBuffer.replace(/^data:image\/\w+;base64,/, ''), 'base64')
        : fileBuffer;

      const blob = await put(`products/${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`, buffer, {
        access: 'public',
        contentType: mimeType || 'image/png',
        token: blobToken,
      });
      console.log('[Storage] Uploaded image to Vercel Blob:', blob.url);
      return blob.url;
    } catch (err: any) {
      console.error('[Storage] Vercel Blob upload failed:', err);
      if (isProd) {
        throw new Error('IMAGE_UPLOAD_FAILED: Failed to upload image to Vercel Blob storage.');
      }
    }
  }

  if (isProd) {
    throw new Error('IMAGE_STORAGE_NOT_CONFIGURED: Product image storage is not configured. Please configure Vercel Blob.');
  }

  // Development fallback to local filesystem
  const uploadsDir = path.join(process.cwd(), 'uploads', 'products');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const safeName = `prod_${Date.now()}_${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const filePath = path.join(uploadsDir, safeName);

  if (typeof fileBuffer === 'string') {
    const base64Data = fileBuffer.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
  } else {
    fs.writeFileSync(filePath, fileBuffer);
  }

  return `/uploads/products/${safeName}`;
}

export async function deleteProductImage(imageUrl: string): Promise<void> {
  if (!imageUrl) return;

  if (imageUrl.startsWith('https://') && imageUrl.includes('blob.vercel-storage.com')) {
    try {
      const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
      await del(imageUrl, blobToken ? { token: blobToken } : undefined);
      console.log('[Storage] Deleted image from Vercel Blob:', imageUrl);
    } catch (err) {
      console.warn('[Storage] Vercel Blob delete warning:', err);
    }
  } else if (imageUrl.startsWith('/uploads/products/')) {
    const localPath = path.join(process.cwd(), imageUrl);
    if (fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
      } catch (err) {
        console.warn('[Storage] Local file unlink warning:', err);
      }
    }
  }
}
