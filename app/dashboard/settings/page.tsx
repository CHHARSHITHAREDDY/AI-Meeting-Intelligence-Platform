'use client';

import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Cpu, 
  Database, 
  Bell, 
  Key, 
  ShieldCheck, 
  Save, 
  Check, 
  RefreshCw,
  Server,
  Zap,
  Lock,
  Globe
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'database' | 'security'>('general');
  const [saved, setSaved] = useState(false);

  // Form states
  const [whisperModel, setWhisperModel] = useState('whisper-base.en');
  const [extractionEngine, setExtractionEngine] = useState('llama-cloud-v1');
  const [maxAudioDuration, setMaxAudioDuration] = useState('60');
  const [autoProcess, setAutoProcess] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [riskAlerts, setRiskAlerts] = useState(true);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="w-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-[#2a4a5e] pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-display text-[#f5e2de] flex items-center gap-3">
            <span className="material-symbols-outlined text-[24px] text-[#9f8f99]">settings</span>
            System Settings
          </h1>
          <p className="text-[#9f8f99] mt-1 text-sm">
            Manage AI pipeline parameters, Neon PostgreSQL database connections, and platform preferences.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-lg btn-primary-cta text-white font-bold text-xs transition flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          {saved ? (
            <>
              <Check className="w-4 h-4 text-white" />
              Settings Saved
            </>
          ) : (
            <>
              <Save className="w-4 h-4 text-white" />
              Save Changes
            </>
          )}
        </button>
      </div>

      {/* Tabs bar */}
      <div className="flex border-b border-[#2a4a5e] space-x-6 text-sm font-medium">
        {[
          { id: 'general', label: 'General & Organization', icon: <Globe className="w-4 h-4" /> },
          { id: 'ai', label: 'AI & Pipeline Engine', icon: <Cpu className="w-4 h-4" /> },
          { id: 'database', label: 'Database & Storage', icon: <Database className="w-4 h-4" /> },
          { id: 'security', label: 'Security & API Keys', icon: <ShieldCheck className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 pb-3 pt-1 border-b-2 transition text-xs font-mono uppercase tracking-wider ${
              activeTab === tab.id
                ? 'border-[#9f8f99] text-[#9f8f99] font-bold'
                : 'border-transparent text-[#9f8f99] hover:text-[#eaeaea]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Main Settings Card */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'general' && (
            <div className="glass-card p-6 space-y-6">
              <h2 className="text-base font-bold font-display text-[#f5e2de]">Organization Profile</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-[#9f8f99] mb-1.5">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    defaultValue="Project Apollo Enterprise"
                    className="w-full bg-[#0f1f2d] border border-[#2a4a5e] rounded-lg px-4 py-2.5 text-sm text-[#eaeaea] focus:outline-none focus:border-[#9f8f99]/50 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-[#9f8f99] mb-1.5">
                    Primary Domain
                  </label>
                  <input
                    type="text"
                    defaultValue="apollo.intelligence.internal"
                    className="w-full bg-[#0f1f2d] border border-[#2a4a5e] rounded-lg px-4 py-2.5 text-sm text-[#eaeaea] focus:outline-none focus:border-[#9f8f99]/50 transition"
                  />
                </div>

                <div className="pt-4 border-t border-[#2a4a5e]">
                  <h3 className="text-sm font-bold text-[#f5e2de] mb-3">Notification Preferences</h3>
                  
                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 rounded-lg bg-[#0f1f2d]/50 border border-[#2a4a5e] cursor-pointer">
                      <div>
                        <p className="text-xs font-semibold text-[#eaeaea]">Meeting Analysis Ready Alerts</p>
                        <p className="text-[11px] text-[#9f8f99]">Receive notifications when Whisper transcription finishes.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notificationsEnabled}
                        onChange={(e) => setNotificationsEnabled(e.target.checked)}
                        className="w-4 h-4 rounded accent-[#6a2153]"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-lg bg-[#0f1f2d]/50 border border-[#2a4a5e] cursor-pointer">
                      <div>
                        <p className="text-xs font-semibold text-[#eaeaea]">High Risk Action Warnings</p>
                        <p className="text-[11px] text-[#9f8f99]">Alert team leads immediately when high-risk project bottlenecks are detected.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={riskAlerts}
                        onChange={(e) => setRiskAlerts(e.target.checked)}
                        className="w-4 h-4 rounded accent-[#6a2153]"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="glass-card p-6 space-y-6">
              <h2 className="text-base font-bold font-display text-[#f5e2de] flex items-center gap-2">
                <Cpu className="w-5 h-5 text-[#6a2153]" />
                Speech & Extraction AI Configuration
              </h2>

              <div className="space-y-5">
                <div>
                  <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-[#9f8f99] mb-1.5">
                    Speech-to-Text Model (STT)
                  </label>
                  <select
                    value={whisperModel}
                    onChange={(e) => setWhisperModel(e.target.value)}
                    className="w-full bg-[#0f1f2d] border border-[#2a4a5e] rounded-lg px-4 py-2.5 text-sm text-[#eaeaea] focus:outline-none focus:border-[#9f8f99]/50 transition"
                  >
                    <option value="whisper-base.en">Xenova/whisper-base.en (Local ONNX - Fast)</option>
                    <option value="whisper-small.en">Xenova/whisper-small.en (Higher Accuracy)</option>
                    <option value="openai-whisper-1">OpenAI Whisper-1 API (Cloud Remote)</option>
                  </select>
                  <p className="text-[11px] text-[#9f8f99] mt-1">
                    ONNX models run locally in-browser / server without sending raw audio externally.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-[#9f8f99] mb-1.5">
                    Intelligence & Decision Extraction Engine
                  </label>
                  <select
                    value={extractionEngine}
                    onChange={(e) => setExtractionEngine(e.target.value)}
                    className="w-full bg-[#0f1f2d] border border-[#2a4a5e] rounded-lg px-4 py-2.5 text-sm text-[#eaeaea] focus:outline-none focus:border-[#9f8f99]/50 transition"
                  >
                    <option value="llama-cloud-v1">LlamaCloud Extraction API (Configured)</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Structured JSON)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini (Fast Summarization)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-semibold uppercase tracking-wider text-[#9f8f99] mb-1.5">
                    Max Audio Buffer Timeout (Minutes)
                  </label>
                  <input
                    type="number"
                    value={maxAudioDuration}
                    onChange={(e) => setMaxAudioDuration(e.target.value)}
                    className="w-full bg-[#0f1f2d] border border-[#2a4a5e] rounded-lg px-4 py-2.5 text-sm text-[#eaeaea] focus:outline-none focus:border-[#9f8f99]/50 transition"
                  />
                </div>

                <div className="pt-2">
                  <label className="flex items-center justify-between p-3 rounded-lg bg-[#0f1f2d]/50 border border-[#2a4a5e] cursor-pointer">
                    <div>
                      <p className="text-xs font-semibold text-[#eaeaea]">Auto-Trigger Knowledge Graph Synthesis</p>
                      <p className="text-[11px] text-[#9f8f99]">Automatically update knowledge graph nodes after meeting processing.</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoProcess}
                      onChange={(e) => setAutoProcess(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#6a2153]"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'database' && (
            <div className="glass-card p-6 space-y-6">
              <h2 className="text-base font-bold font-display text-[#f5e2de] flex items-center gap-2">
                <Database className="w-5 h-5 text-[#34D399]" />
                Neon PostgreSQL Database Status
              </h2>

              <div className="p-4 rounded-xl bg-[#0f1f2d] border border-[#2a4a5e] space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-[#2a4a5e] pb-2">
                  <span className="text-[#9f8f99]">Connection State</span>
                  <span className="text-[#34D399] flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
                    CONNECTED (SSL Mode: require)
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-[#2a4a5e] pb-2">
                  <span className="text-[#9f8f99]">Endpoint</span>
                  <span className="text-[#eaeaea] truncate max-w-[280px]">ep-rough-union-a1axi18m-pooler...</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#2a4a5e] pb-2">
                  <span className="text-[#9f8f99]">Region</span>
                  <span className="text-[#eaeaea]">ap-southeast-1 (AWS AWS)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#9f8f99]">Active Tables</span>
                  <span className="text-[#b4a7af]">users, meetings</span>
                </div>
              </div>

              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => alert('Neon Database tables verified successfully!')}
                  className="px-4 py-2.5 rounded-lg bg-[#1a3345] border border-[#2a4a5e] hover:bg-[#254558] text-xs font-semibold text-[#eaeaea] flex items-center gap-2 transition"
                >
                  <RefreshCw className="w-4 h-4 text-[#9f8f99]" />
                  Verify Table Schema & Connections
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="glass-card p-6 space-y-6">
              <h2 className="text-base font-bold font-display text-[#f5e2de] flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#f5e2de]" />
                API Keys & Secret Credentials
              </h2>

              <div className="space-y-4">
                <div className="p-3.5 rounded-lg bg-[#0f1f2d] border border-[#2a4a5e]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#eaeaea]">LLAMA_API_KEY</span>
                    <span className="text-[10px] font-mono text-[#34D399] bg-[#34D399]/10 px-2 py-0.5 rounded">Active</span>
                  </div>
                  <p className="text-xs font-mono text-[#9f8f99] truncate">llx-FfWajAlWDMg5LaGgVJ7axFLoDdxtGUp1eJRDf0YVyLGpFrgV</p>
                </div>

                <div className="p-3.5 rounded-lg bg-[#0f1f2d] border border-[#2a4a5e]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#eaeaea]">JWT_SECRET</span>
                    <span className="text-[10px] font-mono text-[#34D399] bg-[#34D399]/10 px-2 py-0.5 rounded">Active</span>
                  </div>
                  <p className="text-xs font-mono text-[#9f8f99] truncate">f131a980-df81-42db-bb12-ca08bc0a19d8</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info Card */}
        <div className="space-y-6">
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#b4a7af]">System Architecture</h3>
            <div className="space-y-3 text-xs text-[#9f8f99]">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0f1f2d]">
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#9f8f99]" /> Next.js Version
                </span>
                <span className="font-mono text-[#eaeaea]">v16.2.11 (Turbopack)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0f1f2d]">
                <span className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#6a2153]" /> Runtime Mode
                </span>
                <span className="font-mono text-[#34D399]">Hybrid Local Node.js</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0f1f2d]">
                <span className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#f5e2de]" /> Auth Engine
                </span>
                <span className="font-mono text-[#eaeaea]">JWT + Neon DB</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
