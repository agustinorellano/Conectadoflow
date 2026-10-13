// Conectado Flow — factura electrónica con ARCA (ex AFIP), WSFEv1.
//
// Cubre lo que resuelve la gran mayoría de los negocios chicos/medianos:
//   - Factura B (Responsable Inscripto → Consumidor Final/Monotributista),
//     con IVA 21% sin discriminar en el comprobante.
//   - Factura C (Monotributista → cualquiera), sin IVA.
// NO cubre (deliberadamente, para no mandar algo mal armado a ARCA):
//   - Factura A (requiere discriminar IVA por alícuota, RI a RI).
//   - Notas de crédito/débito, exportación, múltiples alícuotas de IVA.
// Esas son extensiones futuras sobre esta misma base, no un cambio de
// arquitectura.
//
// Flujo: WSAA (pedir/reusar un token de acceso, dura 12hs) -> WSFEv1
// (consultar el último comprobante autorizado para no pisar numeración,
// después pedir el CAE). El certificado/clave de cada organización se
// desencripta solo en memoria, acá, y nunca se vuelve a guardar.
//
// Deploy con: supabase functions deploy arca-invoice

import { createClient } from 'npm:@supabase/supabase-js@2';
import forge from 'npm:node-forge@1.3.1';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

function admin() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

async function getCallingUser(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await anon.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

const WSAA_URL: Record<string, string> = {
  homologacion: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
  produccion: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
};
const WSFE_URL: Record<string, string> = {
  homologacion: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  produccion: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
};

// ---------------------------------------------------------------------------
// WSAA: arma el LoginTicketRequest, lo firma en CMS/PKCS7 (detached, DER,
// base64) con el certificado+clave de la organización, y lo intercambia por
// un token+sign que ARCA acepta como prueba de identidad por 12hs.
// ---------------------------------------------------------------------------
function buildLoginTicketXml(): string {
  const now = new Date();
  const gen = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const exp = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<loginTicketRequest version="1.0"><header>` +
    `<uniqueId>${Math.floor(now.getTime() / 1000)}</uniqueId>` +
    `<generationTime>${gen}</generationTime>` +
    `<expirationTime>${exp}</expirationTime>` +
    `</header><service>wsfe</service></loginTicketRequest>`;
}

function signLoginTicket(xml: string, certPem: string, keyPem: string): string {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(xml, 'utf8');
  p7.addCertificate(forge.pki.certificateFromPem(certPem));
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(keyPem),
    certificate: forge.pki.certificateFromPem(certPem),
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign({ detached: false });
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return forge.util.encode64(der);
}

async function wsaaLogin(environment: string, certPem: string, keyPem: string) {
  const cms = signLoginTicket(buildLoginTicketXml(), certPem, keyPem);
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">` +
    `<soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;

  const res = await fetch(WSAA_URL[environment], {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '' },
    body: soapBody,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`WSAA respondió ${res.status}: ${text.slice(0, 500)}`);

  const inner = text.match(/<loginCmsReturn>([\s\S]*?)<\/loginCmsReturn>/)?.[1];
  if (!inner) throw new Error(`No se pudo leer la respuesta de WSAA: ${text.slice(0, 500)}`);
  const decoded = inner.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  const token = decoded.match(/<token>([\s\S]*?)<\/token>/)?.[1];
  const sign = decoded.match(/<sign>([\s\S]*?)<\/sign>/)?.[1];
  const expirationTime = decoded.match(/<expirationTime>([\s\S]*?)<\/expirationTime>/)?.[1];
  if (!token || !sign || !expirationTime) throw new Error(`WSAA no devolvió token/sign: ${decoded.slice(0, 500)}`);
  return { token, sign, expiresAt: new Date(expirationTime) };
}

// Reusa el token cacheado si todavía tiene margen (ARCA los emite por
// 12hs; renovamos 5 minutos antes de que venzan para no pisar el filo).
async function getOrRefreshToken(db: ReturnType<typeof admin>, orgId: string, environment: string, certPem: string, keyPem: string) {
  const { data: cached } = await db.from('arca_tokens').select('*').eq('organization_id', orgId).maybeSingle();
  if (cached && new Date(cached.expires_at).getTime() - Date.now() > 5 * 60 * 1000) {
    return { token: cached.token, sign: cached.sign };
  }
  const { token, sign, expiresAt } = await wsaaLogin(environment, certPem, keyPem);
  await db.from('arca_tokens').upsert({ organization_id: orgId, token, sign, expires_at: expiresAt.toISOString(), updated_date: new Date().toISOString() });
  return { token, sign };
}

// ---------------------------------------------------------------------------
// WSFEv1
// ---------------------------------------------------------------------------
async function soapCall(url: string, soapAction: string, body: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': soapAction },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`WSFEv1 (${soapAction}) respondió ${res.status}: ${text.slice(0, 800)}`);
  return text;
}

function extractErrors(xml: string): string | null {
  // ARCA devuelve <Errors><Err><Code/><Msg/></Err></Errors> cuando algo
  // está mal — nunca falla silenciosamente, así que lo primero es mirar
  // si vino esto antes de buscar el CAE.
  const errs = [...xml.matchAll(/<Code>(\d+)<\/Code>\s*<Msg>([\s\S]*?)<\/Msg>/g)];
  if (errs.length === 0) return null;
  return errs.map(e => `${e[1]}: ${e[2]}`).join(' | ');
}

async function getLastAuthorizedNumber(wsfeUrl: string, cuit: string, token: string, sign: string, ptoVta: number, cbteTipo: number) {
  const soap = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">` +
    `<soapenv:Header/><soapenv:Body><ar:FECompUltimoAutorizado>` +
    `<ar:Auth><ar:Token>${token}</ar:Token><ar:Sign>${sign}</ar:Sign><ar:Cuit>${cuit}</ar:Cuit></ar:Auth>` +
    `<ar:PtoVta>${ptoVta}</ar:PtoVta><ar:CbteTipo>${cbteTipo}</ar:CbteTipo>` +
    `</ar:FECompUltimoAutorizado></soapenv:Body></soapenv:Envelope>`;
  const res = await soapCall(wsfeUrl, 'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado', soap);
  const err = extractErrors(res);
  if (err) throw new Error(`ARCA rechazó la consulta de numeración: ${err}`);
  const n = res.match(/<CbteNro>(\d+)<\/CbteNro>/)?.[1];
  return n ? parseInt(n, 10) : 0;
}

function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function arcaDate(d: Date) { return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`; }

// Nunca le mostramos a un usuario un error técnico crudo (de Postgres, de
// una librería, de la red) — eso es nuestro para diagnosticar, no suyo
// para leer. Todo lo que no sea un mensaje de validación ya redactado por
// nosotros se traduce acá a algo entendible; el detalle real queda en los
// logs de la función (console.error), donde lo podemos ir a buscar.
function friendlyError(raw: unknown, context: string): string {
  const message = raw instanceof Error ? raw.message : String(raw);
  console.error(`[arca-invoice] ${context}:`, message);

  // Errores de Postgres/infraestructura (nunca deberían llegar al usuario
  // tal cual — son nuestros para diagnosticar, no suyos para leer).
  if (/pgp_sym_|does not exist|relation .* does not exist|permission denied|column .* does not exist/i.test(message)) {
    return 'Ocurrió un error técnico al leer la configuración de facturación de tu organización. Avisale al administrador del sistema.';
  }
  if (/fetch failed|network|ECONNREFUSED|timeout|respondió \d\d\d:|No se pudo leer la respuesta/i.test(message)) {
    return 'No se pudo conectar con ARCA en este momento (puede estar caído o el certificado no es válido). Probá de nuevo en unos minutos; si sigue fallando, revisá el certificado cargado en Configuración → Facturación.';
  }
  // Lo que queda ya es un mensaje pensado para el usuario: nuestras
  // propias validaciones, o el motivo que da ARCA al rechazar el
  // comprobante (útil tal cual — lo necesita para corregir el dato).
  return message;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const caller = await getCallingUser(req);
    if (!caller) return json({ error: 'No autenticado' }, 401);

    const db = admin();
    const { data: callerProfile } = await db.from('profiles').select('organization_id').eq('id', caller.id).single();
    if (!callerProfile?.organization_id) return json({ error: 'Tu cuenta no pertenece a una organización' }, 403);

    const { sale_id } = await req.json().catch(() => ({}));
    if (!sale_id) return json({ error: 'Falta sale_id' }, 400);

    const { data: sale } = await db.from('sales').select('*').eq('id', sale_id).eq('organization_id', callerProfile.organization_id).single();
    if (!sale) return json({ error: 'Venta no encontrada' }, 404);
    if (sale.arca_status === 'Facturada') return json({ error: 'Esta venta ya tiene un CAE asignado' }, 400);

    const { data: client } = await db.from('clients').select('*').eq('id', sale.client_id).maybeSingle();
    const { data: config } = await db.from('app_config').select('*').eq('organization_id', callerProfile.organization_id).maybeSingle();

    const { data: credsRows, error: credsErr } = await db.rpc('arca_get_decrypted_credentials', { org_id: callerProfile.organization_id });
    if (credsErr) return json({ error: friendlyError(credsErr, 'leyendo credenciales') }, 400);
    const creds = credsRows?.[0];
    if (!creds) return json({ error: 'Esta organización todavía no configuró su certificado de ARCA (Configuración → Facturación)' }, 400);

    // Tipo de comprobante: RI -> Factura B (6, IVA 21% sin discriminar),
    // Monotributista -> Factura C (11, sin IVA). Cualquier otra condición
    // fiscal (o ninguna cargada) no está cubierta todavía.
    const billingType = config?.billing_type;
    let cbteTipo: number;
    if (billingType === 'Responsable Inscripto') cbteTipo = 6;
    else if (billingType === 'Monotributista') cbteTipo = 11;
    else return json({ error: 'Para facturar hace falta cargar la Condición fiscal (Responsable Inscripto o Monotributista) en Configuración → Facturación' }, 400);

    // Consumidor Final si el cliente no tiene CUIT/DNI cargado.
    const docNro = (client?.tax_id || '').replace(/\D/g, '');
    const docTipo = docNro.length === 11 ? 80 /* CUIT */ : docNro.length > 0 ? 96 /* DNI */ : 99 /* Consumidor Final */;

    const wsfeUrl = WSFE_URL[creds.environment];
    const { token, sign } = await getOrRefreshToken(db, callerProfile.organization_id, creds.environment, creds.certificate, creds.private_key);

    const lastNro = await getLastAuthorizedNumber(wsfeUrl, creds.cuit, token, sign, creds.punto_venta, cbteTipo);
    const nextNro = lastNro + 1;

    const impTotal = Number(sale.total_amount) || 0;
    const impIVA = cbteTipo === 6 ? Number(sale.tax) || 0 : 0;
    const impNeto = cbteTipo === 6 ? impTotal - impIVA : impTotal;
    const ivaBlock = cbteTipo === 6
      ? `<ar:Iva><ar:AlicIva><ar:Id>5</ar:Id><ar:BaseImp>${impNeto.toFixed(2)}</ar:BaseImp><ar:Importe>${impIVA.toFixed(2)}</ar:Importe></ar:AlicIva></ar:Iva>`
      : '';

    const soap = `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">` +
      `<soapenv:Header/><soapenv:Body><ar:FECAESolicitar>` +
      `<ar:Auth><ar:Token>${token}</ar:Token><ar:Sign>${sign}</ar:Sign><ar:Cuit>${creds.cuit}</ar:Cuit></ar:Auth>` +
      `<ar:FeCAEReq>` +
      `<ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${creds.punto_venta}</ar:PtoVta><ar:CbteTipo>${cbteTipo}</ar:CbteTipo></ar:FeCabReq>` +
      `<ar:FeDetReq><ar:FECAEDetRequest>` +
      `<ar:Concepto>1</ar:Concepto><ar:DocTipo>${docTipo}</ar:DocTipo><ar:DocNro>${docTipo === 99 ? 0 : docNro}</ar:DocNro>` +
      `<ar:CbteDesde>${nextNro}</ar:CbteDesde><ar:CbteHasta>${nextNro}</ar:CbteHasta>` +
      `<ar:CbteFch>${arcaDate(new Date(sale.date || sale.created_date))}</ar:CbteFch>` +
      `<ar:ImpTotal>${impTotal.toFixed(2)}</ar:ImpTotal><ar:ImpTotConc>0.00</ar:ImpTotConc>` +
      `<ar:ImpNeto>${impNeto.toFixed(2)}</ar:ImpNeto><ar:ImpOpEx>0.00</ar:ImpOpEx>` +
      `<ar:ImpIVA>${impIVA.toFixed(2)}</ar:ImpIVA><ar:ImpTrib>0.00</ar:ImpTrib>` +
      `<ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz>` +
      ivaBlock +
      `</ar:FECAEDetRequest></ar:FeDetReq>` +
      `</ar:FeCAEReq></ar:FECAESolicitar></soapenv:Body></soapenv:Envelope>`;

    const res = await soapCall(wsfeUrl, 'http://ar.gov.afip.dif.FEV1/FECAESolicitar', soap);
    const err = extractErrors(res);
    const cae = res.match(/<CAE>(\d+)<\/CAE>/)?.[1];
    const caeVto = res.match(/<CAEFchVto>(\d{8})<\/CAEFchVto>/)?.[1];

    if (err || !cae) {
      await db.from('sales').update({ arca_status: 'Error', arca_error: err || 'ARCA no devolvió un CAE' }).eq('id', sale_id);
      return json({ error: err || 'ARCA no devolvió un CAE' }, 400);
    }

    const caeVtoIso = caeVto ? `${caeVto.slice(0, 4)}-${caeVto.slice(4, 6)}-${caeVto.slice(6, 8)}` : null;
    await db.from('sales').update({
      arca_status: 'Facturada', arca_error: null, arca_cae: cae, arca_cae_vencimiento: caeVtoIso,
      arca_comprobante_tipo: cbteTipo, arca_comprobante_numero: nextNro, arca_punto_venta: creds.punto_venta,
    }).eq('id', sale_id);

    return json({ success: true, cae, cae_vencimiento: caeVtoIso, comprobante_tipo: cbteTipo, comprobante_numero: nextNro, punto_venta: creds.punto_venta });
  } catch (e) {
    return json({ error: friendlyError(e, 'error inesperado') }, 500);
  }
});
