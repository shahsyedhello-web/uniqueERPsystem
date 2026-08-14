import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface ProductImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt = 'Product',
  className = 'w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0 bg-slate-50',
}) => {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className={`${className} bg-slate-100 flex items-center justify-center text-slate-400`}>
        <ImageIcon className="w-5 h-5 stroke-1" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
};
