import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Modal from '@/components/Modal';
import { StyledSelect } from '@/components/ui/styled-select';

const REASON_OPTIONS = [
  'Dejamos de usar el producto',
  'Nos cambiamos a otra herramienta',
  'Es muy caro para lo que usamos',
  'Problemas técnicos o errores',
  'Otro motivo',
];

// Doble verificación real, no solo un "¿estás seguro?": hay que escribir
// el nombre exacto de la organización Y tildar un checkbox aparte para
// habilitar el botón. Pensado para dos lugares distintos — el Panel de
// administración (borrar cualquier organización) y Configuración (un
// admin borra la suya propia) — ambos pegan al mismo RPC, que valida del
// lado del servidor quién puede hacer qué. requireReason=true (solo desde
// Configuración) suma un paso previo para entender por qué se da de baja,
// antes incluso de llegar a la confirmación.
export default function DeleteOrganizationModal({ org, onClose, onDeleted, requireReason = false }) {
  const [step, setStep] = useState('reason'); // reason | confirm
  const [reasonOption, setReasonOption] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (org) {
      setStep(requireReason ? 'reason' : 'confirm');
      setReasonOption(''); setReasonDetail(''); setConfirmText(''); setUnderstood(false); setError('');
    }
  }, [org, requireReason]);

  if (!org) return null;

  const matches = confirmText.trim() === org.name;
  const canContinueFromReason = reasonOption !== '' && (reasonOption !== 'Otro motivo' || reasonDetail.trim() !== '');

  const del = async () => {
    if (!matches || !understood) return;
    setDeleting(true); setError('');
    try {
      const reason = requireReason && reasonOption ? `${reasonOption}${reasonDetail.trim() ? `: ${reasonDetail.trim()}` : ''}` : undefined;
      await base44.admin.deleteOrganization(org.id, reason);
      onDeleted?.();
      onClose();
    } catch (e) {
      setError(e.message || 'No se pudo eliminar la organización');
    } finally { setDeleting(false); }
  };

  return (
    <Modal open={!!org} onClose={onClose}
      title={step === 'reason' ? 'Antes de eliminar — contanos por qué' : 'Eliminar organización'}
      footer={
        step === 'reason' ? (
          <>
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
            <button onClick={() => setStep('confirm')} disabled={!canContinueFromReason}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40">Continuar</button>
          </>
        ) : (
          <>
            {requireReason ? (
              <button onClick={() => setStep('reason')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">
                <ArrowLeft className="w-3.5 h-3.5" /> Atrás
              </button>
            ) : (
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-accent">Cancelar</button>
            )}
            <button onClick={del} disabled={!matches || !understood || deleting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:opacity-90 disabled:opacity-40">
              <Trash2 className="w-4 h-4" /> {deleting ? 'Eliminando…' : 'Eliminar para siempre'}
            </button>
          </>
        )
      }>
      {step === 'reason' ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Nos sirve para saber qué estamos haciendo mal (o bien). No cambia nada de lo que pasa después.</p>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Motivo</label>
            <StyledSelect value={reasonOption} onChange={e => setReasonOption(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm">
              <option value="">Seleccionar…</option>
              {REASON_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </StyledSelect>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Contanos más {reasonOption === 'Otro motivo' ? '' : <span className="text-muted-foreground font-normal">(opcional)</span>}
            </label>
            <textarea value={reasonDetail} onChange={e => setReasonDetail(e.target.value)} rows={3}
              placeholder="¿Qué pasó?"
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
        </div>
      ) : (
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
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)} className="mt-0.5 rounded" />
            <span className="text-sm">Entiendo que esta acción es irreversible y quiero eliminar la organización de todas formas.</span>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </Modal>
  );
}
