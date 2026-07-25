'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, FileAudio, FileVideo, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setProgress(15);
    setStatusText('Ingesting recording stream & parsing media...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

    try {
      setTimeout(() => { setProgress(45); setStatusText('Running Whisper speech-to-text transcription...'); }, 1200);
      setTimeout(() => { setProgress(75); setStatusText('Running Weave AI structured intelligence extraction...'); }, 3500);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to upload and process meeting.');
      }

      const data = await res.json();
      setProgress(100);
      setStatusText('Processing complete! Redirecting to meeting workspace...');
      setTimeout(() => {
        router.push(`/dashboard/meeting/${data.meeting.id}`);
      }, 800);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during upload.');
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="bg-[#12172A] border border-[#232B45] p-6 rounded-2xl shadow-xl backdrop-blur-xl">
        <h1 className="text-2xl font-bold font-display text-[#F8FAFC]">Upload Meeting Recording</h1>
        <p className="text-xs text-[#94A3B8] mt-1 font-mono">
          Ingest raw MP3, WAV, M4A, MP4, or MOV recordings. Weave extracts decisions, action items, risks, and indexes your call into RAG memory.
        </p>
      </div>

      {/* Upload Form Card */}
      <div className="bg-[#12172A] border border-[#232B45] rounded-2xl p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="absolute -inset-0.5 bg-gradient-to-tr from-[#6366F1]/10 to-[#5de6ff]/10 rounded-2xl blur-xl -z-10" />

        <form onSubmit={handleSubmit} className="space-y-6">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
              file
                ? 'border-[#34D399] bg-[#34D399]/5'
                : 'border-[#232B45] hover:border-[#6366F1] bg-[#0a0e17]/50'
            }`}
          >
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload-input"
              disabled={isUploading}
            />

            <label htmlFor="file-upload-input" className="cursor-pointer space-y-4 flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-[#181b25] border border-[#232B45] flex items-center justify-center text-[#5de6ff] shadow-lg">
                <UploadCloud className="w-8 h-8" />
              </div>

              {file ? (
                <div>
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#34D399]/20 border border-[#34D399]/40 text-xs font-semibold text-[#34D399]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Selected: {file.name}</span>
                  </span>
                  <p className="text-[11px] text-[#94A3B8] mt-1 font-mono">
                    ({(file.size / (1024 * 1024)).toFixed(2)} MB) - Click to change
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-[#F8FAFC]">
                    Drag & drop audio or video file here, or <span className="text-[#5de6ff] underline">browse</span>
                  </p>
                  <p className="text-[11px] text-[#94A3B8] mt-2 font-mono">
                    Supported formats: .MP3, .WAV, .M4A, .MP4, .MOV (Max 500MB)
                  </p>
                </div>
              )}
            </label>
          </div>

          {/* Progress / Error Feedback */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isUploading && (
            <div className="space-y-3 p-4 rounded-xl bg-[#0a0e17] border border-[#232B45]">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#5de6ff] font-semibold">{statusText}</span>
                <span className="text-[#94A3B8]">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-[#181b25] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#6366F1] via-[#5de6ff] to-[#EC4899] transition-all duration-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit CTA */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!file || isUploading}
              className={`px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                !file || isUploading
                  ? 'bg-[#181b25] border border-[#232B45] text-[#94A3B8] cursor-not-allowed opacity-50'
                  : 'btn-primary-cta shadow-xl'
              }`}
            >
              <span>{isUploading ? 'Processing Recording...' : 'Start Extraction & RAG Indexing'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
