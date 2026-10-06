import * as React from "react"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

const Switch = React.forwardRef(({ checked, onCheckedChange, onLabel = "ON", offLabel = "OFF", disabled, className }, ref) => (
  <button
    ref={ref}
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onCheckedChange?.(!checked)}
    className={cn(
      "relative inline-flex items-center h-8 w-[84px] gap-1 rounded-full p-1 transition-colors duration-200 shrink-0",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      checked ? "bg-primary flex-row-reverse" : "bg-secondary border border-border flex-row",
      className
    )}
  >
    <span className="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
      {checked ? <Check className="w-3.5 h-3.5 text-primary" /> : <X className="w-3.5 h-3.5 text-muted-foreground" />}
    </span>
    <span className={cn(
      "flex-1 text-center text-[11px] font-bold tracking-wide uppercase",
      checked ? "text-primary-foreground" : "text-muted-foreground"
    )}>
      {checked ? onLabel : offLabel}
    </span>
  </button>
))
Switch.displayName = "Switch"

export { Switch }
