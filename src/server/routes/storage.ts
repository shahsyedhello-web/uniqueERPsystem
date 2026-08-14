import { Router } from 'express';
import { uploadProductImage, deleteProductImage, getBlobStream } from '../storageService';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// Public image proxy endpoint to safely serve both public and private Vercel blobs without 403
router.get('/image', async (req, res) => {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).json({ error: 'IMAGE_URL_REQUIRED', message: 'Missing image url query parameter.' });
    }

    const decodedUrl = decodeURIComponent(rawUrl);

    // Only proxy Vercel Blob URLs or local uploads
    if (!decodedUrl.includes('blob.vercel-storage.com') && !decodedUrl.startsWith('/uploads/')) {
      return res.status(400).json({ error: 'INVALID_IMAGE_SOURCE', message: 'Only Vercel Blob and local assets can be proxied.' });
    }

    const streamResult = await getBlobStream(decodedUrl);
    if (!streamResult) {
      return res.status(404).json({ error: 'IMAGE_NOT_FOUND', message: 'Image could not be retrieved.' });
    }

    res.setHeader('Content-Type', streamResult.contentType || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (streamResult.contentLength) {
      res.setHeader('Content-Length', streamResult.contentLength);
    }

    if (streamResult.buffer) {
      return res.end(streamResult.buffer);
    } else if (streamResult.stream) {
      return streamResult.stream.pipe(res);
    } else {
      return res.status(404).end();
    }
  } catch (err: any) {
    console.error('[Storage Proxy Error]:', err);
    return res.status(500).json({ error: 'IMAGE_FETCH_FAILED', message: err?.message || 'Failed to fetch image stream.' });
  }
});

// Image upload endpoint
router.post('/upload', authenticate, requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const { imageBase64, filename } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Valid imageBase64 string is required.' });
    }

    const matches = imageBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'IMAGE_INVALID_TYPE', message: 'Invalid base64 image format. Supported formats: PNG, JPG, JPEG, WEBP.' });
    }

    const ext = matches[1].toLowerCase() === 'jpeg' ? 'jpg' : matches[1].toLowerCase();
    const safeFilename = filename || `prod_${Date.now()}.${ext}`;

    const imageUrl = await uploadProductImage(imageBase64, safeFilename, `image/${ext}`);
    return res.json({ success: true, imageUrl, message: 'Image uploaded successfully.' });
  } catch (err: any) {
    console.error('[Storage Upload Error]:', err);
    return res.status(500).json({ error: 'IMAGE_UPLOAD_FAILED', message: err?.message || 'Failed to upload image.' });
  }
});

export default router;
