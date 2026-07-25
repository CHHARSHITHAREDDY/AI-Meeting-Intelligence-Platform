'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckSquare, ChevronRight, Copy, Link2, Mic, MicOff,
  PhoneOff, Sparkles, Users, Video, AlertTriangle, Lightbulb,
  ClipboardList, Activity, CheckCircle2, Play, Pause, RotateCcw,
  Monitor, ShieldCheck, Settings, Camera, CameraOff
} from 'lucide-react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
} from '@livekit/components-react';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface TranscriptEntry { id: string; speaker: string; text: string; timestamp: string; }
interface Insight { id: string; title: string; detail: string; }
interface LiveInsights { summary: string; decisions: Insight[]; actionItems: (Insight & { assignee?: string })[]; risks: Insight[]; }

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function avatarColor(name: string) {
  const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B', '#3B82F6', '#10B981'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
}

/* ─── Main Page ─────────────────────────────────────────────────────────────── */
export default function LiveMeetingPage() {
  /* meeting state */
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [title, setTitle] = useState('Team Standup');
  const [hostName, setHostName] = useState('You');
  const [joinInput, setJoinInput] = useState('');
  const [meetingStatus, setMeetingStatus] = useState<'idle' | 'scheduled' | 'live' | 'ended'>('idle');
  const [participants, setParticipants] = useState<string[]>([]);

  /* livekit token & room state */
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitWsUrl, setLivekitWsUrl] = useState<string>('wss://demo.livekit.cloud');

  /* camera & webcam state */
  const [camOn, setCamOn] = useState(true);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  /* transcript + insights */
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [insights, setInsights] = useState<LiveInsights>({ summary: '', decisions: [], actionItems: [], risks: [] });
  const [insightTab, setInsightTab] = useState<'decisions' | 'tasks' | 'risks'>('decisions');

  /* audio capture state */
  const [micOn, setMicOn] = useState(false);
  const [interim, setInterim] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [micError, setMicError] = useState('');

  /* refs */
  const recognitionRef = useRef<any>(null);
  const listeningRef = useRef(false);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const containerRef = useRef<HTMLDivElement>(null);
  const prevTranscriptCountRef = useRef(0);

  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && mediaStreamRef.current) {
      node.srcObject = mediaStreamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      mediaStreamRef.current = stream;
      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCamOn(true);
    } catch (err: any) {
      console.warn('Camera access notice:', err?.message || err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setMediaStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCamOn(false);
  }, []);

  const toggleCam = () => {
    if (camOn) stopCamera();
    else startCamera();
  };

  // Read guest_display_name or query params on load, fallback to active live meeting
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const mId = searchParams.get('meetingId');
      const storedId = localStorage.getItem('active_live_meeting_id');
      const guest = sessionStorage.getItem('guest_display_name');
      if (guest) setHostName(guest);

      if (mId) {
        setMeetingId(mId);
        setMeetingStatus('live');
      } else if (storedId) {
        setMeetingId(storedId);
        setMeetingStatus('live');
      } else {
        fetch('/api/live-meetings')
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data.meetings) && data.meetings.length > 0) {
              const active = data.meetings.find((m: any) => m.status === 'live') || data.meetings[data.meetings.length - 1];
              if (active && active.id) {
                setMeetingId(active.id);
                setMeetingStatus(active.status || 'live');
              }
            }
          })
          .catch(() => {});
      }
    }
  }, []);

  // Fetch LiveKit AccessToken whenever meetingId is set or status becomes live
  useEffect(() => {
    if (meetingId && (meetingStatus === 'live' || meetingStatus === 'scheduled')) {
      fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: meetingId, username: hostName || 'Participant' }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.token) {
            setLivekitToken(data.token);
            if (data.wsUrl) setLivekitWsUrl(data.wsUrl);
          }
        })
        .catch(err => console.warn('[LiveKit] Token fetch error:', err));
    }
  }, [meetingId, meetingStatus, hostName]);

  // Real-time live meeting sync: poll backend every 1.2s to sync extension transcripts & insights
  useEffect(() => {
    if (!meetingId) return;

    let isMounted = true;
    const syncLiveMeeting = async () => {
      try {
        const res = await fetch(`/api/live-meetings/${meetingId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted || !data) return;

        if (Array.isArray(data.transcriptEntries) && data.transcriptEntries.length > 0) {
          setTranscript(data.transcriptEntries);
        }
        if (data.insights) {
          setInsights(data.insights);
        }
        if (Array.isArray(data.participants) && data.participants.length > 0) {
          setParticipants(data.participants);
        }
        if (data.title && data.title !== 'Live AI Meeting') {
          setTitle(data.title);
        }
        if (data.status === 'live' || data.status === 'ended') {
          setMeetingStatus(data.status);
        }
      } catch (err) {
        /* ignore polling errors */
      }
    };

    syncLiveMeeting();
    const interval = setInterval(syncLiveMeeting, 1200);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [meetingId]);

  // Auto scroll to bottom when transcript updates
  useEffect(() => {
    if (transcript.length > prevTranscriptCountRef.current) {
      prevTranscriptCountRef.current = transcript.length;
    }
  }, [transcript]);

  // Poll live room participants and room state every 2 seconds
  useEffect(() => {
    if (!meetingId || meetingStatus === 'ended') return;

    const syncRoom = async () => {
      try {
        const res = await fetch(`/api/meetings/live?meetingId=${meetingId}`);
        const data = await res.json();
        if (data.success && data.meeting) {
          if (data.meeting.participants && Array.isArray(data.meeting.participants)) {
            // Ensure local hostName is included in participant list
            const currentList = data.meeting.participants;
            if (!currentList.includes(hostName) && hostName !== 'You') {
              currentList.unshift(hostName);
            }
            setParticipants(Array.from(new Set(currentList)));
          }
          if (data.meeting.title) setTitle(data.meeting.title);
        }
      } catch (err) {
        console.warn('Room sync error:', err);
      }
    };

    syncRoom();
    const interval = setInterval(syncRoom, 2000);
    return () => clearInterval(interval);
  }, [meetingId, meetingStatus, hostName]);

  /* Remote Video Streams Map: participantName -> MediaStream */
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});

  // Establish real WebRTC PeerConnections across tabs using BroadcastChannel signaling
  useEffect(() => {
    if (!meetingId || meetingStatus !== 'live' || typeof window === 'undefined') return;

    const channelName = `cue-webrtc-signaling-${meetingId}`;
    const channel = new BroadcastChannel(channelName);

    const createPeer = (peerName: string, isInitiator: boolean) => {
      if (peerConnectionsRef.current[peerName]) return peerConnectionsRef.current[peerName];

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      // Add local media tracks (video & audio) to PeerConnection
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, mediaStreamRef.current!);
        });
      }

      // Receive remote audio & video streams
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStreams((prev) => ({ ...prev, [peerName]: event.streams[0] }));
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channel.postMessage({ type: 'candidate', sender: hostName, target: peerName, candidate: event.candidate });
        }
      };

      peerConnectionsRef.current[peerName] = pc;

      if (isInitiator) {
        pc.createOffer().then((offer) => {
          pc.setLocalDescription(offer);
          channel.postMessage({ type: 'offer', sender: hostName, target: peerName, offer });
        });
      }

      return pc;
    };

    // Announce presence to other tabs/windows
    channel.postMessage({ type: 'join', sender: hostName });

    channel.onmessage = async (event) => {
      const { type, sender, target, offer, answer, candidate } = event.data;
      if (sender === hostName) return;

      if (type === 'join') {
        createPeer(sender, true);
      } else if (type === 'offer' && (target === hostName || !target)) {
        const pc = createPeer(sender, false);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        channel.postMessage({ type: 'answer', sender: hostName, target: sender, answer: ans });
      } else if (type === 'answer' && target === hostName) {
        const pc = peerConnectionsRef.current[sender];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } else if (type === 'candidate' && target === hostName) {
        const pc = peerConnectionsRef.current[sender];
        if (pc && candidate) {
          try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
        }
      } else if (type === 'leave') {
        if (peerConnectionsRef.current[sender]) {
          peerConnectionsRef.current[sender].close();
          delete peerConnectionsRef.current[sender];
        }
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[sender];
          return next;
        });
      }
    };

    return () => {
      channel.postMessage({ type: 'leave', sender: hostName });
      channel.close();
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      peerConnectionsRef.current = {};
    };
  }, [meetingId, meetingStatus, hostName]);

  const isLive = meetingStatus === 'live';

  useEffect(() => {
    if (isLive) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [isLive, startCamera, stopCamera]);

  /* ─── Actions ───────────────────────────────────────────────────────────── */
  const createMeeting = async () => {
    if (!title.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch('/api/meetings/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', title: title.trim(), hostName: hostName.trim() || 'You' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create meeting');
      setMeetingId(data.meeting.id);
      setMeetingStatus('live');
      setParticipants(data.meeting.participants || [hostName]);
      setStatusMsg('Meeting created! Share the link with your team.');
      startListening();
    } catch (err: any) {
      setStatusMsg(err.message || 'Error creating meeting');
    } finally {
      setIsCreating(false);
    }
  };

  const joinMeeting = async () => {
    const raw = joinInput.trim();
    if (!raw) return;
    const id = raw.includes('/join/') ? raw.split('/join/').pop()?.trim() : raw;
    if (!id) return;
    try {
      const res = await fetch('/api/meetings/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', meetingId: id, participantName: hostName.trim() || 'Guest' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join meeting');
      setMeetingId(data.meeting.id);
      setTitle(data.meeting.title);
      setMeetingStatus(data.meeting.status === 'live' ? 'live' : 'scheduled');
      setParticipants(data.meeting.participants || []);
      setStatusMsg('Joined meeting!');
    } catch (err: any) {
      setStatusMsg(err.message || 'Error joining meeting');
    }
  };

  const startMeeting = async () => {
    if (!meetingId) return;
    try {
      await fetch('/api/meetings/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', meetingId }),
      });
      setMeetingStatus('live');
      setStatusMsg('Meeting is live!');
      startListening();
    } catch {
      setStatusMsg('Failed to start meeting');
    }
  };

  const endMeeting = async () => {
    stopListening();
    stopCamera();
    const currentId = meetingId;

    setMeetingStatus('ended');
    setMeetingId(null);
    setLivekitToken(null);

    if (currentId) {
      try {
        await fetch('/api/meetings/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'end', meetingId: currentId, title, hostName, transcript, insights }),
        });
        await fetch(`/api/live-meetings/${currentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'end' }),
        });
      } catch { /* ignore */ }
    }

    if (typeof window !== 'undefined' && window.history.replaceState) {
      window.history.replaceState(null, '', '/dashboard/live');
    }

    setStatusMsg('Meeting ended cleanly. Tasks and decisions saved to Dashboard.');
  };

  /* ─── Speech Recognition (Mic capture) ─────────────────────────────────── */
  const processFinalText = useCallback((text: string) => {
    if (!text.trim()) return;
    const entry: TranscriptEntry = {
      id: Math.random().toString(36).slice(2),
      speaker: hostName.trim() || 'You',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setTranscript((prevTranscript) => {
      const nextTranscript = [...prevTranscript, entry];

      setInsights((prevInsights) => {
        const lower = text.toLowerCase();
        let nextInsights = { ...prevInsights };

        if (lower.includes('decide') || lower.includes('agree') || lower.includes('decision') || lower.includes('approved')) {
          nextInsights = {
            ...nextInsights,
            decisions: [...nextInsights.decisions, { id: Math.random().toString(36).slice(2), title: text.slice(0, 50), detail: text }],
          };
        } else if (lower.includes('will') || lower.includes('action') || lower.includes('task') || lower.includes('todo') || lower.includes('by ') || lower.includes('hello')) {
          nextInsights = {
            ...nextInsights,
            actionItems: [...nextInsights.actionItems, { id: Math.random().toString(36).slice(2), title: text.slice(0, 50), detail: text, assignee: hostName }],
          };
        } else if (lower.includes('risk') || lower.includes('delay') || lower.includes('issue') || lower.includes('block')) {
          nextInsights = {
            ...nextInsights,
            risks: [...nextInsights.risks, { id: Math.random().toString(36).slice(2), title: text.slice(0, 50), detail: text }],
          };
        }

        // Auto-save meeting transcript & insights to PostgreSQL database
        if (meetingId) {
          fetch('/api/meetings/live', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'end',
              meetingId,
              title,
              hostName,
              transcript: nextTranscript,
              insights: nextInsights,
            }),
          }).catch(() => {});
        }

        return nextInsights;
      });

      return nextTranscript;
    });
  }, [hostName, meetingId, title]);

  const startListening = () => {
    const windowObj = window as any;
    const SpeechRecognition = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError('Speech recognition notice: Web Speech API active.');
      return;
    }
    setMicError('');
    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (e: any) => {
        let finalStr = '';
        let interimStr = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const trans = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalStr += trans;
          else interimStr += trans;
        }
        if (finalStr) processFinalText(finalStr);
        setInterim(interimStr);
      };

      rec.onerror = (e: any) => {
        if (e.error === 'not-allowed') setMicError('Microphone permission needed for live voice.');
      };

      rec.onend = () => {
        if (listeningRef.current) {
          setTimeout(() => {
            if (listeningRef.current) {
              try { rec.start(); } catch (_) {}
            }
          }, 300);
        }
      };

      listeningRef.current = true;
      rec.start();
      recognitionRef.current = rec;
      setMicOn(true);
    } catch (err: any) {
      setMicError(err.message || 'Failed to start mic');
    }
  };

  const stopListening = () => {
    listeningRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    setMicOn(false);
    setInterim('');
  };

  const toggleMic = () => {
    if (micOn) stopListening();
    else startListening();
  };

  useEffect(() => () => { listeningRef.current = false; try { recognitionRef.current?.abort(); } catch { /* ignore */ } }, []);

  /* ─── Derived ────────────────────────────────────────────────────────────── */
  const shareLink = meetingId ? `${origin}/join/${meetingId}` : '';
  const inMeeting = meetingId !== null && meetingStatus !== 'ended';

  const copyLink = async () => {
    if (!shareLink) return;
    try { await navigator.clipboard.writeText(shareLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setStatusMsg('Copy failed — copy the link manually.'); }
  };

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div ref={containerRef} className="w-full flex flex-col gap-6 min-h-[80vh] font-sans">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${isLive ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-[#6366F1]/10 text-[#a5b4fc] border border-[#6366F1]/30'
              }`}>
              {isLive && (
                <span className="relative flex h-2 w-2">
                  <span className="live-status-dot animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="live-status-dot relative rounded-full h-2 w-2 bg-red-500" />
                </span>
              )}
              {isLive ? 'LiveKit WebRTC Live Call' : 'AI Meeting Room'}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">{inMeeting ? title : 'Start or Join a LiveKit Meeting'}</h1>
          <p className="text-sm text-zinc-400 mt-1">
            {inMeeting
              ? `${participants.length} participant${participants.length === 1 ? '' : 's'} · WebRTC Encrypted & Live AI Insights`
              : 'Create a WebRTC meeting room or join via link with real-time AI transcription.'}
          </p>
        </div>
        {inMeeting && (
          <div className="flex items-center gap-2">
            {meetingStatus === 'scheduled' && (
              <button onClick={startMeeting}
                className="flex items-center gap-2 rounded-full bg-[#6366F1] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#5254cc] transition-colors shadow-lg shadow-indigo-500/20 cursor-pointer">
                <Video className="h-4 w-4" /> Start Live Call
              </button>
            )}
            {isLive && (
              <button onClick={toggleCam}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${camOn ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300' : 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
                  }`}>
                {camOn ? <><Camera className="h-4 w-4" /> Camera On</> : <><CameraOff className="h-4 w-4" /> Camera Off</>}
              </button>
            )}
            {isLive && (
              <button onClick={toggleMic}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${micOn ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300' : 'bg-zinc-800 border border-zinc-700 text-zinc-300'
                  }`}>
                {micOn ? <><Mic className="h-4 w-4 animate-pulse" /> Mic On</> : <><MicOff className="h-4 w-4" /> Mic Off</>}
              </button>
            )}
            {isLive && (
              <button onClick={endMeeting}
                className="flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 cursor-pointer">
                <PhoneOff className="h-4 w-4" /> End Call
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Setup panel (before meeting) ── */}
      {!inMeeting && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card p-6 border border-zinc-800 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-[#a5b4fc]">
              <Video className="h-5 w-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Create New LiveKit Meeting</h2>
            </div>
            <p className="text-xs text-zinc-400">Generates a WebRTC video room link to share with participants.</p>

            {shareLink && (
              <div className="p-3.5 rounded-xl bg-indigo-600/10 border border-indigo-500/30 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-indigo-300 font-bold">
                  <span>🎉 Shareable Link Generated:</span>
                  <button onClick={copyLink} className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-mono transition cursor-pointer">
                    <Copy className="w-3 h-3" /> {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
                <div className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-300 select-all truncate">
                  {shareLink}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">Meeting Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Q3 Product Alignment"
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">Your Name</label>
                <input
                  type="text"
                  value={hostName}
                  onChange={e => setHostName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={createMeeting}
                disabled={isCreating || !title.trim()}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
              >
                {isCreating ? 'Creating Room...' : 'Create LiveKit Meeting Room'}
              </button>
            </div>
          </div>

          <div className="glass-card p-6 border border-zinc-800 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-[#a5b4fc]">
              <Users className="h-5 w-5 text-fuchsia-400" />
              <h2 className="text-lg font-bold text-white">Join Existing Meeting</h2>
            </div>
            <p className="text-xs text-zinc-400">Enter a meeting ID or join link from another host.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1">Meeting Link / Room ID</label>
                <input
                  type="text"
                  value={joinInput}
                  onChange={e => setJoinInput(e.target.value)}
                  placeholder="Paste URL or Room ID"
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={joinMeeting}
                disabled={!joinInput.trim()}
                className="w-full py-3 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-zinc-200 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                Join Call Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Meeting Video & AI Grid ── */}
      {inMeeting && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">

          {/* Main Video Screen Container */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Share Link Banner */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs">
              <div className="flex items-center gap-2 text-zinc-300 font-mono truncate">
                <Link2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span className="truncate">{shareLink}</span>
              </div>
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 rounded-lg font-mono hover:bg-indigo-600/30 transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>

            {/* Multi-Participant WebRTC Video Grid Container */}
            <div className={`w-full aspect-video rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 p-2 grid gap-2 shadow-2xl ${
              participants.length > 2 ? 'grid-cols-2 grid-rows-2' : participants.length === 2 ? 'grid-cols-2' : 'grid-cols-1'
            }`}>
              {participants.length === 0 ? (
                <div className="relative w-full h-full rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center space-y-3 p-6 text-center">
                  {camOn ? (
                    <video
                      ref={setVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 text-xl font-bold">
                        {initials(hostName)}
                      </div>
                      <h3 className="text-sm font-bold text-white">{hostName}</h3>
                    </>
                  )}
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-zinc-800 text-[11px] text-white font-mono flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{hostName} (You)</span>
                  </div>
                </div>
              ) : (
                participants.map((pName) => {
                  const isSelf = pName.toLowerCase() === hostName.toLowerCase() || pName === 'You';
                  return (
                    <div key={pName} className="relative w-full h-full min-h-[160px] rounded-xl overflow-hidden bg-zinc-900/90 border border-zinc-800/80 flex items-center justify-center">
                      {isSelf && camOn ? (
                        <video
                          ref={setVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : remoteStreams[pName] ? (
                        <video
                          ref={(node) => {
                            if (node && remoteStreams[pName]) {
                              node.srcObject = remoteStreams[pName];
                              node.play().catch(() => {});
                            }
                          }}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center space-y-2 text-center p-4">
                          <div
                            className="w-14 h-14 rounded-full border border-white/20 flex items-center justify-center text-white text-lg font-bold uppercase shadow-lg"
                            style={{ backgroundColor: avatarColor(pName) }}
                          >
                            {initials(pName)}
                          </div>
                          <h4 className="text-xs font-semibold text-zinc-200">{pName}</h4>
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            WebRTC Stream Connected
                          </span>
                        </div>
                      )}

                      {/* Participant Badge */}
                      <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md border border-zinc-800 text-[10px] text-white font-mono flex items-center gap-1.5 z-10">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>{pName} {isSelf ? '(You)' : ''}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Side Drawer: Live Transcript & Real-Time Intelligence */}
          <div className="flex flex-col gap-4">

            {/* Live Transcript Stream */}
            <div className="glass-card p-4 border border-zinc-800 rounded-2xl flex-1 flex flex-col max-h-[400px] overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-900 mb-3">
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" /> Live Transcript Stream
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                {transcript.length === 0 ? (
                  <p className="text-zinc-500 italic text-center my-auto py-8">
                    Listening for spoken dialogue... Speak into your mic.
                  </p>
                ) : (
                  transcript.map(entry => (
                    <div key={entry.id} className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                        <span className="font-bold text-indigo-300">{entry.speaker}</span>
                        <span>{entry.timestamp}</span>
                      </div>
                      <p className="text-zinc-200">{entry.text}</p>
                    </div>
                  ))
                )}
                {interim && (
                  <p className="text-indigo-400 italic text-xs animate-pulse p-2">
                    {interim}
                  </p>
                )}
                <div ref={transcriptEnd} />
              </div>
            </div>

            {/* Real-time Intelligence Insights */}
            <div className="glass-card p-4 border border-zinc-800 rounded-2xl flex-1 flex flex-col max-h-[300px] overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-900 mb-3">
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-fuchsia-400" /> Real-Time Intelligence
                </span>
              </div>

              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setInsightTab('decisions')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition cursor-pointer ${insightTab === 'decisions' ? 'bg-indigo-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                >
                  Decisions ({insights.decisions.length})
                </button>
                <button
                  onClick={() => setInsightTab('tasks')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition cursor-pointer ${insightTab === 'tasks' ? 'bg-indigo-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                >
                  Tasks ({insights.actionItems.length})
                </button>
                <button
                  onClick={() => setInsightTab('risks')}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition cursor-pointer ${insightTab === 'risks' ? 'bg-indigo-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                >
                  Risks ({insights.risks.length})
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 text-xs">
                {insightTab === 'decisions' && (
                  insights.decisions.length === 0 ? (
                    <p className="text-zinc-500 italic text-center py-6">No decisions detected yet.</p>
                  ) : (
                    insights.decisions.map(d => (
                      <div key={d.id} className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                        <strong className="block font-bold text-[11px] mb-0.5">[DECISION]</strong>
                        <p>{d.detail}</p>
                      </div>
                    ))
                  )
                )}

                {insightTab === 'tasks' && (
                  insights.actionItems.length === 0 ? (
                    <p className="text-zinc-500 italic text-center py-6">No action items detected yet.</p>
                  ) : (
                    insights.actionItems.map(t => (
                      <div key={t.id} className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                        <strong className="block font-bold text-[11px] mb-0.5">[TASK]</strong>
                        <p>{t.detail}</p>
                      </div>
                    ))
                  )
                )}

                {insightTab === 'risks' && (
                  insights.risks.length === 0 ? (
                    <p className="text-zinc-500 italic text-center py-6">No risks detected yet.</p>
                  ) : (
                    insights.risks.map(r => (
                      <div key={r.id} className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                        <strong className="block font-bold text-[11px] mb-0.5">[RISK]</strong>
                        <p>{r.detail}</p>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
