import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { CalendarIcon, Clock } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { clsx } from "clsx";

function fieldCls(error?: string): string {
  return clsx(
    "w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs text-left transition-all outline-none",
    "bg-muted/50 border",
    error
      ? "border-red-300 bg-red-50 dark:bg-red-950/30"
      : "border-transparent hover:bg-muted focus:border-[#5b4fcf]/30 focus:bg-card",
  );
}

interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (date: string) => void;
  minDate?: string;
  error?: string;
  placeholder?: string;
}

export function DatePicker({
  id,
  value,
  onChange,
  minDate,
  error,
  placeholder = "Selecione uma data",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const selected = value && isValid(parseISO(value)) ? parseISO(value) : undefined;
  const minParsed = minDate && isValid(parseISO(minDate)) ? parseISO(minDate) : undefined;

  const displayLabel = selected
    ? format(selected, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : undefined;

  return (
    <div id={id}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
            className={fieldCls(error)}
            aria-label={displayLabel ?? placeholder}
          >
            <CalendarIcon size={13} className="text-muted-foreground flex-shrink-0" />
            <span className={displayLabel ? "text-foreground" : "text-muted-foreground"}>
              {displayLabel ?? placeholder}
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={date => {
              if (date) {
                onChange(format(date, "yyyy-MM-dd"));
                setOpen(false);
              }
            }}
            disabled={minParsed ? { before: minParsed } : undefined}
            defaultMonth={selected ?? minParsed ?? new Date()}
            locale={ptBR}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface TimePickerProps {
  id?: string;
  value: string;
  onChange: (time: string) => void;
  error?: string;
  placeholder?: string;
  minuteStep?: number;
  minHour?: number;
}

const ITEM_H = 36;
const VISIBLE = 5;
const PADN = Math.floor(VISIBLE / 2);
const ACCENT = "#5b4fcf";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function clampIdx(i: number, len: number): number {
  return Math.max(0, Math.min(len - 1, i));
}

function WheelColumn({
  values,
  selectedIndex,
  ariaLabel,
  onSelect,
}: {
  values: number[];
  selectedIndex: number;
  ariaLabel: string;
  onSelect: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncing = useRef(false);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = selectedIndex * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) {
      syncing.current = true;
      el.scrollTop = target;
      requestAnimationFrame(() => { syncing.current = false; });
    }
  }, [selectedIndex]);

  const onScroll = () => {
    const el = ref.current;
    if (!el || syncing.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const idx = clampIdx(Math.round(el.scrollTop / ITEM_H), values.length);
      if (idx !== selectedIndex) onSelect(idx);
    }, 90);
  };

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={e => {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          onSelect(clampIdx(selectedIndex - 1, values.length));
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          onSelect(clampIdx(selectedIndex + 1, values.length));
        }
      }}
      className="relative z-10 w-12 overflow-y-auto snap-y snap-mandatory overscroll-contain rounded-lg outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus-visible:ring-2 focus-visible:ring-[#5b4fcf]/40"
      style={{
        height: ITEM_H * VISIBLE,
        maskImage:
          "linear-gradient(to bottom, transparent, #000 26%, #000 74%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent, #000 26%, #000 74%, transparent)",
      }}
    >
      <div style={{ height: ITEM_H * PADN }} aria-hidden />
      {values.map((v, i) => (
        <button
          key={v}
          type="button"
          role="option"
          aria-selected={i === selectedIndex}
          onClick={() => onSelect(i)}
          className={clsx(
            "flex w-full items-center justify-center snap-center text-sm tabular-nums transition-colors",
            i === selectedIndex
              ? "font-semibold text-[#5b4fcf]"
              : "text-muted-foreground hover:text-foreground",
          )}
          style={{ height: ITEM_H }}
        >
          {pad2(v)}
        </button>
      ))}
      <div style={{ height: ITEM_H * PADN }} aria-hidden />
    </div>
  );
}

export function TimePicker({
  id,
  value,
  onChange,
  error,
  placeholder = "00:00",
  minuteStep = 1,
  minHour = 0,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = minHour; h < 24; h++) {
      list.push(h);
    }
    return list;
  }, [minHour]);
  const minutes = useMemo(
    () => Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep),
    [minuteStep],
  );

  let rawH = 0;
  let rawM = 0;
  if (value.includes(":")) {
    const parts = value.split(":");
    rawH = Number(parts[0]);
    rawM = Number(parts[1]);
  }

  let hourValue = minHour;
  if (Number.isFinite(rawH)) hourValue = rawH;
  const hourIdx = clampIdx(hourValue - minHour, hours.length);

  const minuteIdx = useMemo(() => {
    const target = Number.isFinite(rawM) ? rawM : 0;
    let best = 0;
    let diff = Infinity;
    minutes.forEach((mv, i) => {
      const d = Math.abs(mv - target);
      if (d < diff) {
        diff = d;
        best = i;
      }
    });
    return best;
  }, [minutes, rawM]);

  const commit = (hh: number, mm: number) => onChange(`${pad2(hh)}:${pad2(mm)}`);

  return (
    <div id={id}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
            className={fieldCls(error)}
            aria-label={value || placeholder}
          >
            <Clock size={13} className="text-muted-foreground flex-shrink-0" />
            <span className={value ? "text-foreground" : "text-muted-foreground"}>
              {value || placeholder}
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-2" align="start">
          <div className="relative flex items-stretch gap-1">
            <div
              className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 rounded-lg"
              style={{ height: ITEM_H, background: `${ACCENT}1a` }}
              aria-hidden
            />
            <WheelColumn
              values={hours}
              selectedIndex={hourIdx}
              ariaLabel="Horas"
              onSelect={i => commit(hours[i], minutes[minuteIdx])}
            />
            <span className="relative z-10 self-center text-sm font-semibold text-foreground">:</span>
            <WheelColumn
              values={minutes}
              selectedIndex={minuteIdx}
              ariaLabel="Minutos"
              onSelect={i => commit(hours[hourIdx], minutes[i])}
            />
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 w-full rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
            style={{ background: ACCENT }}
          >
            Pronto
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
