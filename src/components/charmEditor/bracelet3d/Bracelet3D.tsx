"use client";

import { useEffect, useRef, useState } from 'react';
import type { Charm } from '../../charmEditorUtils';
import { BraceletRenderer } from './renderer';

/**
 * The customer's bracelet in 3D (beta). Drag to turn it, drag up or down to tilt,
 * pinch or scroll to zoom, tap to pause. Calls `onUnavailable` if the device can't draw it,
 * so the pop-up can go back to the 2D view.
 */
export default function Bracelet3D({ slots, onUnavailable }: { slots: (Charm | undefined)[]; onUnavailable?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<BraceletRenderer | null>(null);
  const [playing, setPlaying] = useState(true);
  const [loading, setLoading] = useState(true);
  const unavailable = useRef(onUnavailable);
  unavailable.current = onUnavailable;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const renderer = new BraceletRenderer(canvas, {
        onPlayingChange: setPlaying,
        onError: () => unavailable.current?.(),
      });
      rendererRef.current = renderer;
      setPlaying(renderer.playing);
      return () => { renderer.dispose(); rendererRef.current = null; };
    } catch {
      unavailable.current?.();
    }
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    let current = true;
    renderer.setBracelet(slots)
      .then(() => { if (current) setLoading(false); })
      .catch(() => unavailable.current?.());
    return () => { current = false; };
  }, [slots]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="block w-full touch-none cursor-grab active:cursor-grabbing"
        style={{ height: 'clamp(260px, 72vw, 420px)' }}
        role="img"
        aria-label="Your bracelet in 3D. Drag to turn it, pinch to zoom."
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted pointer-events-none">
          Loading your bracelet…
        </div>
      )}
      <button
        type="button"
        onClick={() => rendererRef.current?.setPlaying(!playing)}
        className="pop absolute right-2 bottom-2 px-3 py-1 rounded-full text-xs font-semibold text-navy bg-white border border-sky-tint"
      >
        {playing ? 'Pause' : 'Spin'}
      </button>
    </div>
  );
}
