'use client';

import React from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
