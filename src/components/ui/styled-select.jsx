import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Radix' Select forbids an item with value="" (used to be the empty-value
// sentinel for a "Seleccionar…" placeholder). We map "" to this internal
// sentinel and translate it back to "" in the onChange call.
const EMPTY = '__empty__'

// Drop-in replacement for a native <select>: same value / onChange(e) /
// <option> API (onChange receives a {target:{value}} shaped event, like the
// real thing), so existing call sites only need their tag renamed from
// <select> to <StyledSelect> — no handler rewrites. Renders our own styled
// dropdown (via the Radix-based Select) instead of the browser's native one.
export const StyledSelect = React.forwardRef(({ value, onChange, children, className, placeholder, disabled, id }, ref) => {
  const options = React.Children.toArray(children).filter(Boolean);
  const current = value == null || value === '' ? (options.some(o => o.props.value === '') ? EMPTY : undefined) : String(value);

  return (
    <Select
      value={current}
      onValueChange={(v) => onChange?.({ target: { value: v === EMPTY ? '' : v } })}
      disabled={disabled}
    >
      <SelectTrigger ref={ref} id={id} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => {
          const raw = opt.props.value !== undefined ? String(opt.props.value) : String(opt.props.children);
          const itemValue = raw === '' ? EMPTY : raw;
          return (
            <SelectItem key={itemValue} value={itemValue} disabled={opt.props.disabled}>
              {opt.props.children}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
});
StyledSelect.displayName = 'StyledSelect'
