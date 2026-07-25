'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import { TranscriptionLanguage } from '@/lib/whisper';

export interface LanguageOption {
  code: TranscriptionLanguage;
  label: string;
  nativeLabel: string;
  flag: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'auto', label: 'Auto Detect', nativeLabel: 'Auto', flag: '🌐' },
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇺🇸' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', flag: '🇮🇳' },
];

export interface LanguageSelectProps {
  value: TranscriptionLanguage;
  onChange: (lang: TranscriptionLanguage) => void;
  allowAuto?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function LanguageSelect({
  value,
  onChange,
  allowAuto = true,
  disabled = false,
  className = '',
}: LanguageSelectProps) {
  const options = allowAuto ? LANGUAGE_OPTIONS : LANGUAGE_OPTIONS.filter((o) => o.code !== 'auto');

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <Globe className="w-3.5 h-3.5 text-[#5DE6FF] absolute left-3 pointer-events-none" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TranscriptionLanguage)}
        disabled={disabled}
        className="bg-[#0a0e17] border border-[#232B45] hover:border-[#6366F1] focus:border-[#6366F1] text-xs font-semibold text-white pl-8 pr-7 py-2 rounded-xl outline-none cursor-pointer appearance-none transition-all disabled:opacity-50"
      >
        {options.map((opt) => (
          <option key={opt.code} value={opt.code} className="bg-[#0a0e17] text-white">
            {opt.flag} {opt.label} ({opt.nativeLabel})
          </option>
        ))}
      </select>
      <div className="absolute right-2.5 pointer-events-none text-[10px] text-[#94A3B8]">
        ▼
      </div>
    </div>
  );
}
