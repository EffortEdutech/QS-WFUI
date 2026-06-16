'use client';

/**
 * FileUploadPanel
 *
 * Shown when the user clicks ▶ Run and the workflow contains nodes that
 * need a file (document.upload_file, document.read_excel, qs.read_boq).
 * User selects a .xlsx file → we upload it first → get file_id → pass to runner.
 */

import { useState, useRef } from 'react';

interface Props {
  organizationId: string;
  projectId: string;
  workflowId: string;
  onUploaded: (fileId: string, fileName: string) => void;
  onSkip: () => void;
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export default function FileUploadPanel({
  organizationId,
  projectId,
  workflowId,
  onUploaded,
  onSkip,
}: Props) {
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

  async function handleFile(file: File) {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Only ${ALLOWED_EXTENSIONS.join(', ')} files are supported`);
      return;
    }

    setFileName(file.name);
    setUploadState('uploading');
    setError(null);
    setProgress('Uploading to storage…');

    try {
      // Get auth token from Supabase cookie (client-side)
      const { createClient } = await import('@/lib/supabase/client');
      const sb = createClient();
      const { data: sessionData } = await sb.auth.getSession();
      const token = sessionData.session?.access_token;

      const formData = new FormData();
      formData.append('file', file);

      const url = new URL(`${apiBase}/uploads`);
      url.searchParams.set('organizationId', organizationId);
      url.searchParams.set('projectId', projectId);
      url.searchParams.set('workflowId', workflowId);

      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const json = await res.json() as {
        success: boolean;
        data?: { fileId: string; originalName: string };
        error?: { message: string };
      };

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error?.message ?? `Upload failed (HTTP ${res.status})`);
      }

      setProgress('Upload complete ✓');
      setUploadState('done');
      onUploaded(json.data.fileId, json.data.originalName);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploadState('error');
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Upload BOQ File</h2>
        <p className="text-xs text-gray-500 mb-5">
          This workflow needs a spreadsheet input. Upload your BOQ Excel file to continue.
        </p>

        {/* Drop zone */}
        {uploadState !== 'done' && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl py-10 px-6 cursor-pointer transition-colors ${
              uploadState === 'uploading'
                ? 'border-blue-300 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            <span className="text-3xl mb-3">📂</span>
            {uploadState === 'idle' && (
              <>
                <p className="text-sm font-medium text-gray-700">Drop your BOQ file here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                <p className="text-xs text-gray-400 mt-2">.xlsx · .xls · .csv · max 50 MB</p>
              </>
            )}
            {uploadState === 'uploading' && (
              <>
                <p className="text-sm font-medium text-blue-600">{fileName}</p>
                <p className="text-xs text-blue-400 mt-1 animate-pulse">{progress}</p>
              </>
            )}
            {uploadState === 'error' && (
              <>
                <p className="text-sm font-medium text-red-600">Upload failed</p>
                <p className="text-xs text-red-400 mt-1">{error}</p>
                <p className="text-xs text-gray-400 mt-2">Click to try again</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = '';
              }}
            />
          </div>
        )}

        {/* Success state */}
        {uploadState === 'done' && (
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <span className="text-green-600 text-lg">✓</span>
            <div>
              <p className="text-sm font-medium text-green-800">{fileName}</p>
              <p className="text-xs text-green-600">{progress}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onSkip}
            className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            Skip — Run without file
          </button>
          {uploadState === 'done' && (
            <div className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg text-center">
              ✓ Ready to run
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
