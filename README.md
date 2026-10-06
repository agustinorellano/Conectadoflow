# Conectado Flow

CRM multicomercio (ventas, cobros, leads, pipeline) — migrado de Base44 a un stack propio: **React + Vite + Supabase**.

## Estado de la migración

- [x] Scaffold del proyecto (Vite, React, Tailwind, React Router, mismos tokens de diseño que la versión en Base44)
- [x] Esquema de base de datos (`supabase/migrations/0001_init.sql`) con las 18 entidades y Row Level Security equivalente a las reglas que ya estaban configuradas en Base44
- [x] Adaptador `src/api/base44Client.js` que expone la misma API que usaban las páginas (`base44.entities.X`, `base44.auth`), implementada sobre Supabase
- [ ] Páginas y componentes de la UI (en progreso)
- [ ] Script de migración de datos desde Base44
- [ ] Deploy en Vercel

## Setup

1. Creá un proyecto gratuito en [supabase.com](https://supabase.com).
2. En el SQL Editor del proyecto, corré el contenido de `supabase/migrations/0001_init.sql`.
3. En **Authentication → Email Templates → Confirm signup**, cambiá el template para que use `{{ .Token }}` (código de 6 dígitos) en vez del link de confirmación — así funciona la verificación por OTP que usa el registro.
4. En **Authentication → Providers**, activá Google si querés login con Google.
5. Copiá `.env.example` a `.env` y completá:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   (Project Settings → API, en el dashboard de Supabase)
6. `npm install && npm run dev`

## Primer usuario

El primer usuario que se registra queda como `admin` automáticamente (ver trigger `handle_new_user` en la migración). Los siguientes quedan como `user`.
