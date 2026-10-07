import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const DEFAULT_PRESETS = [
  { key: 'today', label: 'Hoy' },
  { key: '7d', label: 'Últimos 7 días' },
  { key: '30d', label: 'Últimos 30 días' },
  { key: 'month', label: 'Este mes' },
  { key: '3m', label: 'Últimos 3 meses' },
  { key: 'year', label: 'Este año' },
];

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function isCustomRange(v) { return v && typeof v === 'object' && v.start && v.end; }

function fmt(d) { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }); }

// Preset dropdown + "point A to point B" calendar range picker, used
// anywhere a page currently has a plain period <select> (Analytics,
// Ventas). `value` is either a preset key string or a { start, end }
// custom range; `onChange` receives the same shape back.
export default function DateRangePicker({ value, onChange, presets = DEFAULT_PRESETS, className }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selStart, setSelStart] = useState(isCustomRange(value) ? new Date(value.start) : null);
  const [selEnd, setSelEnd] = useState(isCustomRange(value) ? new Date(value.end) : null);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const label = isCustomRange(value)
    ? `${fmt(value.start)} – ${fmt(value.end)}`
    : presets.find(p => p.key === value)?.label || 'Elegir período';

  const pickPreset = (key) => { onChange(key); setOpen(false); };

  const pickDay = (day) => {
    if (!selStart || selEnd) { setSelStart(day); setSelEnd(null); return; }
    if (day < selStart) { setSelEnd(selStart); setSelStart(day); }
    else setSelEnd(day);
  };

  const applyCustom = () => {
    if (!selStart) return;
    onChange({ start: selStart, end: selEnd || selStart });
    setOpen(false);
  };

  const goMonth = (delta) => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + delta, 1));

  const year = viewMonth.getFullYear();
  const monthIdx = viewMonth.getMonth();
  const firstOfMonth = new Date(year, monthIdx, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, monthIdx, d));
  const today = new Date();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-input bg-card text-sm font-medium hover:bg-accent transition-colors', className)}
      >
        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        // Fixed + inset-x margins on mobile so this can never overflow the
        // viewport regardless of where the trigger sits in the page's
        // layout; reverts to the anchored absolute dropdown from sm: up.
        <div className="fixed left-4 right-4 top-20 sm:absolute sm:left-0 sm:right-auto sm:top-full sm:mt-2 z-50 bg-popover text-popover-foreground border border-border rounded-2xl shadow-lg p-3 sm:w-[520px] max-h-[80vh] overflow-y-auto flex flex-col sm:flex-row gap-3">
          <div className="flex sm:flex-col gap-1 sm:w-36 shrink-0 overflow-x-auto sm:overflow-visible no-scrollbar">
            {presets.map(p => (
              <button key={p.key} onClick={() => pickPreset(p.key)}
                className={cn('shrink-0 text-left px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
                  value === p.key ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex-1 border-t sm:border-t-0 sm:border-l border-border pt-3 sm:pt-0 sm:pl-3">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => goMonth(-1)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-accent"><ChevronLeft className="w-4 h-4" /></button>
              <p className="text-sm font-semibold capitalize">{viewMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</p>
              <button onClick={() => goMonth(1)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-accent"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {WEEKDAYS.map((d, i) => <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const isStart = sameDay(day, selStart);
                const isEnd = sameDay(day, selEnd);
                const inRange = selStart && selEnd && day > selStart && day < selEnd;
                const isToday = sameDay(day, today);
                return (
                  <button key={i} onClick={() => pickDay(day)}
                    className={cn(
                      'h-8 text-xs rounded-lg flex items-center justify-center transition-colors',
                      (isStart || isEnd) ? 'bg-primary text-primary-foreground font-semibold' :
                        inRange ? 'bg-primary/15 text-foreground' :
                          isToday ? 'border border-primary/40' : 'hover:bg-accent'
                    )}>
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-muted-foreground">
                {selStart ? `${fmt(selStart)}${selEnd ? ' – ' + fmt(selEnd) : ' – …'}` : 'Elegí el día inicial'}
              </p>
              <button onClick={applyCustom} disabled={!selStart}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
