import React from "react";

// Constellation-style backdrop: faint curved connection lines with glowing
// nodes, over a near-black navy — same mood as the reference image, just
// without its headline/CTA (we overlay our own brand copy + glass pills).
function ConstellationBackground() {
  const nodes = [
    { x: 60, y: 90 }, { x: 230, y: 230 }, { x: 430, y: 520 },
    { x: 700, y: 640 }, { x: 870, y: 360 }, { x: 980, y: 110 },
  ];
  return (
    <svg viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <defs>
        <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6b7cff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#6b7cff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M 60 90 C 160 140, 180 260, 230 230 C 320 170, 360 460, 430 520 C 520 590, 620 560, 700 640 C 770 700, 800 420, 870 360 C 930 310, 940 170, 980 110"
        fill="none" stroke="#5b6fe8" strokeOpacity="0.35" strokeWidth="1.5" />
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r="18" fill="url(#nodeGlow)" />
          <circle cx={n.x} cy={n.y} r="3" fill="#a5b0ff" />
        </g>
      ))}
    </svg>
  );
}

// Glass pill labels near a few of the constellation nodes above — plain
// stage labels, no numbers/metrics ("sin datos por ahora").
const GLASS_LABELS = [
  { label: 'Seguimiento', top: '26.5%', left: '26%' },
  { label: 'Clientes', top: '42%', left: '85%' },
  { label: 'Cierre', top: '77%', left: '66%' },
];

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen relative flex items-center justify-center bg-[#0a0e27] p-4 sm:p-6 lg:p-10 overflow-hidden">
      {/* Page backdrop — the same constellation motif, blurred and zoomed
          out, so the floating card has somewhere to "float" over. */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e27] via-[#0d1240] to-[#141a52]" aria-hidden="true" />
      <div className="absolute inset-0 scale-125 blur-2xl opacity-80" aria-hidden="true">
        <ConstellationBackground />
      </div>
      <div className="absolute -top-40 -left-40 w-[40rem] h-[40rem] rounded-full bg-primary/25 blur-3xl" aria-hidden="true" />
      <div className="absolute bottom-0 right-0 w-[40rem] h-[40rem] rounded-full bg-primary/25 blur-3xl translate-x-1/3 translate-y-1/3" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-5xl bg-card rounded-3xl shadow-2xl border border-border/60 overflow-hidden flex flex-col lg:flex-row">
        {/* Brand panel — a compact banner on mobile, full identity panel on lg+ */}
        <div className="order-first lg:order-none h-36 sm:h-44 lg:h-auto lg:w-[46%] relative overflow-hidden bg-[#0a0e27] text-white flex flex-col justify-between p-5 sm:p-6 lg:p-10 xl:p-12">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e27] via-[#0d1240] to-[#141a52]" aria-hidden="true" />
          <ConstellationBackground />
          <div className="absolute -top-28 -left-20 w-[22rem] h-[22rem] rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
          <div className="absolute bottom-0 right-0 w-[26rem] h-[26rem] rounded-full bg-primary/20 blur-3xl translate-x-1/3 translate-y-1/3" aria-hidden="true" />

          {GLASS_LABELS.map(g => (
            <span key={g.label} style={{ top: g.top, left: g.left }}
              className="hidden lg:inline-flex absolute z-10 -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-medium text-white/90 shadow-lg whitespace-nowrap">
              {g.label}
            </span>
          ))}

          <div className="relative z-10 flex items-center gap-3">
            <img src="/logo.png" alt="Conectado Flow" className="w-9 h-9 sm:w-10 sm:h-10 rounded-[10px] shrink-0" />
            <div>
              <p className="font-semibold text-base sm:text-lg leading-tight">Conectado</p>
              <p className="text-xs sm:text-sm text-white/70 leading-tight -mt-0.5">Flow</p>
            </div>
          </div>

          <p className="relative z-10 text-sm font-medium text-white/90 leading-snug lg:hidden">
            Del primer contacto al cobro, en un solo lugar.
          </p>

          <div className="relative z-10 max-w-sm hidden lg:block">
            <h2 className="text-2xl xl:text-3xl font-bold tracking-tight leading-tight mb-3">
              Del primer contacto al cobro, en un solo lugar.
            </h2>
            <p className="text-white/70 text-sm leading-relaxed">
              El CRM pensado para equipos de venta que necesitan orden, seguimiento y resultados — sin complicarse.
            </p>
          </div>

          <p className="relative z-10 text-xs text-white/50 hidden lg:block">© {new Date().getFullYear()} Conectado Flow</p>
        </div>

        {/* Form panel */}
        <div className="flex-1 flex items-center justify-center px-6 py-8 sm:px-10 sm:py-10 lg:px-12">
          <div className="w-full max-w-sm">
            <div className="text-center lg:text-left mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
              {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
            </div>
            {children}
            {footer && (
              <p className="text-center lg:text-left text-sm text-muted-foreground mt-6">{footer}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
