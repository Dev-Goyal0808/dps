import { FileImage, UploadCloud } from 'lucide-react';
import { useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { ImagePreview } from './ImagePreview';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

interface ImageDropzoneProps {
  value?: File;
  onChange: (file: File | undefined) => void;
}

function validateFile(file: File) {
  if (!ACCEPTED_TYPES.includes(file.type)) return 'Choose a PNG, JPEG, or WebP image.';
  if (file.size > MAX_IMAGE_BYTES) return 'Images must be 10 MiB or smaller.';
  return undefined;
}

export function ImageDropzone({ value, onChange }: ImageDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [isDragging, setIsDragging] = useState(false);

  const selectFile = (file?: File) => {
    if (!file) return;
    const nextError = validateFile(file);
    setError(nextError);
    if (!nextError) onChange(file);
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => selectFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files[0]);
  };

  return (
    <div>
      <div
        className={`group relative overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${isDragging ? 'border-aqua bg-aqua/5' : 'border-slate-200 bg-slate-50/70 hover:border-navy/40 hover:bg-white'}`}
        onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        {value ? (
          <div className="relative h-56 sm:h-64">
            <ImagePreview source={value} alt="Selected cover image preview" className="h-full w-full" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-ink/90 to-transparent px-4 pb-4 pt-12 text-white">
              <div className="flex min-w-0 items-center gap-2"><FileImage className="h-4 w-4 shrink-0 text-aqua" /><span className="truncate text-sm font-medium">{value.name}</span></div>
              <button type="button" className="ml-3 shrink-0 text-xs font-semibold text-white underline underline-offset-4 hover:text-aqua" onClick={() => inputRef.current?.click()}>Change</button>
            </div>
          </div>
        ) : (
          <label htmlFor={inputId} className="flex min-h-56 cursor-pointer flex-col items-center justify-center px-6 py-10 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-white shadow-lg shadow-navy/20 transition-transform group-hover:-translate-y-0.5"><UploadCloud className="h-5 w-5" /></span>
            <span className="text-sm font-semibold text-ink">Drop a cover image here</span>
            <span className="mt-1 text-xs text-slate-500">or click to browse · PNG, JPEG, WebP · up to 10 MiB</span>
          </label>
        )}
        <input ref={inputRef} id={inputId} type="file" accept={ACCEPTED_TYPES.join(',')} className="sr-only" onChange={onInputChange} />
      </div>
      {error && <p className="mt-2 text-xs font-medium text-[#b34e3e]" role="alert">{error}</p>}
      <p className="mt-2 text-xs leading-5 text-slate-500">The backend decodes the image and checks dimensions and steganographic capacity before processing.</p>
    </div>
  );
}
