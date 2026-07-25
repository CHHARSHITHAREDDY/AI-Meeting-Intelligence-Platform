'use client';

import React, { useState, useEffect, useRef } from 'react';
// Weave AI Chat Page - Cross-Meeting RAG & AI Assistant
import { 
  Sparkles, Send, Plus, ArrowUp, Lock, Bot, User, 
  MessageSquare, ChevronDown, AtSign, Check, X, 
  Search, ShieldCheck, Layers, FileText, ArrowRight, Share2, Maximize2
} from 'lucide-react';
import { Meeting } from '@/lib/db';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  referencedMeetings?: string[];
}

export default function WeaveChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [privacyNoticeDismissed, setPrivacyNoticeDismissed] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/meetings')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setMeetings(Array.isArray(data) ? data : []))
      .catch(() => setMeetings([]));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInputQuery('');
    setIsLoading(true);

    try {
      // Determine endpoint: single meeting chat or global cross-meeting chat
      const endpoint = selectedMeetingId 
        ? `/api/meetings/${selectedMeetingId}/chat` 
        : '/api/chat/global';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          chatHistory: messages.map((m) => ({ sender: m.sender, text: m.text })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const botMsg: ChatMessage = {
          id: `msg-[#bot]-${Date.now()}`,
          sender: 'assistant',
          text: data.reply || 'No response generated.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          referencedMeetings: data.referencedMeetings,
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        throw new Error('Failed to fetch response');
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          sender: 'assistant',
          text: `I encountered an issue processing your request: ${err.message || 'Server connection error.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInputQuery('');
    setSelectedMeetingId(null);
  };

  const suggestedPrompts = [
    "Tell me about any important deadlines discussed in my meetings last week.",
    "Could you provide insights on the topics discussed in my last team meeting?",
    "What were the major challenges or obstacles discussed during my last meeting?",
  ];

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId);

  return (
    <div className="w-full h-[calc(100vh-6rem)] flex flex-col bg-[#0a0e17] text-white font-sans antialiased rounded-3xl border border-[#232B45] overflow-hidden shadow-2xl">
      
      {/* ── TOP HEADER (Matching User Screenshot) ── */}
      <div className="h-14 border-b border-[#232B45] px-6 flex items-center justify-between bg-[#121624]/90 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <button 
              onClick={() => setShowContextPicker(!showContextPicker)}
              className="flex items-center gap-2 text-xs font-bold text-white hover:text-[#5DE6FF] transition bg-[#181B25] border border-[#232B45] px-3 py-1.5 rounded-xl cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#6366F1]" />
              <span>{selectedMeeting ? `Context: ${selectedMeeting.title}` : 'New chat'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
            </button>

            {/* Context Picker Dropdown */}
            {showContextPicker && (
              <div className="absolute top-10 left-0 w-72 bg-[#121624] border border-[#232B45] rounded-2xl p-2 shadow-2xl z-50 space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] px-3 py-1.5">
                  Select Search Context
                </p>
                <button
                  onClick={() => {
                    setSelectedMeetingId(null);
                    setShowContextPicker(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                    selectedMeetingId === null ? 'bg-[#6366F1] text-white font-bold' : 'text-[#DFE2EF] hover:bg-[#181B25]'
                  }`}
                >
                  <span>🌐 All Workspace Meetings ({meetings.length})</span>
                  {selectedMeetingId === null && <Check className="w-3.5 h-3.5" />}
                </button>
                <div className="border-t border-[#232B45] my-1" />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {meetings.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedMeetingId(m.id);
                        setShowContextPicker(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs truncate flex items-center justify-between transition cursor-pointer ${
                        selectedMeetingId === m.id ? 'bg-[#6366F1] text-white font-bold' : 'text-[#DFE2EF] hover:bg-[#181B25]'
                      }`}
                    >
                      <span className="truncate">{m.title}</span>
                      {selectedMeetingId === m.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181B25] border border-[#232B45] hover:border-[#6366F1] text-xs font-semibold text-[#DFE2EF] hover:text-white transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#5DE6FF]" />
            <span>New</span>
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: 'Weave AI Chat', url: window.location.href });
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert('Chat link copied to clipboard!');
              }
            }}
            className="px-4 py-1.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#6366F1]/30"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* ── CHAT MESSAGES / SUGGESTIONS CONTAINER ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col justify-between">

        {messages.length === 0 ? (
          /* Empty State Suggestions (Matching User Screenshot Layout) */
          <div className="my-auto max-w-2xl mx-auto w-full space-y-8 animate-fade-in py-12">
            
            <div className="text-left space-y-2">
              <p className="text-xs font-mono text-[#94A3B8] uppercase tracking-wider">Suggestions</p>
            </div>

            <div className="space-y-3">
              {suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="w-full text-left bg-[#121624] hover:bg-[#181B25] border border-[#232B45] hover:border-[#6366F1] p-4 rounded-2xl text-xs font-medium text-[#DFE2EF] hover:text-white transition shadow-md group cursor-pointer flex items-center justify-between"
                >
                  <span>{prompt}</span>
                  <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#5DE6FF] group-hover:translate-x-1 transition-all shrink-0 ml-3" />
                </button>
              ))}
            </div>

          </div>
        ) : (
          /* Message List */
          <div className="space-y-6 max-w-4xl mx-auto w-full">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6366F1] to-[#5DE6FF] text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-lg mt-1">
                    W
                  </div>
                )}

                <div className={`space-y-2 max-w-[85%] ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                  <div
                    className={`p-4 rounded-2xl text-xs md:text-sm leading-relaxed whitespace-pre-wrap shadow-lg ${
                      msg.sender === 'user'
                        ? 'bg-[#6366F1] text-white rounded-tr-none'
                        : 'bg-[#121624] text-[#DFE2EF] border border-[#232B45] rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {msg.referencedMeetings && msg.referencedMeetings.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-[#94A3B8] font-mono">Referenced:</span>
                      {msg.referencedMeetings.map((title, idx) => (
                        <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#5DE6FF]/10 text-[#5DE6FF] border border-[#5DE6FF]/20">
                          {title}
                        </span>
                      ))}
                    </div>
                  )}

                  <span className="text-[10px] font-mono text-[#94A3B8] block px-1">
                    {msg.timestamp}
                  </span>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-[#181B25] border border-[#232B45] text-white font-bold flex items-center justify-center text-xs shrink-0 mt-1">
                    U
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-3 text-xs text-[#5DE6FF] font-mono bg-[#121624] border border-[#232B45] p-4 rounded-2xl max-w-sm">
                <Sparkles className="w-4 h-4 text-[#6366F1] animate-spin" />
                <span>Searching meetings & synthesizing answer...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}

      </div>

      {/* ── BOTTOM INPUT SECTION (Matching User Screenshot Layout) ── */}
      <div className="p-4 md:p-6 bg-[#0a0e17] border-t border-[#232B45] shrink-0">
        <div className="max-w-3xl mx-auto space-y-3">

          {/* Privacy Banner Header */}
          {!privacyNoticeDismissed && (
            <div className="flex items-center justify-between bg-[#121624]/80 border border-[#232B45] px-4 py-2 rounded-xl text-[11px] text-[#94A3B8]">
              <span className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-[#5DE6FF]" />
                Your chat is always private and grounded in your workspace conversations.
              </span>
              <button
                onClick={() => setPrivacyNoticeDismissed(true)}
                className="text-xs font-bold text-white hover:text-[#5DE6FF] transition cursor-pointer ml-3"
              >
                Got It.
              </button>
            </div>
          )}

          {/* Outer Rounded Chatbox */}
          <div className="bg-[#121624] border border-[#232B45] focus-within:border-[#6366F1] rounded-2xl p-3 shadow-2xl transition-all space-y-2">
            
            {/* Add Context Button Pill */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowContextPicker(!showContextPicker)}
                className="flex items-center gap-1.5 bg-[#181B25] hover:bg-[#232B45] border border-[#232B45] px-3 py-1 rounded-full text-[11px] font-semibold text-[#DFE2EF] hover:text-white transition cursor-pointer"
              >
                <AtSign className="w-3.5 h-3.5 text-[#5DE6FF]" />
                <span>{selectedMeeting ? selectedMeeting.title : 'Add context'}</span>
              </button>
            </div>

            {/* Main Textarea Input */}
            <textarea
              ref={inputRef}
              rows={2}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your conversations..."
              className="w-full bg-transparent text-xs md:text-sm text-white placeholder-[#94A3B8]/60 outline-none resize-none px-1"
            />

            {/* Bottom Input Controls Bar */}
            <div className="flex items-center justify-between pt-1 border-t border-[#232B45]/50">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-[11px] font-mono text-[#94A3B8] hover:text-white flex items-center gap-1 cursor-pointer transition"
                >
                  <span>Advanced</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              <button
                onClick={() => handleSend()}
                disabled={!inputQuery.trim() || isLoading}
                className="w-8 h-8 rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white flex items-center justify-center transition shadow-lg shadow-[#6366F1]/30 disabled:opacity-30 cursor-pointer"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      </div>

    </div>
  );
}
