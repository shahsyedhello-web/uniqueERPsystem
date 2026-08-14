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

  // 1. Validate MIME Type
  const validMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  const normalizedMime = (mimeType || 'image/png').toLowerCase();
  if (!validMimes.includes(normalizedMime)) {
    throw new Error('IMAGE_INVALID_TYPE: Invalid image type. Supported formats: PNG, JPG, JPEG, WEBP.');
  }

  // 2. Decode/Buffer Conversion & Size Validation (Max 5MB)
  let buffer: Buffer;
  if (typeof fileBuffer === 'string') {
    const base64Match = fileBuffer.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    const base64Data = base64Match ? base64Match[2] : fileBuffer.replace(/^data:image\/\w+;base64,/, '');
    buffer = Buffer.from(base64Data, 'base64');
  } else {
    buffer = fileBuffer;
  }

  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('IMAGE_TOO_LARGE: Selected image exceeds maximum 5MB size limit.');
  }

  // 3. Vercel Blob Upload
  if (blobToken) {
    try {
      const ext = normalizedMime.includes('jpeg') || normalizedMime.includes('jpg') ? 'jpg' : normalizedMime.includes('webp') ? 'webp' : 'png';
      const safeFilename = `products/${Date.now()}-${(filename || 'product').replace(/[^a-zA-Z0-9.-]/g, '_')}.${ext}`;
      
      const blob = await put(safeFilename, buffer, {
        access: 'public',
        contentType: normalizedMime,
        token: blobToken,
      });
      console.log('[Storage] Uploaded image to Vercel Blob successfully:', blob.url);
      return blob.url;
    } catch (err: any) {
      console.error('[Storage] Vercel Blob upload failed:', err);
      throw new Error(`IMAGE_UPLOAD_FAILED: Failed to upload image to Vercel Blob storage: ${err?.message || 'unknown error'}`);
    }
  }

  // 4. Fallback to local filesystem if blobToken is not configured
  if (!blobToken) {
    console.log('[Storage] BLOB_READ_WRITE_TOKEN not configured. Falling back to local filesystem storage.');
    const uploadsDir = path.join(process.cwd(), 'uploads', 'products');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = normalizedMime.includes('jpeg') || normalizedMime.includes('jpg') ? 'jpg' : normalizedMime.includes('webp') ? 'webp' : 'png';
    const safeName = `prod_${Date.now()}_${(filename || 'product').replace(/[^a-zA-Z0-9.-]/g, '_')}.${ext}`;
    const filePath = path.join(uploadsDir, safeName);
    fs.writeFileSync(filePath, buffer);

    return `/uploads/products/${safeName}`;
  }
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

