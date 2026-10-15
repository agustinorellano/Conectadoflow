import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

// Panel emergente desde la derecha (tipo chat flotante) — usado para la
// conversación de reportes e incidencias, tanto del lado de la
// organización como del superadmin, en vez de expandir inline empujando
// el resto del contenido.
export default function SlideOverPanel({ open, onClose, title, subtitle, children }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-[60]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed right-0 top-0 bottom-0 z-[61] w-full sm:w-[400px] bg-card border-l border-border shadow-2xl flex flex-col"
          >
            <div className="h-16 flex items-center px-4 gap-3 border-b border-border shrink-0">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{title}</p>
                {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-accent shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col p-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
