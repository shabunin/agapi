import React, { useRef, useState } from 'react';
import { Hand } from 'lucide-react';
import { ToolShell } from '../components/ToolShell';
import { CapabilityTable, type CapRow } from '../components/CapabilityTable';
import { examplesFor } from '../examples';

/**
 * cf-runtime hand-rolls its own gesture recognizer directly on Pixi's
 * FederatedPointerEvent — no @use-gesture/react, no Hammer.js, no gesture
 * layer in framer-motion/motion. See:
 *   packages/cf-runtime/src/components/Gestures.ts (tap/pan/press/swipe)
 *
 * That algorithm (same 12px tap threshold, same dx/dy swipe heuristic) is
 * ported here onto a single big surface — plus real multitouch, which
 * cf-runtime doesn't need (CF panels are single-pointer), using the native
 * Touch Events API (touchstart/move/end/cancel, Touch.identifier) rather
 * than faking it with multiple PointerEvents.
 */

// Same constant as packages/cf-runtime/src/components/Gestures.ts
const TAP_MOVE_THRESHOLD = 12;

function swipeDirection(dx: number, dy: number): string | undefined {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < TAP_MOVE_THRESHOLD && absY < TAP_MOVE_THRESHOLD) return undefined;
  if (absX >= absY) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

function dist(a: TouchPoint, b: TouchPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleDeg(a: TouchPoint, b: TouchPoint): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

const DOT_COLORS = ['#a3e635', '#38bdf8', '#f472b6', '#fbbf24', '#a78bfa'];

function GestureCanvas() {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  const singleStartRef = useRef<TouchPoint | null>(null);
  const multiStartRef = useRef<{ dist: number; angle: number } | null>(null);
  const readoutRef = useRef<{ scale: number; rotation: number } | null>(null);

  const [points, setPoints] = useState<TouchPoint[]>([]);
  const [readout, setReadout] = useState<{ scale: number; rotation: number } | null>(null);
  const [live, setLive] = useState<{ dx: number; dy: number } | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const pushLog = (line: string) => setLog((prev) => [...prev.slice(-60), line]);

  const relTouches = (e: React.TouchEvent<HTMLDivElement>): TouchPoint[] => {
    const rect = surfaceRef.current!.getBoundingClientRect();
    const pts: TouchPoint[] = [];
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      pts.push({ id: t.identifier, x: t.clientX - rect.left, y: t.clientY - rect.top });
    }
    return pts;
  };

  const placeDot = (x: number, y: number) => {
    const dot = dotRef.current;
    if (dot) {
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
    }
  };

  const ripple = (x: number, y: number) => {
    const el = rippleRef.current;
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(
      [
        { opacity: 0.6, transform: 'translate(-50%,-50%) scale(0.2)' },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(2.6)' },
      ],
      { duration: 420, easing: 'ease-out' },
    );
  };

  const flashSwipe = (direction: string) => {
    const el = flashRef.current;
    if (!el) return;
    const from: Record<string, string> = {
      left: 'translateX(28px)',
      right: 'translateX(-28px)',
      up: 'translateY(28px)',
      down: 'translateY(-28px)',
    };
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(
      [
        { opacity: 0.5, transform: from[direction] },
        { opacity: 0, transform: 'translate(0,0)' },
      ],
      { duration: 260, easing: 'ease-out' },
    );
  };

  const applyTarget = (scale: number, rotation: number) => {
    const el = targetRef.current;
    if (!el) return;
    el.getAnimations().forEach((a) => a.cancel());
    el.style.transform = `translate(-50%,-50%) scale(${scale}) rotate(${rotation}deg)`;
  };

  const springBackTarget = () => {
    const el = targetRef.current;
    if (!el) return;
    const current = el.style.transform || 'translate(-50%,-50%) scale(1) rotate(0deg)';
    el.animate([{ transform: current }, { transform: 'translate(-50%,-50%) scale(1) rotate(0deg)' }], {
      duration: 280,
      easing: 'cubic-bezier(.2,.8,.2,1)',
      fill: 'forwards',
    });
  };

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const pts = relTouches(e);
    setPoints(pts);
    if (pts.length === 1) {
      singleStartRef.current = pts[0];
      placeDot(pts[0].x, pts[0].y);
      setLive({ dx: 0, dy: 0 });
      pushLog('pan begin');
      pushLog('press begin');
    } else if (pts.length === 2) {
      multiStartRef.current = { dist: dist(pts[0], pts[1]), angle: angleDeg(pts[0], pts[1]) };
      pushLog('pinch/rotate begin');
    } else if (pts.length > 2) {
      pushLog(`+finger (${pts.length} active)`);
    }
  };

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const pts = relTouches(e);
    setPoints(pts);
    if (pts.length >= 2 && multiStartRef.current) {
      const scale = dist(pts[0], pts[1]) / multiStartRef.current.dist;
      const rotation = angleDeg(pts[0], pts[1]) - multiStartRef.current.angle;
      readoutRef.current = { scale, rotation };
      setReadout({ scale, rotation });
      applyTarget(scale, rotation);
    } else if (pts.length === 1 && singleStartRef.current) {
      placeDot(pts[0].x, pts[0].y);
      setLive({ dx: pts[0].x - singleStartRef.current.x, dy: pts[0].y - singleStartRef.current.y });
    }
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const remaining = relTouches(e);
    const ended = e.changedTouches[0];

    if (points.length >= 2 && remaining.length < 2) {
      const r = readoutRef.current;
      pushLog(r ? `pinch/rotate end — scale ${r.scale.toFixed(2)}, ${r.rotation.toFixed(0)}°` : 'pinch/rotate end');
      multiStartRef.current = null;
      readoutRef.current = null;
      setReadout(null);
      springBackTarget();
    }

    if (points.length === 1 && remaining.length === 0 && singleStartRef.current && ended) {
      const rect = surfaceRef.current!.getBoundingClientRect();
      const p = { x: ended.clientX - rect.left, y: ended.clientY - rect.top };
      const dx = p.x - singleStartRef.current.x;
      const dy = p.y - singleStartRef.current.y;
      const distMoved = Math.hypot(dx, dy);
      const direction = swipeDirection(dx, dy);
      if (distMoved >= TAP_MOVE_THRESHOLD * 2 && direction) {
        pushLog(`swipe → ${direction}`);
        flashSwipe(direction);
      } else if (distMoved < TAP_MOVE_THRESHOLD) {
        pushLog('tap');
        ripple(p.x, p.y);
      }
      pushLog('pan end · press end');
      singleStartRef.current = null;
      setLive(null);
    }

    setPoints(remaining);
  };

  const onTouchCancel = (e: React.TouchEvent<HTMLDivElement>) => {
    const remaining = relTouches(e);
    if (remaining.length < 2 && multiStartRef.current) {
      multiStartRef.current = null;
      readoutRef.current = null;
      setReadout(null);
      springBackTarget();
    }
    if (remaining.length === 0) {
      singleStartRef.current = null;
      setLive(null);
      pushLog('cancel');
    }
    setPoints(remaining);
  };

  return (
    <div className="space-y-3">
      <div
        ref={surfaceRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        className="relative h-72 sm:h-96 rounded-2xl border border-gray-800 bg-gray-950/60 touch-none select-none overflow-hidden"
      >
        <div ref={flashRef} className="absolute inset-0 bg-lime-400 pointer-events-none" style={{ opacity: 0 }} />
        <div
          ref={rippleRef}
          className="absolute w-12 h-12 rounded-full bg-lime-400 pointer-events-none"
          style={{ opacity: 0, left: 0, top: 0 }}
        />
        <div
          ref={dotRef}
          className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow pointer-events-none"
          style={{ opacity: points.length === 1 ? 1 : 0, left: 0, top: 0 }}
        />

        {/* pinch/rotate target, driven directly by touchmove — not WAAPI, matches SliderGauge.ts's direct-set style */}
        <div
          ref={targetRef}
          className="absolute top-1/2 left-1/2 w-24 h-24 rounded-2xl pointer-events-none"
          style={{
            transform: 'translate(-50%,-50%) scale(1) rotate(0deg)',
            background: 'linear-gradient(135deg, #a3e635, #16a34a)',
          }}
        />

        {points.length >= 2 &&
          points.map((p, i) => (
            <div
              key={p.id}
              className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none flex items-center justify-center text-[10px] font-semibold text-gray-950"
              style={{ left: p.x, top: p.y, backgroundColor: DOT_COLORS[i % DOT_COLORS.length] }}
            >
              {i + 1}
            </div>
          ))}

        <div className="absolute top-2 left-2 text-[10px] font-mono text-gray-500 pointer-events-none space-y-0.5">
          <p>fingers: {points.length}</p>
          {readout && (
            <p>
              scale {readout.scale.toFixed(2)} · rotate {readout.rotation.toFixed(0)}°
            </p>
          )}
          {live && (
            <p>
              dx {live.dx.toFixed(0)} · dy {live.dy.toFixed(0)}
            </p>
          )}
        </div>

        {points.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-gray-600 pointer-events-none">
            tap · drag · swipe · pinch with two fingers · touchscreen or devtools touch emulation
          </p>
        )}
      </div>

      <pre className="rounded-xl border border-gray-800 bg-black/40 p-2.5 text-[11px] font-mono text-gray-400 max-h-32 overflow-auto whitespace-pre-wrap">
        {log.length ? log.join('\n') : '— event log —'}
      </pre>
    </div>
  );
}

export default function GesturesTool({ onBack }: { onBack: () => void }) {
  const rows: CapRow[] = capabilityRows();

  return (
    <ToolShell
      title="Gestures"
      surface="Touch Events (touchstart/move/end/cancel) — cf-runtime's algorithm, ported"
      status="lab"
      onBack={onBack}
      examples={examplesFor('gestures')}
    >
      <div className="p-4 max-w-3xl mx-auto space-y-4">
        <p className="text-sm text-gray-400 leading-relaxed">
          <code className="text-gray-300">cf-runtime</code> doesn't use a gesture library — no{' '}
          <code className="text-gray-300">@use-gesture/react</code>, no Hammer.js. It hand-rolls tap/pan/press/swipe
          detection directly on Pixi's pointer events (
          <code className="text-gray-300">packages/cf-runtime/src/components/Gestures.ts</code>). This canvas ports
          that exact algorithm — same 12px tap threshold, same dx/dy swipe-direction heuristic — and adds real
          multitouch on top via the native{' '}
          <code className="text-gray-300">Touch Events API</code>: two fingers pinch/rotate a target shape, tracked
          by <code className="text-gray-300">Touch.identifier</code>.
        </p>
        <CapabilityTable rows={rows} />
        <section className="rounded-2xl border border-gray-800 bg-gray-900/40 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 bg-lime-500/15 border-lime-500/30 text-lime-400">
              <Hand size={16} />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-200">Gesture canvas</h2>
              <p className="text-[11px] font-mono text-gray-600 truncate">
                tap · pan · swipe · pinch · rotate — multitouch
              </p>
            </div>
          </div>
          <GestureCanvas />
          <p className="text-[11px] text-gray-600">
            No touchscreen? Chrome DevTools → toggle device toolbar → touch simulation lets a mouse drive multiple
            synthetic touch points for pinch/rotate testing.
          </p>
        </section>
      </div>
    </ToolShell>
  );
}

function capabilityRows(): CapRow[] {
  const hasTouchEvent = typeof TouchEvent !== 'undefined';
  const hasTouchStart = typeof window !== 'undefined' && 'ontouchstart' in window;
  const hasMaxTouchPoints = typeof navigator !== 'undefined' && typeof navigator.maxTouchPoints === 'number';
  return [
    { name: 'TouchEvent', supported: hasTouchEvent, detail: 'touches / targetTouches / changedTouches' },
    { name: "'ontouchstart' in window", supported: hasTouchStart, detail: hasTouchStart ? 'touch-capable webview' : 'mouse-only host — pinch/rotate needs devtools emulation' },
    {
      name: 'navigator.maxTouchPoints',
      supported: hasMaxTouchPoints,
      detail: hasMaxTouchPoints ? String((navigator as Navigator).maxTouchPoints) : undefined,
    },
  ];
}
