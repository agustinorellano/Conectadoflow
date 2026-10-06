import {
  LayoutDashboard, Users, UserPlus, KanbanSquare, ShoppingCart,
  Wallet, Calendar, MessageCircle, FileText, BarChart3, Users2,
  Settings, User, ClipboardList, Package,
} from 'lucide-react';

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, section: 'Principal', description: 'Resumen general con KPIs, actividad reciente y métricas clave de tu negocio.' },
  { to: '/leads', label: 'Leads', icon: UserPlus, section: 'Comercial', description: 'Gestioná prospectos y primeros contactos antes de convertirlos en clientes.' },
  { to: '/clientes', label: 'Clientes', icon: Users, section: 'Comercial', description: 'Directorio y fichas completas de tus clientes activos con historial comercial.' },
  { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare, section: 'Comercial', description: 'Embudo visual de oportunidades comerciales en proceso de cierre, tipo Kanban.' },
  { to: '/ventas', label: 'Ventas', icon: ShoppingCart, section: 'Comercial', description: 'Registrá ventas, gestioná cuotas y hacé seguimiento de cobros pendientes.' },
  { to: '/cobros', label: 'Cobros', icon: Wallet, section: 'Comercial', description: 'Controlá pagos pendientes, vencimientos de cuotas y estado de cobranza.' },
  { to: '/productos', label: 'Productos', icon: Package, section: 'Gestión', description: 'Catálogo de productos y servicios con precios, imágenes y control de stock.' },
  { to: '/reuniones', label: 'Reuniones', icon: Calendar, section: 'Gestión', description: 'Agenda y gestioná reuniones con clientes y prospectos.' },
  { to: '/comunicacion', label: 'Comunicación', icon: MessageCircle, section: 'Gestión', description: 'Plantillas de mensajes para WhatsApp y otros canales de contacto.' },
  { to: '/documentos', label: 'Documentos', icon: FileText, section: 'Gestión', description: 'Gestioná facturas, presupuestos y documentos comerciales.' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, section: 'Analytics', description: 'Análisis detallado de ventas, cobros, leads y rendimiento del equipo.' },
  { to: '/reportes', label: 'Reportes', icon: ClipboardList, section: 'Analytics', description: 'Reportes financieros exportables a Excel y PDF con filtros por comercio.' },
  { to: '/equipo', label: 'Equipo', icon: Users2, section: 'Organización', description: 'Gestión de miembros del equipo y asignación de roles.' },
  { to: '/perfil', label: 'Perfil', icon: User, section: 'Organización', description: 'Tu información personal y preferencias de cuenta.' },
  { to: '/configuracion', label: 'Configuración', icon: Settings, section: 'Organización', description: 'Ajustes generales de la aplicación, comercios y medios de pago.' },
];

export const NAV_SECTIONS = ['Principal', 'Comercial', 'Gestión', 'Analytics', 'Organización'];

export const DEFAULT_HIDDEN_NAV = ['/pipeline'];
