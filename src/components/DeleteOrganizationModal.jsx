import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Modal from '@/components/Modal';

// Doble verificación real, no solo un "¿estás seguro?": hay que escribir
// el nombre exacto de la organización para habilitar el botón. Pensado
// para dos lugares distintos — el Panel de administración (borrar
// cualquier organización) y Configuración (un admin borra la suya propia)
// — ambos pegan al mismo RPC, que valida del lado del servidor quién
// puede hacer qué.
export default function DeleteOrganizationModal({ org, onClose, onDeleted }) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (org) { setConfirmText(''); setError(''); } }, [org]);

  if (!org) return null;

  const matches = confirmText.trim() === org.name;

  const del = async () => {
    if (!matches) return;
    setDeleting(true); setError('');
    try {
      await base44.admin.deleteOrganization(org.id);
      onDeleted?.();
      onClose();
    } catch (e) {
      setError(e.message || 'No se pudo eliminar la organización');
    } finally { setDeleting(false); }
  };

  return (
    <Modal open={!!org} onClose={onClose} title="Eliminar organización"
      footer={<>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
        <button onClick={del} disabled={!matches || deleting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:opacity-90 disabled:opacity-40">
          <Trash2 className="w-4 h-4" /> {deleting ? 'Eliminando…' : 'Eliminar para siempre'}
        </button>
      </>}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm">
            Esto borra <span className="font-semibold">todo</span> lo de <span className="font-semibold">{org.name}</span>: clientes, leads,
            ventas, productos, reuniones, documentos — y las cuentas de acceso de
            {org.member_count != null ? ` sus ${org.member_count} miembro${org.member_count === 1 ? '' : 's'}` : ' todo el equipo'}.
            No se puede deshacer.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">
            Para confirmar, escribí <span className="font-semibold">{org.name}</span> acá abajo:
          </label>
          <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder={org.name}
            className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-destructive/30 focus:border-destructive" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </Modal>
  );
}
