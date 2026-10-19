import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown } from "lucide-react";
import { clsx } from "clsx";
import { TUTORIAL_TARGET_TIMEOUT, type TutorialCallout, type TutorialSide, type TutorialStep } from "./tutorialSteps";
import { findTarget, waitForTargets } from "./waitForTargets";
import {
  CARD_MAX_WIDTH, CARD_MIN_WIDTH, HOLE_PAD, SCREEN_MARGIN,
  boxesOverlap, bringIntoView, cardBox, centerX, centerY, clamp, frameBox, getClippers,
  laneExtras, laneWidths, padBox, placeLanes, toBox, visibleBox,
  type Box, type LaneCard, type LaneInput, type ScrollRequest,
} from "./tutorialLayout";

type Phase = "waiting" | "placing" | "shown";
type Mode = "lanes" | "legend";

interface Item {
  callout: TutorialCallout;
  el: Element;
  clippers: Element[];
}

interface TutorialOverlayProps {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onMissing: () => void;
}

const HOLE_RADIUS = 12;
const BADGE_SIZE = 22;
const ARROW_SIZE = 40;
const MOBILE_MAX_WIDTH = 768;
const BLOCKED_EVENTS = ["pointerdown", "mousedown", "mouseup", "click", "dblclick", "submit", "contextmenu"];
const SCROLL_KEYS = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"];

function nextFrame(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => resolve());
  });
}

function isMobileWidth(): boolean {
  return window.innerWidth < MOBILE_MAX_WIDTH;
}

function isTourUi(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest("[data-tour-ui]") !== null;
}

function isTourScroll(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest("[data-tour-scroll]") !== null;
}

function refreshItems(items: Item[]) {
  for (const item of items) {
    if (item.el.isConnected) continue;
    const found = findTarget(item.callout.target);
    if (found) {
      item.el = found;
      item.clippers = getClippers(found);
    }
  }
}

async function waitStable(items: Item[], isCancelled: () => boolean) {
  const start = performance.now();
  let last = "";
  let same = 0;
  while (performance.now() - start < 1200) {
    await nextFrame();
    if (isCancelled()) return;
    refreshItems(items);
    let key = "";
    for (const item of items) {
      const r = item.el.getBoundingClientRect();
      key += `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}|`;
    }
    if (key === last) {
      same++;
      if (same >= 4) return;
    } else {
      same = 0;
      last = key;
    }
  }
}

function holePath(box: Box): string {
  const x = box.left - HOLE_PAD;
  const y = box.top - HOLE_PAD;
  const w = box.right - box.left + HOLE_PAD * 2;
  const h = box.bottom - box.top + HOLE_PAD * 2;
  const r = Math.min(HOLE_RADIUS, w / 2, h / 2);
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

function linePoints(side: TutorialSide, card: LaneCard, box: Box): { x1: number; y1: number; x2: number; y2: number } {
  const c = cardBox(card);
  if (side === "left" || side === "right") {
    const y1 = clamp(centerY(box), c.top + 16, c.bottom - 16);
    const y2 = clamp(y1, box.top + 8, box.bottom - 8);
    if (side === "right") return { x1: c.left, y1, x2: box.right + HOLE_PAD, y2 };
    return { x1: c.right, y1, x2: box.left - HOLE_PAD, y2 };
  }
  const x1 = clamp(centerX(box), c.left + 16, c.right - 16);
  const x2 = clamp(x1, box.left + 8, box.right - 8);
  if (side === "top") return { x1, y1: c.bottom, x2, y2: box.top - HOLE_PAD };
  return { x1, y1: c.top, x2, y2: box.bottom + HOLE_PAD };
}

function show(el: HTMLElement | SVGElement | null, visible: boolean) {
  if (!el) return;
  const display = visible ? "" : "none";
  if (el.style.display !== display) el.style.display = display;
}

function CalloutContent({ number, callout }: { number: number; callout: TutorialCallout }) {
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-5 h-5 rounded-full bg-[#5b4fcf] text-white text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
          {number}
        </span>
        <p className="text-sm font-semibold text-foreground leading-tight">{callout.title}</p>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{callout.text}</p>
    </>
  );
}

function TutorialControls({ title, stepIndex, totalSteps, nextRef, onPrev, onNext, onSkip }: {
  title: string; stepIndex: number; totalSteps: number;
  nextRef: React.RefObject<HTMLButtonElement>;
  onPrev: () => void; onNext: () => void; onSkip: () => void;
}) {
  let nextLabel = "Próximo";
  if (stepIndex === totalSteps - 1) nextLabel = "Concluir";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Passo {stepIndex + 1} de {totalSteps}
        </p>
        <p className="text-sm font-semibold text-foreground truncate">{title}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button type="button" onClick={onSkip}
          className="mr-auto px-3 py-2 rounded-xl border border-border/60 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors">
          Pular tutorial
        </button>
        <button type="button" onClick={onPrev} disabled={stepIndex === 0}
          className="px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Anterior
        </button>
        <button type="button" ref={nextRef} onClick={onNext}
          className="px-4 py-2 rounded-xl bg-[#5b4fcf] text-white text-xs font-medium hover:opacity-90 transition-opacity">
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

export default function TutorialOverlay({ step, stepIndex, totalSteps, onNext, onPrev, onSkip, onMissing }: TutorialOverlayProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [mode, setMode] = useState<Mode>(() => (isMobileWidth() ? "legend" : "lanes"));
  const [barAtTop, setBarAtTop] = useState(false);

  const holesRef = useRef<SVGPathElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const badgeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ringRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const lastCards = useRef<LaneCard[] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const heldScroll = useRef<{ el: Element; top: number; left: number } | null>(null);
  const actions = useRef({ onNext, onPrev, onSkip, onMissing });
  actions.current = { onNext, onPrev, onSkip, onMissing };

  let pointerIndex = -1;
  for (let i = 0; i < items.length; i++) {
    if (items[i].callout.pointer === true) pointerIndex = i;
  }

  function barSpace(): number {
    if (!barRef.current) return 0;
    return barRef.current.offsetHeight + SCREEN_MARGIN * 2;
  }

  function scrollTargets(requests: ScrollRequest[], reservedBottom: number) {
    heldScroll.current = null;
    bringIntoView(requests, 0, reservedBottom);
  }

  function sheetSpace(): number {
    if (!sheetRef.current) return 0;
    return sheetRef.current.offsetHeight;
  }

  function visibleBoxes(vw: number, vh: number): (Box | null)[] {
    const list: (Box | null)[] = [];
    for (const item of items) {
      list.push(visibleBox(item.el, item.clippers, vw, vh));
    }
    return list;
  }

  function measureCards(widths: number[]): number[] {
    const heights: number[] = [];
    for (let i = 0; i < items.length; i++) {
      const card = cardRefs.current[i];
      if (!card) {
        heights.push(0);
        continue;
      }
      const width = `${Math.max(widths[i], CARD_MIN_WIDTH)}px`;
      if (card.style.width !== width) card.style.width = width;
      heights.push(card.offsetHeight);
    }
    return heights;
  }

  function computeLanes(atTop: boolean) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const visible = visibleBoxes(vw, vh);
    const inputs: LaneInput[] = [];
    const holes: Box[] = [];
    for (let i = 0; i < items.length; i++) {
      let target = toBox(items[i].el.getBoundingClientRect());
      const box = visible[i];
      if (box) {
        target = box;
        holes.push(padBox(box, HOLE_PAD));
      }
      inputs.push({
        side: items[i].callout.side,
        target,
        frame: frameBox(items[i].el),
        pointer: items[i].callout.pointer === true,
      });
    }
    const widths = laneWidths(inputs, vw);
    const heights = measureCards(widths);
    const space = barSpace();
    let minY = SCREEN_MARGIN;
    let maxY = vh - SCREEN_MARGIN;
    if (atTop) minY += space;
    else maxY -= space;
    const cards = placeLanes(inputs, widths, heights, vw, minY, maxY, holes);
    return { inputs, heights, visible, cards };
  }

  function barHits(atTop: boolean, visible: (Box | null)[]): boolean {
    const bar = barRef.current;
    if (!bar) return false;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = bar.offsetWidth;
    const height = bar.offsetHeight;
    let top = vh - SCREEN_MARGIN - height;
    if (atTop) top = SCREEN_MARGIN;
    const zone = { left: (vw - width) / 2, top, right: (vw + width) / 2, bottom: top + height };
    for (const box of visible) {
      if (box && boxesOverlap(zone, padBox(box, HOLE_PAD))) return true;
    }
    return false;
  }

  function draw() {
    refreshItems(items);
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let visible: (Box | null)[];
    let cards: LaneCard[] | null = null;
    if (mode === "lanes") {
      const result = computeLanes(barAtTop);
      visible = result.visible;
      if (result.cards) lastCards.current = result.cards;
      cards = lastCards.current;
    } else {
      visible = visibleBoxes(vw, vh);
    }

    let path = "";
    for (const box of visible) {
      if (box) path += holePath(box);
    }
    if (holesRef.current) holesRef.current.setAttribute("d", path);

    for (let i = 0; i < items.length; i++) {
      const box = visible[i];
      const card = cardRefs.current[i];
      const line = lineRefs.current[i];
      const badge = badgeRefs.current[i];
      const pointer = items[i].callout.pointer === true;

      let cardPlace: LaneCard | null = null;
      if (cards && cards[i]) cardPlace = cards[i];

      if (card && cardPlace) {
        card.style.transform = `translate(${cardPlace.left}px, ${cardPlace.top}px)`;
      }

      if (!box || pointer) {
        show(line, false);
        show(badge, false);
        continue;
      }

      let badgeX = box.left - HOLE_PAD;
      let badgeY = box.top - HOLE_PAD;

      if (mode === "lanes" && cardPlace && line) {
        const points = linePoints(items[i].callout.side, cardPlace, box);
        line.setAttribute("x1", String(points.x1));
        line.setAttribute("y1", String(points.y1));
        line.setAttribute("x2", String(points.x2));
        line.setAttribute("y2", String(points.y2));
        show(line, true);
        badgeX = points.x2;
        badgeY = points.y2;
      } else {
        show(line, false);
      }

      if (badge) {
        const half = BADGE_SIZE / 2;
        const x = clamp(badgeX, half + 2, vw - half - 2) - half;
        const y = clamp(badgeY, half + 2, vh - half - 2) - half;
        badge.style.transform = `translate(${x}px, ${y}px)`;
        show(badge, true);
      }
    }

    if (pointerIndex !== -1) {
      const box = visible[pointerIndex];
      show(ringRef.current, box !== null);
      show(arrowRef.current, box !== null);
      if (box && ringRef.current && arrowRef.current) {
        const ring = ringRef.current.style;
        ring.left = `${box.left - HOLE_PAD}px`;
        ring.top = `${box.top - HOLE_PAD}px`;
        ring.width = `${box.right - box.left + HOLE_PAD * 2}px`;
        ring.height = `${box.bottom - box.top + HOLE_PAD * 2}px`;
        const arrow = arrowRef.current.style;
        arrow.left = `${centerX(box) - ARROW_SIZE / 2}px`;
        arrow.top = `${box.top - HOLE_PAD - ARROW_SIZE - 6}px`;
      }
    }
  }

  function clearHoles() {
    if (holesRef.current) holesRef.current.setAttribute("d", "");
  }

  function showItem(i: number) {
    const item = items[i];
    if (!item) return;
    refreshItems(items);
    scrollTargets([{ el: item.el, extraTop: 0, extraBottom: 0 }], sheetSpace());
  }

  useEffect(() => {
    const controller = new AbortController();
    setPhase("waiting");
    setItems([]);
    lastCards.current = null;

    const targets: string[] = [];
    for (const callout of step.callouts) {
      targets.push(callout.target);
    }

    nextFrame()
      .then(() => waitForTargets(targets, TUTORIAL_TARGET_TIMEOUT, controller.signal))
      .then(found => {
        if (controller.signal.aborted) return;
        const list: Item[] = [];
        for (const callout of step.callouts) {
          const el = found[callout.target];
          if (!el) {
            console.warn(`[tutorial] [data-tour="${callout.target}"] não apareceu em ${TUTORIAL_TARGET_TIMEOUT / 1000}s — o passo "${step.id}" segue sem este balão.`);
            continue;
          }
          list.push({ callout, el, clippers: getClippers(el) });
        }
        if (list.length === 0) {
          console.warn(`[tutorial] Nenhum elemento do passo "${step.id}" apareceu — pulando o passo.`);
          actions.current.onMissing();
          return;
        }
        setItems(list);
        if (isMobileWidth()) setMode("legend");
        else setMode("lanes");
        setPhase("placing");
      });

    return () => controller.abort();
  }, [step]);

  useEffect(() => {
    if (phase !== "placing") return;
    let cancelled = false;

    function isCancelled(): boolean {
      return cancelled;
    }

    async function place() {
      await nextFrame();
      await nextFrame();
      if (cancelled) return;
      refreshItems(items);

      if (mode === "lanes") {
        const first = computeLanes(false);
        const extras = laneExtras(first.inputs, first.heights);
        const requests: ScrollRequest[] = [];
        for (let i = 0; i < items.length; i++) {
          requests.push({ el: items[i].el, extraTop: extras[i].extraTop, extraBottom: extras[i].extraBottom });
        }
        scrollTargets(requests, barSpace());
        await waitStable(items, isCancelled);
        if (cancelled) return;

        const visible = visibleBoxes(window.innerWidth, window.innerHeight);
        let atTop = false;
        if (barHits(false, visible) && !barHits(true, visible)) atTop = true;

        const result = computeLanes(atTop);
        if (result.cards) {
          lastCards.current = result.cards;
          setBarAtTop(atTop);
          setPhase("shown");
          return;
        }
        setMode("legend");
        return;
      }

      const requests: ScrollRequest[] = [];
      for (const item of items) {
        requests.push({ el: item.el, extraTop: 0, extraBottom: 0 });
      }
      scrollTargets(requests, sheetSpace());
      await waitStable(items, isCancelled);
      if (cancelled) return;
      setPhase("shown");
    }

    place();
    return () => {
      cancelled = true;
    };
  }, [phase, mode, items]);

  useEffect(() => {
    if (phase === "waiting") {
      clearHoles();
      return;
    }
    let frame = 0;
    function tick() {
      draw();
      frame = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(frame);
  }, [phase, mode, items, barAtTop]);

  useEffect(() => {
    if (phase !== "shown") return;
    if (nextButtonRef.current) nextButtonRef.current.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    let timer = 0;
    let lastWidth = window.innerWidth;

    function onResize() {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (isMobileWidth()) setMode("legend");
        else setMode("lanes");
        setPhase(current => {
          if (current === "waiting") return current;
          return "placing";
        });
      }, 200);
    }

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    function block(e: Event) {
      if (isTourUi(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    }

    function blockScroll(e: Event) {
      if (isTourScroll(e.target)) return;
      e.preventDefault();
    }

    function holdScroll(e: Event) {
      heldScroll.current = null;
      if (isTourUi(e.target)) return;
      if (!(e.target instanceof Element)) return;
      heldScroll.current = { el: e.target, top: e.target.scrollTop, left: e.target.scrollLeft };
    }

    function releaseScroll() {
      heldScroll.current = null;
    }

    function restoreScroll(e: Event) {
      const held = heldScroll.current;
      if (!held || held.el !== e.target) return;
      held.el.scrollTop = held.top;
      held.el.scrollLeft = held.left;
    }

    function tourButtons(): HTMLElement[] {
      const list: HTMLElement[] = [];
      if (!rootRef.current) return list;
      const buttons = rootRef.current.querySelectorAll<HTMLElement>("button:not([disabled])");
      for (const button of buttons) {
        list.push(button);
      }
      return list;
    }

    function trapFocus(e: KeyboardEvent) {
      const buttons = tourButtons();
      if (buttons.length === 0) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!isTourUi(e.target)) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!e.repeat && e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        actions.current.onNext();
        return;
      }
      if (!e.repeat && e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        actions.current.onPrev();
        return;
      }
      if (e.key === "Tab") {
        e.stopPropagation();
        trapFocus(e);
        return;
      }
      if (!isTourUi(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (SCROLL_KEYS.includes(e.key) && !isTourScroll(e.target)) e.preventDefault();
    }

    for (const name of BLOCKED_EVENTS) {
      window.addEventListener(name, block, true);
    }
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("wheel", blockScroll, { capture: true, passive: false });
    window.addEventListener("touchmove", blockScroll, { capture: true, passive: false });
    window.addEventListener("mousedown", holdScroll, true);
    window.addEventListener("mouseup", releaseScroll, true);
    document.addEventListener("scroll", restoreScroll, true);

    const focused = document.activeElement;
    if (focused instanceof HTMLElement && !isTourUi(focused)) focused.blur();

    return () => {
      for (const name of BLOCKED_EVENTS) {
        window.removeEventListener(name, block, true);
      }
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("wheel", blockScroll, true);
      window.removeEventListener("touchmove", blockScroll, true);
      window.removeEventListener("mousedown", holdScroll, true);
      window.removeEventListener("mouseup", releaseScroll, true);
      document.removeEventListener("scroll", restoreScroll, true);
    };
  }, []);

  const shown = phase === "shown";

  const controls = (
    <TutorialControls
      title={step.title}
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      nextRef={nextButtonRef}
      onPrev={onPrev}
      onNext={onNext}
      onSkip={onSkip}
    />
  );

  return createPortal(
    <div ref={rootRef} data-tour-ui="" role="dialog" aria-modal="true" aria-label="Tutorial" className="fixed inset-0 z-[1000] pointer-events-none">
      <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
        <defs>
          <mask id="tutorial-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <path ref={holesRef} fill="black" />
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" mask="url(#tutorial-mask)" className="fill-black/55 dark:fill-black/70" />
        {mode === "lanes" && items.map((item, i) => (
          <line
            key={item.callout.target}
            ref={el => { lineRefs.current[i] = el; }}
            strokeWidth={2}
            strokeLinecap="round"
            className={clsx("stroke-[#5b4fcf] dark:stroke-[#a59cf5] transition-opacity duration-150", shown ? "opacity-100" : "opacity-0")}
            style={{ display: "none" }}
          />
        ))}
      </svg>

      {items.map((item, i) => (
        <div
          key={item.callout.target}
          ref={el => { badgeRefs.current[i] = el; }}
          className={clsx(
            "absolute left-0 top-0 rounded-full bg-[#5b4fcf] text-white text-[11px] font-semibold flex items-center justify-center ring-2 ring-white dark:ring-neutral-900 shadow transition-opacity duration-150",
            shown ? "opacity-100" : "opacity-0",
          )}
          style={{ width: BADGE_SIZE, height: BADGE_SIZE, display: "none" }}
          aria-hidden="true"
        >
          {i + 1}
        </div>
      ))}

      {pointerIndex !== -1 && (
        <>
          <div ref={ringRef} className={clsx("absolute rounded-xl ring-4 ring-[#5b4fcf] dark:ring-[#a59cf5] animate-pulse transition-opacity", shown ? "opacity-100" : "opacity-0")}
            style={{ display: "none" }} aria-hidden="true" />
          <div ref={arrowRef} className={clsx("absolute flex items-center justify-center transition-opacity", shown ? "opacity-100" : "opacity-0")}
            style={{ width: ARROW_SIZE, height: ARROW_SIZE, display: "none" }} aria-hidden="true">
            <ArrowDown size={ARROW_SIZE} strokeWidth={3} className="text-[#5b4fcf] dark:text-[#a59cf5] animate-bounce drop-shadow" />
          </div>
        </>
      )}

      {mode === "lanes" && items.map((item, i) => (
        <div
          key={item.callout.target}
          ref={el => { cardRefs.current[i] = el; }}
          className={clsx(
            "absolute left-0 top-0 pointer-events-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-xl p-3 transition-opacity duration-150",
            shown ? "visible opacity-100" : "invisible opacity-0",
          )}
          style={{ width: CARD_MAX_WIDTH }}
        >
          <CalloutContent number={i + 1} callout={item.callout} />
        </div>
      ))}

      {mode === "lanes" && (
        <div
          ref={barRef}
          className={clsx(
            "absolute left-1/2 -translate-x-1/2 pointer-events-auto w-[min(640px,calc(100vw-24px))] rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl px-4 py-3",
            barAtTop ? "top-3" : "bottom-3",
          )}
        >
          {controls}
        </div>
      )}

      {mode === "legend" && (
        <div
          ref={sheetRef}
          className="absolute inset-x-0 bottom-0 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[min(560px,calc(100vw-24px))] pointer-events-auto max-h-[45dvh] flex flex-col rounded-t-2xl border border-border bg-popover text-popover-foreground shadow-2xl"
        >
          {items.length > 0 && (
            <div data-tour-scroll="" className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-1 space-y-2" style={{ scrollbarWidth: "none" }}>
              {items.length > 1 && (
                <p className="text-[11px] text-muted-foreground">Toque num item para ver onde ele fica na tela.</p>
              )}
              {items.map((item, i) => (
                <button
                  key={item.callout.target}
                  type="button"
                  onClick={() => showItem(i)}
                  className="w-full text-left rounded-xl border border-border bg-card px-3 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  <CalloutContent number={i + 1} callout={item.callout} />
                </button>
              ))}
            </div>
          )}
          <div className="px-4 py-3 border-t border-border flex-shrink-0">
            {controls}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
