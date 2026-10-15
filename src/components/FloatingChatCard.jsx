import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

// Tarjeta de chat flotante con bordes redondeados, estilo widget de
// soporte (abajo a la derecha) — distinta del SlideOverPanel de borde a
// borde que usa el superadmin: esto es para el lado de la organización,
// pensado para convivir con el resto de la pantalla en vez de taparla.
export default function FloatingChatCard({ open, onClose, title, subtitle, avatar, children }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ type: 'tween', duration: 0.18, ease: 'easeOut' }}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[70] w-[calc(100vw-2rem)] max-w-[380px] h-[min(560px,70vh)] bg-card rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="h-14 flex items-center px-4 gap-3 border-b border-border shrink-0 bg-secondary/30">
            {avatar && <img src={avatar} alt="" className="w-8 h-8 rounded-lg shrink-0 shadow-sm" />}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{title}</p>
              {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-accent shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0 flex flex-col p-3">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
