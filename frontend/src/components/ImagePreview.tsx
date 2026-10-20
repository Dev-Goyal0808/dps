import { Image as ImageIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ImagePreviewProps {
  source?: string | Blob;
  alt: string;
  className?: string;
}

export function ImagePreview({ source, alt, className = '' }: ImagePreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string>();

  useEffect(() => {
    if (!source) {
      setObjectUrl(undefined);
      return;
    }
    if (typeof source === 'string') {
      setObjectUrl(source);
      return;
    }
    const url = URL.createObjectURL(source);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);

  if (!objectUrl) {
    return <div className={`flex items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ${className}`}><ImageIcon className="h-8 w-8" aria-hidden="true" /></div>;
  }

  return <img src={objectUrl} alt={alt} className={`block h-full w-full object-cover ${className}`} />;
}
