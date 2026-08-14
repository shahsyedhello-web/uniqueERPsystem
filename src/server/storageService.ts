import { put, del } from '@vercel/blob';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';

export async function uploadProductImage(
  fileBuffer: Buffer | string,
  filename: string,
  mimeType: string = 'image/png'
): Promise<string> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

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
      const cleanBase = (filename || 'product').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeFilename = `products/${Date.now()}-${cleanBase}.${ext}`;

      let blobResult;
      try {
        blobResult = await put(safeFilename, buffer, {
          access: 'public',
          contentType: normalizedMime,
          token: blobToken,
        });
      } catch (firstErr: any) {
        const errMsg = String(firstErr?.message || '');
        if (errMsg.includes('private store') || errMsg.includes('private access') || errMsg.includes('access')) {
          console.log('[Storage] Vercel store requires private access parameter. Uploading with private access...');
          blobResult = await put(safeFilename, buffer, {
            access: 'private' as any,
            contentType: normalizedMime,
            token: blobToken,
          });
        } else {
          throw firstErr;
        }
      }

      console.log('[Storage] Uploaded image to Vercel Blob successfully:', blobResult.url);
      return blobResult.url;
    } catch (err: any) {
      console.error('[Storage] Vercel Blob upload failed:', err);
      throw new Error(`IMAGE_UPLOAD_FAILED: ${err?.message || 'Failed to upload image to Vercel Blob storage.'}`);
    }
  }

  // 4. Fallback to local filesystem if blobToken is not configured (e.g. local offline dev)
  console.log('[Storage] BLOB_READ_WRITE_TOKEN not configured. Using local filesystem storage.');
  const uploadsDir = path.join(process.cwd(), 'uploads', 'products');
  if (!fs.existsSync(uploadsDir)) {
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
    } catch (e) {}
  }

  const ext = normalizedMime.includes('jpeg') || normalizedMime.includes('jpg') ? 'jpg' : normalizedMime.includes('webp') ? 'webp' : 'png';
  const cleanBase = (filename || 'product').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeName = `prod_${Date.now()}_${cleanBase}.${ext}`;
  const filePath = path.join(uploadsDir, safeName);
  try {
    fs.writeFileSync(filePath, buffer);
  } catch (e) {
    // If filesystem is read-only (serverless) and no token, convert to data URI or throw
    console.warn('[Storage] Could not write to local disk (read-only filesystem)');
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
        console.warn('[Storage] Local image delete error:', err);
      }
    }
  }
}

export async function getBlobStream(imageUrl: string): Promise<{ buffer?: Buffer; stream?: any; contentType: string; contentLength?: number } | null> {
  if (!imageUrl) return null;

  // 1. Local file
  if (imageUrl.startsWith('/uploads/')) {
    const localPath = path.join(process.cwd(), imageUrl);
    if (fs.existsSync(localPath)) {
      const buffer = fs.readFileSync(localPath);
      const ext = path.extname(localPath).toLowerCase();
      const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
      return { buffer, contentType, contentLength: buffer.length };
    }
    return null;
  }

  // 2. Vercel Blob URL (supports both public and private stores)
  if (imageUrl.startsWith('https://') && imageUrl.includes('blob.vercel-storage.com')) {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    const headers: Record<string, string> = {};
    if (blobToken) {
      headers['Authorization'] = `Bearer ${blobToken}`;
    }

    const res = await fetch(imageUrl, { headers });
    if (!res.ok) {
      console.warn(`[Storage] Failed to fetch blob: ${imageUrl}, status: ${res.status}`);
      return null;
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const contentType = res.headers.get('content-type') || 'image/png';
    return {
      buffer,
      contentType,
      contentLength: buffer.length,
    };
  }

  return null;
}
