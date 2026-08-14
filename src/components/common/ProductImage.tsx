import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface ProductImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
}

export const ProductImage: React.FC<ProductImageProps> = ({ src, alt = 'Product', className = 'w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0 bg-slate-50' }) => {
  const [hasError, setHasError] = useState(false);
  const [triedProxy, setTriedProxy] = useState(false);

  if (!src || hasError) {
    return (
      <div className={`${className} bg-slate-100 flex items-center justify-center text-slate-400`}>
        <ImageIcon className="w-5 h-5" />
      </div>
    );
  }

  const handleError = () => {
    // If direct Vercel Blob URL failed (e.g. 403 on private store), retry via proxy endpoint
    if (!triedProxy && src.startsWith('https://') && src.includes('blob.vercel-storage.com')) {
      setTriedProxy(true);
    } else {
      setHasError(true);
    }
  };

  const imageSource = triedProxy
    ? `/api/storage/image?url=${encodeURIComponent(src)}`
    : src;

  return (
    <img
      src={imageSource}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={handleError}
    />
  );
};
