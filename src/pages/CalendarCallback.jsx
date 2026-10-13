import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { googleCalendar } from '@/lib/googleCalendar';

// Google redirige acá después del consentimiento (ver getGoogleAuthUrl en
// googleCalendar.js, que arma el redirect_uri como `${origin}/calendar/callback`
// — debe coincidir exactamente con el GOOGLE_REDIRECT_URI configurado como
// secret de la Edge Function y como Authorized redirect URI en Google Cloud).
export default function CalendarCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const oauthError = searchParams.get('error');
    if (oauthError) {
      setStatus('error');
      setError('Cancelaste el acceso a Google Calendar.');
      return;
    }
    if (!code) {
      setStatus('error');
      setError('Falta el código de autorización de Google.');
      return;
    }
    googleCalendar.connect(code)
      .then(() => setStatus('done'))
      .catch(err => { setStatus('error'); setError(err.message || 'No se pudo conectar Google Calendar'); });
  }, [searchParams]);

  useEffect(() => {
    if (status === 'done') {
      const t = setTimeout(() => navigate('/perfil'), 1500);
      return () => clearTimeout(t);
    }
  }, [status, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-card rounded-2xl border border-border card-shadow p-8 max-w-sm w-full text-center space-y-3">
        {status === 'connecting' && (
          <>
            <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Conectando con Google Calendar…</p>
          </>
        )}
        {status === 'done' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-success mx-auto" />
            <p className="font-semibold">¡Google Calendar conectado!</p>
            <p className="text-sm text-muted-foreground">Te llevamos de vuelta a tu perfil…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="font-semibold">No se pudo conectar</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button onClick={() => navigate('/perfil')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 mt-2">
              Volver a mi perfil
            </button>
          </>
        )}
      </div>
    </div>
  );
}
