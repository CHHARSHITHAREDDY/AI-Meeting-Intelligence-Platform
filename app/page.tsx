'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  ArrowRight, 
  Play, 
  Sparkles, 
  Terminal, 
  ChevronDown 
} from 'lucide-react';

export default function LandingPage() {
  const [stage, setStage] = useState(0);
  const [alexText, setAlexText] = useState('');
  const [samText, setSamText] = useState('');
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  
  const auroraRef = useRef<HTMLDivElement>(null);
  const tickerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fullAlexText = "We need to finalize the Q3 roadmap by Friday.";
  const fullSamText = "I can commit to the API refactor, but the dashboard will spill over.";

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.user) setUser(data.user); })
      .catch(() => setUser(null));
  }, []);

  const handleCtaMouseEnter = (e: React.MouseEvent<HTMLElement>) => {};
  const handleCtaMouseLeave = (e: React.MouseEvent<HTMLElement>) => {};

  // WebGL Shader Animation Effect (STITCH Shader ANIMATION_3)
  useEffect(() => {
    const canvas = document.getElementById('shader-canvas-ANIMATION_3') as HTMLCanvasElement | null;
    if (!canvas) return;

    function syncSize() {
      if (!canvas) return;
      const w = canvas.clientWidth || 1280;
      const h = canvas.clientHeight || 720;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(syncSize);
      resizeObserver.observe(canvas);
    }
    syncSize();

    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return;

    const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

    const fs = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float time = u_time * 0.2;
    vec3 color1 = vec3(0.388, 0.4, 0.945); // Indigo (#6366F1)
    vec3 color2 = vec3(0.133, 0.827, 0.933); // Cyan (#22D3EE)
    vec3 color3 = vec3(0.925, 0.282, 0.6);  // Magenta (#EC4899)
    float n1 = snoise(uv * 1.5 + time) * 0.5 + 0.5;
    float n2 = snoise(uv * 1.2 - time * 0.7) * 0.5 + 0.5;
    vec3 mixed = mix(color1, color2, n1);
    mixed = mix(mixed, color3, n2 * 0.5);
    float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453) * 0.05;
    gl_FragColor = vec4(mixed * 0.4 + grain, 1.0);
}`;

    function cs(type: number, src: string) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      return s;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, cs(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, cs(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_resolution');

    let animationFrameId: number;
    function render(t: number) {
      syncSize();
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      if (uTime) gl!.uniform1f(uTime, t * 0.001);
      if (uRes) gl!.uniform2f(uRes, canvas!.width, canvas!.height);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      animationFrameId = requestAnimationFrame(render);
    }
    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (stage === 0) {
      setAlexText(''); setSamText('');
      timer = setTimeout(() => setStage(1), 1200);
    } else if (stage === 1) {
      let i = 0;
      const interval = setInterval(() => {
        if (i <= fullAlexText.length) { setAlexText(fullAlexText.substring(0, i)); i++; }
        else { clearInterval(interval); setStage(2); }
      }, 35);
      return () => clearInterval(interval);
    } else if (stage === 2) {
      timer = setTimeout(() => {
        let i = 0;
        const interval = setInterval(() => {
          if (i <= fullSamText.length) { setSamText(fullSamText.substring(0, i)); i++; }
          else { clearInterval(interval); setStage(3); }
        }, 35);
        return () => clearInterval(interval);
      }, 800);
    } else if (stage === 3) {
      timer = setTimeout(() => setStage(4), 2200);
    } else if (stage === 4) {
      timer = setTimeout(() => setStage(0), 5500);
    }
    return () => clearTimeout(timer);
  }, [stage]);

  const tickerItems = [
    "Who committed to what?", "Endless status meetings", "Decisions lost in slack",
    "No searchable memory", "Action items falling through", "Forgotten risks",
    "Who committed to what?", "Endless status meetings", "Decisions lost in slack",
    "No searchable memory", "Action items falling through", "Forgotten risks",
  ];

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0f131c] text-[#dfe2ef] relative overflow-hidden flex flex-col font-sans bg-grid-pattern selection:bg-[#8083ff]/30 selection:text-[#c0c1ff]">
      {/* Background Aurora Mesh for GSAP item 1 */}
      <div 
        ref={auroraRef} 
        className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-gradient-to-br from-[#6366F1]/20 via-[#22D3EE]/15 to-[#EC4899]/20 rounded-full blur-[140px] pointer-events-none -z-10" 
      />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-gradient-to-tl from-[#EC4899]/15 via-[#6366F1]/20 to-transparent rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-[#232B45] bg-[#0f131c]/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-[#6366F1] flex items-center justify-center text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined font-bold text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
            </div>
            <div>
              <span className="text-lg font-bold font-display tracking-tight text-[#F8FAFC]">Cue Intelligence</span>
              <p className="text-[9px] text-[#94A3B8] uppercase tracking-widest font-mono -mt-1">Enterprise Suite</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#94A3B8]">
            <a href="#platform" className="hover:text-[#6366F1] transition-colors">Platform</a>
            <a href="#features" className="hover:text-[#6366F1] transition-colors">Features</a>
            <a href="#enterprise" className="hover:text-[#6366F1] transition-colors">Enterprise</a>
            <a href="#pricing" className="hover:text-[#6366F1] transition-colors">Pricing</a>
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-xs font-medium text-[#c0c1ff] font-mono hidden sm:inline-block">
                  Logged in as <strong className="text-[#F8FAFC]">{user.name}</strong>
                </span>
                <Link
                  href="/dashboard/live"
                  onMouseEnter={handleCtaMouseEnter}
                  onMouseLeave={handleCtaMouseLeave}
                  className="px-5 py-2.5 rounded-lg text-[12px] btn-primary-cta uppercase tracking-wider flex items-center gap-2"
                >
                  Go to Dashboard
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-semibold text-[#c7c4d7] hover:text-[#6366F1] transition hidden sm:inline-block">
                  Sign In
                </Link>
                <Link
                  href="/login"
                  onMouseEnter={handleCtaMouseEnter}
                  onMouseLeave={handleCtaMouseLeave}
                  className="px-5 py-2.5 rounded-lg text-[12px] btn-primary-cta uppercase tracking-wider"
                >
                  Request Demo
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero with WebGL Shader Canvas */}
      <main className="flex-1 flex flex-col justify-center">
        <section className="relative min-h-[85vh] flex items-center justify-center pt-16 pb-20 overflow-hidden">
          {/* STITCH WEBGL SHADER CANVAS BACKGROUND */}
          <div className="absolute inset-0 z-0 opacity-70">
            <canvas id="shader-canvas-ANIMATION_3" className="block w-full h-full pointer-events-none" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-8 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#181b25]/80 border border-[#232B45] text-xs text-[#c0c1ff] font-semibold backdrop-blur-md">
                <Sparkles className="w-4 h-4 text-[#5de6ff]" />
                <span>Next-Gen Audio Intelligence Platform</span>
              </div>

              <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight font-display leading-[1.1] text-[#F8FAFC]">
                Meetings end.<br />
                <span className="bg-gradient-to-r from-[#c0c1ff] via-[#5de6ff] to-[#ffb0cd] bg-clip-text text-transparent">
                  The intelligence doesn&apos;t.
                </span>
              </h1>

              <p className="text-[#c7c4d7] text-lg sm:text-xl font-normal leading-relaxed max-w-2xl">
                Beyond transcripts. Cue captures decisions, predicts risks, and builds your organization&apos;s memory in real-time.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                <Link
                  href={user ? "/dashboard/live" : "/login"}
                  onMouseEnter={handleCtaMouseEnter}
                  onMouseLeave={handleCtaMouseLeave}
                  className="px-8 py-4 rounded-xl text-sm font-bold tracking-wide btn-primary-cta text-center flex items-center justify-center gap-2 group cursor-pointer"
                >
                  {user ? 'Go to Dashboard' : 'Start Free'}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href={user ? "/dashboard/live" : "/login"}
                  className="px-8 py-4 rounded-xl text-sm font-bold tracking-wide text-[#F8FAFC] bg-[#181b25] border border-[#232B45] hover:bg-[#262a34] transition-all text-center flex items-center justify-center gap-2 backdrop-blur-md"
                >
                  <Play className="w-4 h-4 text-[#5de6ff] fill-[#5de6ff]" />
                  Watch Demo
                </Link>
              </div>
            </div>

            {/* Right Column: Live Recording Card */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-md bg-[#12172A] border border-[#232B45] rounded-2xl p-6 shadow-2xl backdrop-blur-xl relative">
                <div className="absolute -inset-0.5 bg-gradient-to-tr from-[#c0c1ff]/20 to-[#5de6ff]/20 rounded-2xl blur-xl -z-10" />

                {/* Card Header */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#232B45]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#34D399] animate-live-pulse" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] font-mono">Live Recording</span>
                  </div>
                  <div className="flex items-end gap-1 h-5 overflow-hidden">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={`w-1 bg-[#5de6ff] rounded-full soundwave-bar soundwave-bar-${i} h-full`} />
                    ))}
                  </div>
                </div>

                {/* Simulated Transcript */}
                <div className="space-y-5 min-h-[180px] flex flex-col justify-start">
                  {stage >= 1 && (
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-[#5de6ff] font-mono">[Alex - PM]</span>
                      <p className="text-sm text-[#dfe2ef] font-medium pl-1 leading-relaxed">
                        {alexText}
                        {stage === 1 && <span className="inline-block w-1.5 h-4 ml-0.5 bg-[#5de6ff] animate-pulse" />}
                      </p>
                    </div>
                  )}
                  {stage >= 2 && (
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-[#ffb0cd] font-mono">[Sam - Eng]</span>
                      <p className="text-sm text-[#dfe2ef] font-medium pl-1 leading-relaxed">
                        {samText}
                        {stage === 2 && <span className="inline-block w-1.5 h-4 ml-0.5 bg-[#ffb0cd] animate-pulse" />}
                      </p>
                    </div>
                  )}
                  {stage === 3 && (
                    <div className="flex items-center gap-2 bg-[#00cbe6]/10 border border-[#5de6ff]/30 rounded-xl p-3 text-xs text-[#5de6ff] font-semibold animate-pulse mt-4">
                      <div className="w-4 h-4 border-2 border-[#5de6ff] border-t-transparent rounded-full animate-spin shrink-0" />
                      <span>[Cue AI] Extracting commitments and planning risk models...</span>
                    </div>
                  )}
                  {stage === 4 && (
                    <div className="space-y-3 bg-[#181b25] border border-[#232B45] rounded-xl p-4 mt-4 shadow-inner relative overflow-hidden">
                      <div className="absolute top-0 right-0 px-2 py-0.5 bg-[#c0c1ff]/10 text-[#c0c1ff] border-l border-b border-[#232B45] text-[9px] font-bold uppercase tracking-wider rounded-bl-lg font-mono">
                        Extracted
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#c0c1ff] flex items-center gap-1.5 font-mono">
                        <Terminal className="w-3.5 h-3.5 text-[#5de6ff]" />
                        <span>Intelligence Output</span>
                      </div>
                      <div className="space-y-2 text-xs text-[#dfe2ef]">
                        <div className="flex items-start gap-2 bg-[#1c1f29] p-2.5 rounded border border-[#232B45]">
                          <span className="text-[#34D399] font-bold shrink-0 mt-0.5">✓</span>
                          <div>
                            <span className="font-semibold text-[#F8FAFC]">Action:</span> Finalize Q3 roadmap by Friday.
                            <span className="text-[10px] text-[#94A3B8] block mt-0.5 font-mono">Assignee: Alex • Due: Friday</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 bg-[#1c1f29] p-2.5 rounded border border-[#232B45]">
                          <span className="text-[#ffb4ab] font-bold shrink-0 mt-0.5">⚠</span>
                          <div>
                            <span className="font-semibold text-[#F8FAFC]">Risk:</span> Dashboard completion delay due to API refactor.
                            <span className="text-[10px] text-[#94A3B8] block mt-0.5 font-mono">Mitigation: Schedule dashboard MVP checkpoint</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Scroll Indicator */}
        <div className="flex justify-center pb-8 animate-bounce">
          <ChevronDown className="w-6 h-6 text-[#94A3B8]" />
        </div>

        {/* Infinite Ticker with GSAP Marquee (Item 6) */}
        <section className="border-y border-[#232B45] bg-[#0a0e17]/60 py-6 overflow-hidden relative">
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#0f131c] to-transparent pointer-events-none z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#0f131c] to-transparent pointer-events-none z-10" />
          <div className="flex w-max" ref={tickerRef}>
            {/* Original content + Duplicated content for seamless 0 to -50% loop */}
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <div key={i} className="px-5 py-2.5 mx-3 rounded-full bg-[#181b25] border border-[#232B45] text-[#c7c4d7] text-xs font-semibold tracking-wide flex items-center gap-2.5 whitespace-nowrap shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ffb0cd]" />
                {item}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* CTA Section */}
      <section className="border-t border-[#232B45] py-24 bg-[#0a0e17]/50 relative">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-8">
          <h2 className="text-4xl font-extrabold font-display text-[#F8FAFC] tracking-tight">
            Ready to upgrade your organization&apos;s memory?
          </h2>
          <p className="text-[#94A3B8] text-base max-w-xl mx-auto leading-relaxed">
            Join forward-thinking teams using Cue to turn conversations into actionable intelligence.
          </p>
          <div className="pt-2">
            <Link
              href={user ? "/dashboard/live" : "/login"}
              onMouseEnter={handleCtaMouseEnter}
              onMouseLeave={handleCtaMouseLeave}
              className="px-8 py-4 rounded-xl text-sm font-bold tracking-wide btn-primary-cta inline-flex items-center gap-2"
            >
              Get Started Now
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#232B45] bg-[#0a0e17] py-12 text-sm text-[#94A3B8] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2.5">
              <div className="w-6 h-6 rounded bg-[#c0c1ff] flex items-center justify-center text-[#1000a9]">
                <span className="material-symbols-outlined font-bold text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
              </div>
              <span className="font-bold text-[#dfe2ef] font-display">Cue Intelligence</span>
            </div>
            <p className="text-xs text-[#94A3B8]/60">
              © {new Date().getFullYear()} Cue Intelligence. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-8 text-xs font-medium">
            <a href="#" className="hover:text-[#c0c1ff] transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-[#c0c1ff] transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-[#c0c1ff] transition-colors">Security</a>
          </div>
          <div className="px-3.5 py-1.5 rounded-full bg-[#181b25] border border-[#232B45] flex items-center gap-2 text-xs font-semibold text-[#94A3B8]">
            <span className="w-2 h-2 rounded-full bg-[#34D399] animate-live-pulse" />
            System Status: Live
          </div>
        </div>
      </footer>
    </div>
  );
}

