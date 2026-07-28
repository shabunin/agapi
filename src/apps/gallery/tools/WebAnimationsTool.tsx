import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlignJustify,
  Fan,
  Filter,
  GalleryHorizontal,
  Images,
  Lightbulb,
  ListPlus,
  Loader,
  Lock,
  Palette,
  Shuffle,
  SunDim,
  Thermometer,
  Unlock,
  LayoutGrid,
} from 'lucide-react';
import { ToolShell } from '../components/ToolShell';
import { CapabilityTable, type CapRow } from '../components/CapabilityTable';
import { examplesFor } from '../examples';

/**
 * Every demo below drives the DOM with the *native* Web Animations API
 * (`el.animate(...)`, the returned `Animation`'s `.playbackRate` / `.pause()`
 * / `.play()` / `.finished`) — no CSS transitions, no animation library.
 * Not an agapi.* surface: this documents what the webview already gives a
 * CF-style dashboard for free.
 */

const ACCENT: Record<string, string> = {
  amber: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
  sky: 'bg-sky-500/15 border-sky-500/30 text-sky-400',
  orange: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
  indigo: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400',
  emerald: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  cyan: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
  fuchsia: 'bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-400',
  violet: 'bg-violet-500/15 border-violet-500/30 text-violet-400',
  rose: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
  teal: 'bg-teal-500/15 border-teal-500/30 text-teal-400',
  blue: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
  lime: 'bg-lime-500/15 border-lime-500/30 text-lime-400',
};

function DemoCard({
  icon: Icon,
  accent,
  title,
  api,
  children,
}: {
  icon: LucideIcon;
  accent: keyof typeof ACCENT;
  title: string;
  api: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/40 p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <span
          className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${ACCENT[accent]}`}
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
          <p className="text-[11px] font-mono text-gray-600 truncate">{api}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

// ── 1. Smart bulb — flicker-on keyframes ─────────────────────────────

function SmartBulbDemo() {
  const bulbRef = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  const toggle = () => {
    const bulb = bulbRef.current;
    if (!bulb) return;
    const turningOn = !on;
    setOn(turningOn);
    bulb.getAnimations().forEach((a) => a.cancel());
    if (turningOn) {
      bulb.animate(
        [
          { opacity: 0.35, filter: 'brightness(0.4) saturate(0.6)', offset: 0 },
          { opacity: 1, filter: 'brightness(1.6) saturate(1.3)', offset: 0.55 },
          { opacity: 1, filter: 'brightness(1) saturate(1)', offset: 1 },
        ],
        { duration: 450, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
      );
    } else {
      bulb.animate([{ opacity: 1, filter: 'brightness(1)' }, { opacity: 0.25, filter: 'brightness(0.3)' }], {
        duration: 280,
        easing: 'ease-in',
        fill: 'forwards',
      });
    }
  };

  return (
    <DemoCard icon={Lightbulb} accent="amber" title="Smart bulb" api="el.animate(keyframes[])">
      <div className="flex items-center gap-4">
        <div
          ref={bulbRef}
          className="w-14 h-14 rounded-full bg-amber-300 shadow-[0_0_24px_8px_rgba(252,211,77,0.55)]"
          style={{ opacity: 0.25, filter: 'brightness(0.3)' }}
        />
        <button
          type="button"
          onClick={toggle}
          className="px-4 py-2 rounded-lg bg-amber-500/90 hover:bg-amber-500 text-sm font-medium text-gray-950"
        >
          {on ? 'Turn off' : 'Turn on'}
        </button>
      </div>
      <p className="text-[11px] text-gray-600">Overshoot-and-settle keyframes fake a filament flicker.</p>
    </DemoCard>
  );
}

// ── 2. Dimmer — decoupled target vs. eased knob position ─────────────

function DimmerDemo() {
  const [level, setLevel] = useState(40);
  const knobRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const prevRef = useRef(40);

  useEffect(() => {
    const from = prevRef.current;
    knobRef.current?.animate([{ left: `${from}%` }, { left: `${level}%` }], {
      duration: 220,
      easing: 'ease-out',
      fill: 'forwards',
    });
    glowRef.current?.animate([{ opacity: from / 100 }, { opacity: level / 100 }], {
      duration: 220,
      easing: 'ease-out',
      fill: 'forwards',
    });
    prevRef.current = level;
  }, [level]);

  return (
    <DemoCard icon={SunDim} accent="sky" title="Dimmer" api="animate({ left }) on input">
      <div className="space-y-3">
        <div className="relative h-3 rounded-full bg-gray-800 overflow-visible">
          <div ref={glowRef} className="absolute inset-0 rounded-full bg-sky-400" style={{ opacity: 0.4 }} />
          <div
            ref={knobRef}
            className="absolute top-1/2 w-5 h-5 rounded-full bg-white shadow-md -translate-y-1/2 -translate-x-1/2"
            style={{ left: '40%' }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          className="w-full accent-sky-500"
        />
      </div>
      <p className="text-[11px] text-gray-600">
        The slider jumps instantly; the knob and glow ease toward it — target and visual state are decoupled ({level}%).
      </p>
    </DemoCard>
  );
}

// ── 3. Thermostat — rotating needle + interpolated color ──────────────

const TEMP_STOPS: [number, [number, number, number]][] = [
  [10, [56, 189, 248]],
  [20, [52, 211, 153]],
  [25, [251, 191, 36]],
  [30, [248, 113, 113]],
];

function tempColor(t: number): string {
  const clamped = Math.max(10, Math.min(30, t));
  for (let i = 0; i < TEMP_STOPS.length - 1; i++) {
    const [t0, c0] = TEMP_STOPS[i];
    const [t1, c1] = TEMP_STOPS[i + 1];
    if (clamped >= t0 && clamped <= t1) {
      const f = (clamped - t0) / (t1 - t0);
      const rgb = c0.map((v, idx) => Math.round(v + (c1[idx] - v) * f));
      return `rgb(${rgb.join(',')})`;
    }
  }
  return 'rgb(148,163,184)';
}

function ThermostatDemo() {
  const [temp, setTemp] = useState(21);
  const needleRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const prevAngleRef = useRef(0);
  const prevColorRef = useRef(tempColor(21));

  const angleFor = (t: number) => -90 + ((t - 10) / 20) * 180;

  useEffect(() => {
    const angle = angleFor(temp);
    needleRef.current?.animate([{ transform: `rotate(${prevAngleRef.current}deg)` }, { transform: `rotate(${angle}deg)` }], {
      duration: 380,
      easing: 'cubic-bezier(.34,1.56,.64,1)',
      fill: 'forwards',
    });
    const color = tempColor(temp);
    dialRef.current?.animate([{ backgroundColor: prevColorRef.current }, { backgroundColor: color }], {
      duration: 380,
      easing: 'ease-out',
      fill: 'forwards',
    });
    prevAngleRef.current = angle;
    prevColorRef.current = color;
  }, [temp]);

  return (
    <DemoCard icon={Thermometer} accent="orange" title="Thermostat" api="animate({ transform, backgroundColor })">
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 rounded-full border-4 border-gray-800 flex items-center justify-center">
          <div
            ref={needleRef}
            className="absolute w-0.5 h-7 bg-white rounded-full origin-bottom bottom-1/2 left-1/2 -translate-x-1/2"
            style={{ transform: `rotate(${angleFor(21)}deg)` }}
          />
          <div
            ref={dialRef}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold text-gray-950"
            style={{ backgroundColor: tempColor(21) }}
          >
            {temp}°
          </div>
        </div>
        <input
          type="range"
          min={10}
          max={30}
          value={temp}
          onChange={(e) => setTemp(Number(e.target.value))}
          className="flex-1 accent-orange-500"
        />
      </div>
      <p className="text-[11px] text-gray-600">Needle uses a springy easing curve; readout color is a hand-lerped keyframe pair.</p>
    </DemoCard>
  );
}

// ── 4. Blinds — staggered per-slat animate() ───────────────────────────

const SLAT_COUNT = 7;

function BlindsDemo() {
  const [open, setOpen] = useState(false);
  const slatRefs = useRef<(HTMLDivElement | null)[]>([]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    slatRefs.current.forEach((slat, i) => {
      if (!slat) return;
      slat.getAnimations().forEach((a) => a.cancel());
      slat.animate(
        next ? [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }] : [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
        { duration: 260, delay: i * 35, easing: 'ease-out', fill: 'forwards' },
      );
    });
  };

  return (
    <DemoCard icon={AlignJustify} accent="indigo" title="Blinds" api="delay: i * 35 (stagger)">
      <div className="relative h-24 rounded-lg overflow-hidden bg-gradient-to-b from-sky-400/40 to-sky-200/20 border border-gray-800">
        <div className="absolute inset-0 flex flex-col gap-[3px] p-1">
          {Array.from({ length: SLAT_COUNT }).map((_, i) => (
            <div
              key={i}
              ref={(el) => {
                slatRefs.current[i] = el;
              }}
              className="flex-1 bg-gray-300 rounded-sm origin-top"
              style={{ transform: 'scaleY(1)' }}
            />
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        className="px-4 py-2 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-sm font-medium"
      >
        {open ? 'Close' : 'Open'}
      </button>
    </DemoCard>
  );
}

// ── 5. Smart lock — shake gated by Animation.finished ──────────────────

function LockDemo() {
  const [locked, setLocked] = useState(true);
  const [busy, setBusy] = useState(false);
  const boltRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    const el = boltRef.current;
    if (!el || busy) return;
    setBusy(true);
    const shake = el.animate(
      [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-10deg)' },
        { transform: 'rotate(10deg)' },
        { transform: 'rotate(-5deg)' },
        { transform: 'rotate(0deg)' },
      ],
      { duration: 340, easing: 'ease-in-out' },
    );
    shake.finished
      .then(() => setLocked((v) => !v))
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  const Icon = locked ? Lock : Unlock;

  return (
    <DemoCard icon={Icon} accent="emerald" title="Smart lock" api="animation.finished.then(...)">
      <div className="flex items-center gap-4">
        <div ref={boltRef} className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center">
          <Icon size={22} className={locked ? 'text-emerald-400' : 'text-amber-400'} />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={toggle}
          className="px-4 py-2 rounded-lg bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium"
        >
          {busy ? 'Working…' : locked ? 'Unlock' : 'Lock'}
        </button>
      </div>
      <p className="text-[11px] text-gray-600">State flips only after the shake's `finished` promise resolves — not a timeout.</p>
    </DemoCard>
  );
}

// ── 6. Ceiling fan — playbackRate on a live Infinite animation ─────────

const FAN_SPEEDS: { label: string; rate: number }[] = [
  { label: 'Off', rate: 0 },
  { label: 'Low', rate: 1 },
  { label: 'Med', rate: 2.5 },
  { label: 'High', rate: 5 },
];

function FanDemo() {
  const fanRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const [speed, setSpeed] = useState('Off');

  useEffect(() => {
    const el = fanRef.current;
    if (!el) return;
    const anim = el.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
      duration: 1000,
      iterations: Infinity,
      easing: 'linear',
    });
    anim.pause();
    animRef.current = anim;
    return () => anim.cancel();
  }, []);

  const setRate = (label: string, rate: number) => {
    setSpeed(label);
    const anim = animRef.current;
    if (!anim) return;
    if (rate === 0) {
      anim.pause();
      return;
    }
    anim.playbackRate = rate;
    if (anim.playState === 'paused' || anim.playState === 'idle') anim.play();
  };

  return (
    <DemoCard icon={Fan} accent="cyan" title="Ceiling fan" api="animation.playbackRate = n">
      <div className="flex items-center gap-4">
        <div ref={fanRef} className="w-14 h-14 flex items-center justify-center text-cyan-300">
          <Fan size={40} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FAN_SPEEDS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setRate(s.label, s.rate)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                speed === s.label
                  ? 'bg-cyan-600/90 border-cyan-500 text-white'
                  : 'border-gray-700 text-gray-300 hover:bg-gray-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-gray-600">
        One Infinite animation runs forever — speed changes are just `playbackRate`, never a restart.
      </p>
    </DemoCard>
  );
}

// ── 7. RGB bulb — Infinite alternating loop, pause()/play() for party mode ──

const PARTY_COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#a78bfa', '#f87171'];
const SWATCHES = ['#f87171', '#facc15', '#4ade80', '#38bdf8', '#a78bfa', '#f472b6'];

function PartyBulbDemo() {
  const bulbRef = useRef<HTMLDivElement>(null);
  const partyAnimRef = useRef<Animation | null>(null);
  const [partyOn, setPartyOn] = useState(false);

  useEffect(() => {
    const el = bulbRef.current;
    if (!el) return;
    const anim = el.animate(
      PARTY_COLORS.map((backgroundColor) => ({ backgroundColor })),
      { duration: 4000, iterations: Infinity, easing: 'ease-in-out' },
    );
    anim.pause();
    partyAnimRef.current = anim;
    return () => anim.cancel();
  }, []);

  const toggleParty = () => {
    const anim = partyAnimRef.current;
    if (!anim) return;
    if (partyOn) {
      anim.pause();
    } else {
      anim.play();
    }
    setPartyOn(!partyOn);
  };

  const setColor = (hex: string) => {
    const el = bulbRef.current;
    const anim = partyAnimRef.current;
    if (!el || !anim) return;
    anim.pause();
    setPartyOn(false);
    const from = getComputedStyle(el).backgroundColor;
    el.animate([{ backgroundColor: from }, { backgroundColor: hex }], {
      duration: 250,
      easing: 'ease-out',
      fill: 'forwards',
    });
  };

  return (
    <DemoCard icon={Palette} accent="fuchsia" title="RGB bulb" api="animation.pause() / .play()">
      <div className="flex items-center gap-4">
        <div ref={bulbRef} className="w-14 h-14 rounded-full shadow-lg" style={{ backgroundColor: PARTY_COLORS[0] }} />
        <div className="space-y-2">
          <button
            type="button"
            onClick={toggleParty}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              partyOn ? 'bg-fuchsia-600 hover:bg-fuchsia-500' : 'bg-fuchsia-600/90 hover:bg-fuchsia-600'
            }`}
          >
            {partyOn ? 'Stop party mode' : 'Party mode'}
          </button>
          <div className="flex gap-1.5">
            {SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => setColor(hex)}
                className="w-5 h-5 rounded-full border border-white/20"
                style={{ backgroundColor: hex }}
                title={hex}
              />
            ))}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-gray-600">
        Party mode is one looping Infinite animation, just paused/resumed. Picking a swatch pauses it and animates a one-off transition instead.
      </p>
    </DemoCard>
  );
}

// ── 8. Card entrance — staggered fade + scale-in ────────────────────────

const CARD_LABELS = ['Living room', 'Kitchen', 'Bedroom', 'Garage', 'Garden'];

function CardStaggerDemo() {
  const [shown, setShown] = useState(false);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const toggle = () => {
    const next = !shown;
    setShown(next);
    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      card.getAnimations().forEach((a) => a.cancel());
      card.animate(
        next
          ? [
              { opacity: 0, transform: 'translateY(18px) scale(0.94)' },
              { opacity: 1, transform: 'translateY(0) scale(1)' },
            ]
          : [
              { opacity: 1, transform: 'translateY(0) scale(1)' },
              { opacity: 0, transform: 'translateY(8px) scale(0.96)' },
            ],
        {
          duration: next ? 420 : 180,
          delay: next ? i * 70 : 0,
          easing: next ? 'cubic-bezier(.34,1.56,.64,1)' : 'ease-in',
          fill: 'forwards',
        },
      );
    });
  };

  return (
    <DemoCard icon={LayoutGrid} accent="violet" title="Card entrance" api="delay: i * 70 (stagger)">
      <div className="grid grid-cols-3 gap-1.5">
        {CARD_LABELS.map((label, i) => (
          <div
            key={label}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className="rounded-lg border border-gray-800 bg-gray-800/60 px-2 py-2.5 text-[10px] text-gray-300 text-center"
            style={{ opacity: 0, transform: 'translateY(18px) scale(0.94)' }}
          >
            {label}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={toggle}
        className="px-4 py-2 rounded-lg bg-violet-600/90 hover:bg-violet-600 text-sm font-medium"
      >
        {shown ? 'Hide' : 'Show cards'}
      </button>
    </DemoCard>
  );
}

// ── 9. List insert/remove — enter on mount ref, exit gated by finished ──

let listSeq = 0;

function ListInsertRemoveDemo() {
  const [items, setItems] = useState(() => [
    { id: listSeq++, label: 'Front door sensor' },
    { id: listSeq++, label: 'Motion — hallway' },
  ]);
  const nodeMap = useRef(new Map<number, HTMLDivElement>());
  const enteredIds = useRef(new Set<number>());

  const add = () => {
    setItems((prev) => [...prev, { id: listSeq++, label: `Device ${listSeq}` }]);
  };

  const remove = (id: number) => {
    const el = nodeMap.current.get(id);
    if (!el) {
      setItems((prev) => prev.filter((it) => it.id !== id));
      return;
    }
    const anim = el.animate(
      [
        { opacity: 1, transform: 'translateX(0)' },
        { opacity: 0, transform: 'translateX(-16px)' },
      ],
      { duration: 200, easing: 'ease-in' },
    );
    anim.finished
      .then(() => setItems((prev) => prev.filter((it) => it.id !== id)))
      .catch(() => setItems((prev) => prev.filter((it) => it.id !== id)));
  };

  return (
    <DemoCard icon={ListPlus} accent="rose" title="Add / remove list" api="animation.finished before unmount">
      <div className="space-y-1.5 min-h-[88px]">
        {items.map((item) => (
          <div
            key={item.id}
            ref={(el) => {
              if (el) {
                nodeMap.current.set(item.id, el);
                if (!enteredIds.current.has(item.id)) {
                  enteredIds.current.add(item.id);
                  el.animate(
                    [
                      { opacity: 0, transform: 'translateX(-12px)' },
                      { opacity: 1, transform: 'translateX(0)' },
                    ],
                    { duration: 220, easing: 'ease-out' },
                  );
                }
              } else {
                nodeMap.current.delete(item.id);
              }
            }}
            className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/50 px-3 py-1.5 text-xs text-gray-300"
          >
            <span className="truncate">{item.label}</span>
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="ml-2 shrink-0 text-gray-500 hover:text-rose-400"
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-gray-600 py-2">No items.</p>}
      </div>
      <button
        type="button"
        onClick={add}
        className="px-4 py-2 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-sm font-medium"
      >
        Add item
      </button>
    </DemoCard>
  );
}

// ── 10. Shuffle — FLIP reorder (First/Last/Invert/Play) ─────────────────

const FLIP_ITEMS: { key: string; color: string }[] = [
  { key: 'A', color: '#f87171' },
  { key: 'B', color: '#facc15' },
  { key: 'C', color: '#4ade80' },
  { key: 'D', color: '#38bdf8' },
  { key: 'E', color: '#a78bfa' },
];

function ReorderFlipDemo() {
  const [order, setOrder] = useState(FLIP_ITEMS.map((it) => it.key));
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const firstRectsRef = useRef<Map<string, DOMRect> | null>(null);

  const shuffle = () => {
    const rects = new Map<string, DOMRect>();
    itemRefs.current.forEach((el, key) => rects.set(key, el.getBoundingClientRect()));
    firstRectsRef.current = rects;
    setOrder((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
  };

  useLayoutEffect(() => {
    const firsts = firstRectsRef.current;
    if (!firsts) return;
    itemRefs.current.forEach((el, key) => {
      const first = firsts.get(key);
      if (!first) return;
      const last = el.getBoundingClientRect();
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      if (dx || dy) {
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
          duration: 340,
          easing: 'cubic-bezier(.2,.8,.2,1)',
        });
      }
    });
    firstRectsRef.current = null;
  }, [order]);

  return (
    <DemoCard icon={Shuffle} accent="teal" title="Shuffle (FLIP)" api="First/Last/Invert/Play">
      <div className="flex gap-1.5 flex-wrap">
        {order.map((key) => {
          const item = FLIP_ITEMS.find((it) => it.key === key)!;
          return (
            <div
              key={key}
              ref={(el) => {
                if (el) itemRefs.current.set(key, el);
                else itemRefs.current.delete(key);
              }}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold text-gray-950"
              style={{ backgroundColor: item.color }}
            >
              {key}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={shuffle}
        className="px-4 py-2 rounded-lg bg-teal-600/90 hover:bg-teal-600 text-sm font-medium"
      >
        Shuffle
      </button>
      <p className="text-[11px] text-gray-600">
        Rects captured before the reorder, deltas animated after — the tiles reflow instantly but{' '}
        <em>look</em> like they slide.
      </p>
    </DemoCard>
  );
}

// ── 11. Filter gallery — per-tile animate, no reflow needed ─────────────

const GALLERY_TILES: { id: number; cat: 'red' | 'blue' | 'green'; color: string }[] = [
  { id: 1, cat: 'red', color: '#f87171' },
  { id: 2, cat: 'blue', color: '#38bdf8' },
  { id: 3, cat: 'green', color: '#4ade80' },
  { id: 4, cat: 'red', color: '#fb7185' },
  { id: 5, cat: 'blue', color: '#818cf8' },
  { id: 6, cat: 'green', color: '#34d399' },
  { id: 7, cat: 'red', color: '#f472b6' },
  { id: 8, cat: 'blue', color: '#60a5fa' },
  { id: 9, cat: 'green', color: '#a3e635' },
];

type GalleryFilter = 'all' | 'red' | 'blue' | 'green';

function FilterGalleryDemo() {
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const tileRefs = useRef(new Map<number, HTMLDivElement>());
  const prevMatchRef = useRef(new Map<number, boolean>(GALLERY_TILES.map((t) => [t.id, true])));

  useEffect(() => {
    GALLERY_TILES.forEach((tile, i) => {
      const el = tileRefs.current.get(tile.id);
      if (!el) return;
      const match = filter === 'all' || tile.cat === filter;
      const prevMatch = prevMatchRef.current.get(tile.id) ?? true;
      if (prevMatch === match) return;
      el.getAnimations().forEach((a) => a.cancel());
      el.animate(
        [
          { opacity: prevMatch ? 1 : 0.08, transform: prevMatch ? 'scale(1)' : 'scale(0.55)' },
          { opacity: match ? 1 : 0.08, transform: match ? 'scale(1)' : 'scale(0.55)' },
        ],
        { duration: 260, delay: i * 15, easing: 'ease-out', fill: 'forwards' },
      );
      prevMatchRef.current.set(tile.id, match);
    });
  }, [filter]);

  return (
    <DemoCard icon={Filter} accent="blue" title="Filter gallery" api="animate opacity/scale per tile">
      <div className="grid grid-cols-3 gap-1.5">
        {GALLERY_TILES.map((tile) => (
          <div
            key={tile.id}
            ref={(el) => {
              if (el) tileRefs.current.set(tile.id, el);
              else tileRefs.current.delete(tile.id);
            }}
            className="aspect-square rounded-lg"
            style={{ backgroundColor: tile.color }}
          />
        ))}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {(['all', 'red', 'blue', 'green'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border capitalize ${
              filter === f ? 'bg-blue-600/90 border-blue-500 text-white' : 'border-gray-700 text-gray-300 hover:bg-gray-800'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
    </DemoCard>
  );
}

// ── 12. Lightbox — shared-element hero transition from thumb to overlay ─

const LIGHTBOX_ITEMS = [
  { label: 'Front yard', color: 'linear-gradient(135deg,#f59e0b,#f43f5e)' },
  { label: 'Patio cam', color: 'linear-gradient(135deg,#22d3ee,#3b82f6)' },
  { label: 'Garage', color: 'linear-gradient(135deg,#a3e635,#10b981)' },
  { label: 'Driveway', color: 'linear-gradient(135deg,#c084fc,#6366f1)' },
];

function HeroLightboxDemo() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const thumbRefs = useRef(new Map<number, HTMLDivElement>());
  const overlayRef = useRef<HTMLDivElement>(null);
  const openRectRef = useRef<DOMRect | null>(null);

  const openAt = (i: number) => {
    const thumb = thumbRefs.current.get(i);
    if (thumb) openRectRef.current = thumb.getBoundingClientRect();
    setOpenIndex(i);
  };

  useLayoutEffect(() => {
    if (openIndex === null) return;
    const overlay = overlayRef.current;
    const from = openRectRef.current;
    if (!overlay || !from) return;
    const to = overlay.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const sx = from.width / to.width;
    const sy = from.height / to.height;
    overlay.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.5 },
        { transform: 'translate(0, 0) scale(1, 1)', opacity: 1 },
      ],
      { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
    );
  }, [openIndex]);

  const close = () => {
    const overlay = overlayRef.current;
    const from = openRectRef.current;
    if (!overlay || !from) {
      setOpenIndex(null);
      return;
    }
    const to = overlay.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const sx = from.width / to.width;
    const sy = from.height / to.height;
    const anim = overlay.animate(
      [
        { transform: 'translate(0, 0) scale(1, 1)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.3 },
      ],
      { duration: 240, easing: 'ease-in' },
    );
    anim.finished.then(() => setOpenIndex(null)).catch(() => setOpenIndex(null));
  };

  return (
    <DemoCard icon={Images} accent="lime" title="Lightbox" api="animate transform between two rects">
      <div className="relative">
        <div className="grid grid-cols-4 gap-1.5">
          {LIGHTBOX_ITEMS.map((item, i) => (
            <button
              key={item.label}
              type="button"
              ref={(el) => {
                if (el) thumbRefs.current.set(i, el);
                else thumbRefs.current.delete(i);
              }}
              onClick={() => openAt(i)}
              className="aspect-square rounded-lg"
              style={{ backgroundImage: item.color }}
              title={item.label}
            />
          ))}
        </div>
        {openIndex !== null && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 rounded-xl cursor-pointer"
            onClick={close}
          >
            <div
              ref={overlayRef}
              className="w-28 h-28 rounded-2xl shadow-2xl flex items-end p-2"
              style={{ backgroundImage: LIGHTBOX_ITEMS[openIndex].color }}
            >
              <span className="text-[11px] font-medium text-white/90">{LIGHTBOX_ITEMS[openIndex].label}</span>
            </div>
          </div>
        )}
      </div>
      <p className="text-[11px] text-gray-600">Overlay animates from the clicked thumbnail's exact rect, not a generic fade.</p>
    </DemoCard>
  );
}

// ── 13. Carousel — sliding track, position from index deltas ────────────

const SLIDES = [
  { label: 'Front porch', bg: 'linear-gradient(135deg,#fb923c,#ef4444)' },
  { label: 'Backyard', bg: 'linear-gradient(135deg,#34d399,#0ea5e9)' },
  { label: 'Kitchen', bg: 'linear-gradient(135deg,#fbbf24,#f472b6)' },
  { label: 'Garage', bg: 'linear-gradient(135deg,#818cf8,#22d3ee)' },
];

function CarouselDemo() {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const prevIndexRef = useRef(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const from = prevIndexRef.current * -100;
    const to = index * -100;
    track.animate([{ transform: `translateX(${from}%)` }, { transform: `translateX(${to}%)` }], {
      duration: 320,
      easing: 'cubic-bezier(.2,.8,.2,1)',
      fill: 'forwards',
    });
    prevIndexRef.current = index;
  }, [index]);

  const go = (delta: number) => setIndex((i) => (i + delta + SLIDES.length) % SLIDES.length);

  return (
    <DemoCard icon={GalleryHorizontal} accent="sky" title="Carousel" api="animate({ transform: translateX })">
      <div className="rounded-lg overflow-hidden">
        <div ref={trackRef} className="flex" style={{ transform: 'translateX(0%)' }}>
          {SLIDES.map((slide) => (
            <div
              key={slide.label}
              className="w-full shrink-0 h-16 flex items-center justify-center text-xs font-medium text-white/90"
              style={{ backgroundImage: slide.bg }}
            >
              {slide.label}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => go(-1)} className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs hover:bg-gray-800">
          ‹ Prev
        </button>
        <div className="flex gap-1">
          {SLIDES.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setIndex(i)}
              className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-sky-400' : 'bg-gray-700'}`}
              title={s.label}
            />
          ))}
        </div>
        <button type="button" onClick={() => go(1)} className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs hover:bg-gray-800">
          Next ›
        </button>
      </div>
    </DemoCard>
  );
}

// ── 14. Skeleton reveal — infinite shimmer, staggered crossfade to content ─

const SKELETON_CARDS = ['Kitchen light', 'Front lock', 'Thermostat'];

function SkeletonRevealDemo() {
  const [loaded, setLoaded] = useState(false);
  const skeletonRefs = useRef<(HTMLDivElement | null)[]>([]);
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shimmerAnimsRef = useRef<(Animation | null)[]>([]);

  const startShimmer = () => {
    SKELETON_CARDS.forEach((_, i) => {
      const sk = skeletonRefs.current[i];
      if (!sk) return;
      shimmerAnimsRef.current[i] = sk.animate(
        [{ backgroundPosition: '200% 0' }, { backgroundPosition: '-200% 0' }],
        { duration: 1100, iterations: Infinity, easing: 'linear' },
      );
    });
  };

  useEffect(() => {
    startShimmer();
    return () => shimmerAnimsRef.current.forEach((a) => a?.cancel());
  }, []);

  const reveal = () => {
    setLoaded(true);
    SKELETON_CARDS.forEach((_, i) => {
      const sk = skeletonRefs.current[i];
      const content = contentRefs.current[i];
      if (!sk || !content) return;
      shimmerAnimsRef.current[i]?.cancel();
      sk.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, delay: i * 150, easing: 'ease-out', fill: 'forwards' });
      content.animate(
        [
          { opacity: 0, transform: 'translateY(6px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 280, delay: i * 150 + 80, easing: 'ease-out', fill: 'forwards' },
      );
    });
  };

  const reset = () => {
    setLoaded(false);
    SKELETON_CARDS.forEach((_, i) => {
      skeletonRefs.current[i]?.getAnimations().forEach((a) => a.cancel());
      contentRefs.current[i]?.getAnimations().forEach((a) => a.cancel());
    });
    startShimmer();
  };

  return (
    <DemoCard icon={Loader} accent="indigo" title="Skeleton reveal" api="backgroundPosition loop + crossfade">
      <div className="space-y-1.5">
        {SKELETON_CARDS.map((label, i) => (
          <div key={label} className="relative h-8 rounded-lg overflow-hidden bg-gray-800">
            <div
              ref={(el) => {
                skeletonRefs.current[i] = el;
              }}
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, #1f2937 25%, #374151 37%, #1f2937 63%)',
                backgroundSize: '300% 100%',
                opacity: 1,
              }}
            />
            <div
              ref={(el) => {
                contentRefs.current[i] = el;
              }}
              className="absolute inset-0 flex items-center px-2.5 text-xs text-gray-300"
              style={{ opacity: 0 }}
            >
              {label} — online
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={loaded ? reset : reveal}
        className="px-4 py-2 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-sm font-medium"
      >
        {loaded ? 'Reset' : 'Load'}
      </button>
    </DemoCard>
  );
}

export default function WebAnimationsTool({ onBack }: { onBack: () => void }) {
  const rows: CapRow[] = useMemo(() => {
    const proto = typeof Element !== 'undefined' ? (Element.prototype as unknown as { animate?: unknown }) : undefined;
    const hasAnimate = typeof proto?.animate === 'function';
    const hasAnimationCtor = typeof Animation !== 'undefined';
    const hasGetAnimations =
      typeof document !== 'undefined' && typeof (document as unknown as { getAnimations?: unknown }).getAnimations === 'function';
    return [
      { name: 'Element.animate()', supported: hasAnimate },
      {
        name: 'Animation',
        supported: hasAnimationCtor,
        detail: hasAnimationCtor ? 'playbackRate, finished, pause()/play()' : undefined,
      },
      { name: 'document.getAnimations()', supported: hasGetAnimations },
    ];
  }, []);

  return (
    <ToolShell
      title="Web Animations"
      surface="Web Animations API (Element.animate)"
      status="lab"
      onBack={onBack}
      examples={examplesFor('web-animations')}
    >
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        <p className="text-sm text-gray-400 leading-relaxed">
          Seven smart-home-style controls, each driven by the browser's native{' '}
          <code className="text-gray-300">Element.animate()</code> — no CSS transitions, no library. Not an{' '}
          <code className="text-gray-300">agapi.*</code> surface: this is what a CF panel's webview already has for
          free.
        </p>
        <CapabilityTable rows={rows} />

        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 pt-2">Smart-home controls</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SmartBulbDemo />
          <DimmerDemo />
          <ThermostatDemo />
          <BlindsDemo />
          <LockDemo />
          <FanDemo />
          <PartyBulbDemo />
        </div>

        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 pt-2">Cards, lists &amp; galleries</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CardStaggerDemo />
          <ListInsertRemoveDemo />
          <ReorderFlipDemo />
          <FilterGalleryDemo />
          <HeroLightboxDemo />
          <CarouselDemo />
          <SkeletonRevealDemo />
        </div>
      </div>
    </ToolShell>
  );
}
