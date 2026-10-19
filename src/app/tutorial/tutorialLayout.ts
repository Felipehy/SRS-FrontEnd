import type { TutorialSide } from "./tutorialSteps";

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface LaneInput {
  side: TutorialSide;
  target: Box;
  frame: Box | null;
  pointer: boolean;
}

export interface LaneCard {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const HOLE_PAD = 6;
export const SCREEN_MARGIN = 12;
export const CARD_MIN_WIDTH = 200;
export const CARD_MAX_WIDTH = 264;
export const LANE_GAP = 20;
export const POINTER_GAP = 64;
const CARD_GAP = 12;

export function toBox(rect: DOMRect): Box {
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

export function padBox(box: Box, pad: number): Box {
  return { left: box.left - pad, top: box.top - pad, right: box.right + pad, bottom: box.bottom + pad };
}

export function intersectBoxes(a: Box, b: Box): Box | null {
  const box = {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  };
  if (box.right - box.left < 1 || box.bottom - box.top < 1) return null;
  return box;
}

export function boxesOverlap(a: Box, b: Box): boolean {
  if (a.right <= b.left || b.right <= a.left) return false;
  if (a.bottom <= b.top || b.bottom <= a.top) return false;
  return true;
}

export function centerX(box: Box): number {
  return (box.left + box.right) / 2;
}

export function centerY(box: Box): number {
  return (box.top + box.bottom) / 2;
}

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return (min + max) / 2;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function cardBox(card: LaneCard): Box {
  return { left: card.left, top: card.top, right: card.left + card.width, bottom: card.top + card.height };
}

function clips(style: CSSStyleDeclaration): boolean {
  if (style.overflowX !== "visible") return true;
  if (style.overflowY !== "visible") return true;
  return false;
}

export function getClippers(el: Element): Element[] {
  const list: Element[] = [];
  if (getComputedStyle(el).position === "fixed") return list;
  let node = el.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (clips(style)) list.push(node);
    if (style.position === "fixed") break;
    node = node.parentElement;
  }
  return list;
}

export function visibleBox(el: Element, clippers: Element[], vw: number, vh: number): Box | null {
  let box: Box | null = toBox(el.getBoundingClientRect());
  for (const clipper of clippers) {
    if (!box) return null;
    box = intersectBoxes(box, toBox(clipper.getBoundingClientRect()));
  }
  if (!box) return null;
  return intersectBoxes(box, { left: 0, top: 0, right: vw, bottom: vh });
}

export function frameBox(el: Element): Box | null {
  const frame = el.closest("[data-tour-frame]");
  if (!frame) return null;
  return toBox(frame.getBoundingClientRect());
}

export function scrollParent(el: Element): HTMLElement | null {
  let node = el.parentElement;
  while (node && node !== document.body) {
    const overflowY = getComputedStyle(node).overflowY;
    const scrolls = overflowY === "auto" || overflowY === "scroll";
    if (scrolls && node.scrollHeight > node.clientHeight + 1) return node;
    node = node.parentElement;
  }
  return null;
}

export interface ScrollRequest {
  el: Element;
  extraTop: number;
  extraBottom: number;
}

export function bringIntoView(requests: ScrollRequest[], reservedTop: number, reservedBottom: number) {
  const parents: HTMLElement[] = [];
  const unions: Box[] = [];

  for (const request of requests) {
    const parent = scrollParent(request.el);
    if (!parent) continue;
    const rect = toBox(request.el.getBoundingClientRect());
    const box = { left: rect.left, top: rect.top - request.extraTop, right: rect.right, bottom: rect.bottom + request.extraBottom };
    const index = parents.indexOf(parent);
    if (index === -1) {
      parents.push(parent);
      unions.push(box);
    } else {
      const current = unions[index];
      unions[index] = {
        left: Math.min(current.left, box.left),
        top: Math.min(current.top, box.top),
        right: Math.max(current.right, box.right),
        bottom: Math.max(current.bottom, box.bottom),
      };
    }
  }

  for (let i = 0; i < parents.length; i++) {
    const parentBox = toBox(parents[i].getBoundingClientRect());
    const union = unions[i];
    const top = Math.max(parentBox.top, reservedTop) + SCREEN_MARGIN;
    const bottom = Math.min(parentBox.bottom, window.innerHeight - reservedBottom) - SCREEN_MARGIN;

    let delta = 0;
    if (union.bottom - union.top > bottom - top) {
      delta = union.top - top;
    } else if (union.top < top) {
      delta = union.top - top;
    } else if (union.bottom > bottom) {
      delta = union.bottom - bottom;
    }

    if (Math.abs(delta) > 1) {
      parents[i].scrollBy({ top: delta, behavior: "smooth" });
    }
  }
}

function laneEdge(inputs: LaneInput[], side: TutorialSide): number {
  let edge = 0;
  let first = true;
  for (const input of inputs) {
    if (input.side !== side) continue;
    let box = input.target;
    if (input.frame) box = input.frame;
    if (side === "left") {
      if (first || box.left < edge) edge = box.left;
    } else if (side === "right") {
      if (first || box.right > edge) edge = box.right;
    } else if (side === "top") {
      if (first || input.target.top < edge) edge = input.target.top;
    } else {
      if (first || input.target.bottom > edge) edge = input.target.bottom;
    }
    first = false;
  }
  return edge;
}

export function laneWidths(inputs: LaneInput[], vw: number): number[] {
  const leftEdge = laneEdge(inputs, "left");
  const rightEdge = laneEdge(inputs, "right");
  const widths: number[] = [];
  for (const input of inputs) {
    let space = vw - SCREEN_MARGIN * 2;
    if (input.side === "left") space = leftEdge - LANE_GAP - SCREEN_MARGIN;
    if (input.side === "right") space = vw - SCREEN_MARGIN - rightEdge - LANE_GAP;
    widths.push(Math.max(0, Math.min(CARD_MAX_WIDTH, space)));
  }
  return widths;
}

function laneGap(input: LaneInput): number {
  if (input.pointer) return POINTER_GAP;
  return LANE_GAP;
}

export function laneExtras(inputs: LaneInput[], heights: number[]): { extraTop: number; extraBottom: number }[] {
  const extras: { extraTop: number; extraBottom: number }[] = [];
  for (let i = 0; i < inputs.length; i++) {
    let extraTop = 0;
    let extraBottom = 0;
    if (inputs[i].side === "top") extraTop = heights[i] + laneGap(inputs[i]);
    if (inputs[i].side === "bottom") extraBottom = heights[i] + laneGap(inputs[i]);
    extras.push({ extraTop, extraBottom });
  }
  return extras;
}

function stack(desired: number[], sizes: number[], min: number, max: number): number[] | null {
  const out: number[] = [];
  let next = min;
  for (let k = 0; k < desired.length; k++) {
    let start = desired[k];
    if (start < next) start = next;
    out.push(start);
    next = start + sizes[k] + CARD_GAP;
  }
  let limit = max;
  for (let k = desired.length - 1; k >= 0; k--) {
    if (out[k] + sizes[k] > limit) out[k] = limit - sizes[k];
    limit = out[k] - CARD_GAP;
  }
  if (out.length > 0 && out[0] < min) return null;
  return out;
}

function indexesOn(inputs: LaneInput[], side: TutorialSide): number[] {
  const list: number[] = [];
  for (let i = 0; i < inputs.length; i++) {
    if (inputs[i].side === side) list.push(i);
  }
  return list;
}

export function placeLanes(
  inputs: LaneInput[], widths: number[], heights: number[],
  vw: number, minY: number, maxY: number, holes: Box[],
): LaneCard[] | null {
  for (const width of widths) {
    if (width < CARD_MIN_WIDTH) return null;
  }

  const cards: LaneCard[] = [];
  for (let i = 0; i < inputs.length; i++) {
    cards.push({ left: 0, top: 0, width: widths[i], height: heights[i] });
  }

  const vertical: TutorialSide[] = ["left", "right"];
  for (const side of vertical) {
    const indexes = indexesOn(inputs, side);
    if (indexes.length === 0) continue;
    indexes.sort((a, b) => centerY(inputs[a].target) - centerY(inputs[b].target));
    const desired: number[] = [];
    const sizes: number[] = [];
    for (const i of indexes) {
      desired.push(centerY(inputs[i].target) - heights[i] / 2);
      sizes.push(heights[i]);
    }
    const tops = stack(desired, sizes, minY, maxY);
    if (!tops) return null;
    const edge = laneEdge(inputs, side);
    for (let k = 0; k < indexes.length; k++) {
      const i = indexes[k];
      cards[i].top = tops[k];
      if (side === "left") cards[i].left = edge - LANE_GAP - widths[i];
      else cards[i].left = edge + LANE_GAP;
    }
  }

  const horizontal: TutorialSide[] = ["top", "bottom"];
  for (const side of horizontal) {
    const indexes = indexesOn(inputs, side);
    if (indexes.length === 0) continue;
    indexes.sort((a, b) => centerX(inputs[a].target) - centerX(inputs[b].target));
    const desired: number[] = [];
    const sizes: number[] = [];
    for (const i of indexes) {
      desired.push(centerX(inputs[i].target) - widths[i] / 2);
      sizes.push(widths[i]);
    }
    const lefts = stack(desired, sizes, SCREEN_MARGIN, vw - SCREEN_MARGIN);
    if (!lefts) return null;
    const edge = laneEdge(inputs, side);
    for (let k = 0; k < indexes.length; k++) {
      const i = indexes[k];
      cards[i].left = lefts[k];
      if (side === "top") {
        cards[i].top = edge - laneGap(inputs[i]) - heights[i];
        if (cards[i].top < minY) return null;
      } else {
        cards[i].top = edge + laneGap(inputs[i]);
        if (cards[i].top + heights[i] > maxY) return null;
      }
    }
  }

  for (let i = 0; i < cards.length; i++) {
    const box = cardBox(cards[i]);
    if (box.left < 0 || box.right > vw) return null;
    for (let j = i + 1; j < cards.length; j++) {
      if (boxesOverlap(box, cardBox(cards[j]))) return null;
    }
    for (const hole of holes) {
      if (boxesOverlap(box, hole)) return null;
    }
  }

  return cards;
}
