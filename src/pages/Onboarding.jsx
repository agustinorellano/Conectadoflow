import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Users2, Package, Building2, ShoppingBag, Check, ChevronRight, Sparkles } from 'lucide-react';
import { useData } from '@/lib/DataContext';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const CHANNELS = ['Local','Online','WhatsApp','Instagram','Redes sociales','Web','Vendedores','Referidos','Otro'];

export default function Onboarding() {
  const { config, loadConfig, updateConfig } = useData();
  const { user, checkUserAuth } = useAuth();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState('Independiente');
  const [companyName, setCompanyName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [sellers, setSellers] = useState('2-5');
  const [saleType, setSaleType] = useState('Productos y servicios');
  const [sellTo, setSellTo] = useState('Ambos');
  const [channels, setChannels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (config) {
      setMode(config.mode || 'Independiente');
      setCompanyName(config.company_name || '');
      if (config.onboarded) navigate('/');
    }
  }, [config]);

  const toggleChannel = (c) => {
    setChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const finish = async () => {
    setSaving(true);
    setError('');
    try {
      let currentConfig = config;

      // First-time setup: this user has no organization yet (new signup),
      // so create one and make them its admin before touching any other data.
      if (!user?.organization_id) {
        await base44.auth.createOrganization(companyName || 'Mi empresa');
        await checkUserAuth();
      }

      if (!currentConfig?.id) {
        currentConfig = await loadConfig();
      }

      if (currentConfig?.id) {
        await updateConfig(currentConfig.id, {
          company_name: companyName || 'Conectado Flow',
          mode,
          team_name: mode === 'Equipo' ? teamName : null,
          sellers_count: mode === 'Equipo' ? sellers : null,
          sale_type: saleType,
          sell_to: sellTo,
          channels,
          onboarded: true,
        });
      }
      navigate('/');
    } catch (e) {
      console.error(e);
      setError(e.message || 'Algo salió mal. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    // Step 0: mode
    {
      title: '¿Cómo vas a utilizar Conectado Flow?',
      subtitle: 'Adaptamos la experiencia a tu forma de trabajar.',
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <OptionCard icon={User} title="Soy independiente" subtitle="Gestiono mis ventas yo solo" selected={mode === 'Independiente'} onClick={() => setMode('Independiente')} />
          <OptionCard icon={Users2} title="Somos un equipo" subtitle="Trabajamos con varios vendedores" selected={mode === 'Equipo'} onClick={() => setMode('Equipo')} />
        </div>
      ),
    },
    // Step 1: company info (if team)
    mode === 'Equipo' ? {
      title: 'Contanos sobre tu empresa',
      subtitle: 'Configuramos los permisos del equipo.',
      content: (
        <div className="space-y-4">
          <Field label="Nombre de empresa">
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Mi Empresa SA" className="input" />
          </Field>
          <Field label="Nombre del equipo comercial">
            <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Equipo Ventas" className="input" />
          </Field>
          <Field label="Cantidad aproximada de vendedores">
            <div className="flex flex-wrap gap-2">
              {['1','2-5','6-15','16+'].map(s => (
                <Chip key={s} selected={sellers === s} onClick={() => setSellers(s)}>{s}</Chip>
              ))}
            </div>
          </Field>
        </div>
      ),
    } : {
      title: 'Contanos sobre tu negocio',
      subtitle: 'Personalizamos tu espacio.',
      content: (
        <div className="space-y-4">
          <Field label="Nombre de tu negocio">
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Mi Negocio" className="input" />
          </Field>
        </div>
      ),
    },
    // Step 2: what do you sell
    {
      title: '¿Qué vendés?',
      subtitle: 'Configuramos el catálogo de productos y servicios.',
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <OptionCard icon={Package} title="Productos" subtitle="Bienes físicos o digitales" selected={saleType === 'Productos'} onClick={() => setSaleType('Productos')} />
          <OptionCard icon={Building2} title="Servicios" subtitle="Servicios profesionales" selected={saleType === 'Servicios'} onClick={() => setSaleType('Servicios')} />
          <OptionCard icon={ShoppingBag} title="Ambos" subtitle="Productos y servicios" selected={saleType === 'Productos y servicios'} onClick={() => setSaleType('Productos y servicios')} />
        </div>
      ),
    },
    // Step 3: who do you sell to
    {
      title: '¿A quién vendés?',
      subtitle: 'Adaptamos la ficha de cliente.',
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <OptionCard icon={User} title="Consumidores" subtitle="B2C — personas" selected={sellTo === 'Consumidores'} onClick={() => setSellTo('Consumidores')} />
          <OptionCard icon={Building2} title="Empresas" subtitle="B2B — compañías" selected={sellTo === 'Empresas'} onClick={() => setSellTo('Empresas')} />
          <OptionCard icon={Users2} title="Ambos" subtitle="B2C y B2B" selected={sellTo === 'Ambos'} onClick={() => setSellTo('Ambos')} />
        </div>
      ),
    },
    // Step 4: channels
    {
      title: '¿Cómo vendés?',
      subtitle: 'Seleccioná todos los canales que uses. Podés cambiarlo después.',
      content: (
        <div className="flex flex-wrap gap-2.5">
          {CHANNELS.map(c => (
            <Chip key={c} selected={channels.includes(c)} onClick={() => toggleChannel(c)}>{c}</Chip>
          ))}
        </div>
      ),
    },
    // Step 5: done
    {
      title: '¡Listo!',
      subtitle: 'Tu espacio Conectado Flow está configurado.',
      content: (
        <div className="flex flex-col items-center text-center py-8">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15 }}
            className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center mb-5">
            <Check className="w-10 h-10 text-white" />
          </motion.div>
          <p className="text-lg font-semibold mb-1">Todo configurado</p>
          <p className="text-sm text-muted-foreground max-w-sm">Ya podés empezar a gestionar tus leads, clientes y ventas.</p>
        </div>
      ),
    },
  ];

  const totalSteps = steps.length;
  const canNext = step === 4 ? channels.length > 0 || true : true;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <svg viewBox="0 0 40 40" className="w-6 h-6" fill="none" stroke="white" strokeWidth="2.4">
              <circle cx="15" cy="20" r="8" /><circle cx="25" cy="20" r="8" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-lg leading-tight">Conectado</p>
            <p className="text-primary font-medium leading-tight">Flow</p>
          </div>
        </div>

        <div className="bg-card rounded-3xl border border-border card-shadow-lg p-6 sm:p-8">
          {/* progress */}
          <div className="flex gap-1.5 mb-6">
            {steps.map((_, i) => (
              <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i <= step ? 'bg-primary' : 'bg-secondary')} />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-xl font-bold tracking-tight mb-1">{steps[step].title}</h2>
              <p className="text-sm text-muted-foreground mb-6">{steps[step].subtitle}</p>
              {steps[step].content}
            </motion.div>
          </AnimatePresence>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between mt-8">
            {step > 0 ? (
              <button onClick={() => setStep(step - 1)} className="px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-accent transition-colors">Atrás</button>
            ) : <span />}
            {step < totalSteps - 1 ? (
              <button onClick={() => setStep(step + 1)} disabled={!canNext}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                Continuar <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={finish} disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {saving ? 'Configurando…' : 'Empezar'} <Sparkles className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      <style>{`.input{width:100%;padding:0.625rem 0.875rem;border-radius:0.75rem;border:1px solid hsl(var(--input));background:hsl(var(--background));font-size:0.875rem;outline:none}.input:focus{ring:2px;border-color:hsl(var(--primary))}`}</style>
    </div>
  );
}

function OptionCard({ icon: Icon, title, subtitle, selected, onClick }) {
  return (
    <button onClick={onClick}
      className={cn('relative flex flex-col items-start gap-3 p-5 rounded-2xl border-2 text-left transition-all',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
      {selected && <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center"><Check className="w-3 h-3 text-white" /></span>}
      <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center', selected ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground')}>
        <Icon className="w-5 h-5" />
      </span>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-sm font-medium mb-2 block">{label}</label>
      {children}
    </div>
  );
}

function Chip({ children, selected, onClick }) {
  return (
    <button onClick={onClick}
      className={cn('inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all',
        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/40')}>
      {selected && <Check className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}
