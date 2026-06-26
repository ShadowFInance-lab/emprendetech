# EmprendeTech — Plataforma SaaS para Negocios

Catálogo web profesional + inventario + punto de venta + dashboard, todo desde el navegador.
Construido para pequeños y medianos negocios de México y LATAM.

## Stack

- **Next.js 14** (App Router, Server Actions, Server Components)
- **Supabase** (PostgreSQL + Auth + Storage + RLS)
- **Tailwind CSS** + **shadcn/ui**
- **Mercado Pago** (suscripciones)
- **Vercel** (deploy)

---

## 🚀 Guía de Despliegue (paso a paso)

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → **New Project**
2. Guarda la **contraseña** de la base de datos
3. Cuando termine de crear, ve a **Settings → API** y copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Ejecutar las migraciones SQL

En el **SQL Editor** de Supabase, ejecuta **en orden**:

```
1. supabase/migrations/001_initial_schema.sql   (12 tablas)
2. supabase/migrations/002_rls_policies.sql      (Row Level Security)
3. supabase/migrations/003_triggers.sql          (stock, folios, alertas)
4. supabase/migrations/004_storage.sql           (bucket de imágenes)
```

> **Antes de ejecutar el 004**: ve a **Storage → New bucket**, crea uno
> llamado `public-assets` y márcalo como **Public**.

(Opcional) Para datos de prueba, crea primero una cuenta + tienda desde la app,
luego ejecuta `005_seed_demo.sql`.

### 3. Configurar Auth en Supabase

En **Authentication → URL Configuration**:
- **Site URL**: `https://tu-dominio.com` (o `http://localhost:3000` en dev)
- **Redirect URLs**: agrega `https://tu-dominio.com/**`

En **Authentication → Providers → Email**: habilita "Confirm email" si quieres
verificación por correo (recomendado).

### 4. Variables de entorno

Completa `.env.local` con los valores reales:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
NEXT_PUBLIC_APP_NAME=EmprendeTech

# Mercado Pago (opcional — la app funciona sin esto)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-...

# Para OAuth Connect de cuenta de tienda (botón Conectar MP en settings)
MERCADOPAGO_CLIENT_ID=...
MERCADOPAGO_CLIENT_SECRET=...
```

### 5. Desarrollo local

```bash
npm install
npm run dev
# → http://localhost:3000
```

### 6. Deploy a Vercel

1. Sube el proyecto a GitHub
2. En [vercel.com](https://vercel.com) → **Import Project** → selecciona el repo
3. Agrega **todas las variables de entorno** de `.env.local`
4. Deploy → ¡listo!

> Cambia `NEXT_PUBLIC_APP_URL` a tu dominio de Vercel/producción.

### 7. Configurar Mercado Pago (opcional)

1. Crea cuenta en [mercadopago.com.mx/developers](https://www.mercadopago.com.mx/developers)
2. Copia el **Access Token** de producción
3. Agrega el webhook: `https://tu-dominio.com/api/webhooks/mercadopago`
4. Configura las variables de entorno y redeploy

---

## 📦 Funcionalidades del MVP

| Módulo | Descripción |
|--------|-------------|
| **Auth** | Registro, login, verificación email, recuperación de contraseña |
| **Onboarding** | Wizard de 3 pasos para crear la tienda |
| **Inventario** | CRUD de productos con múltiples fotos, categorías, búsqueda y filtros |
| **Catálogo público** | 2 skins (Moderna y Minimalista), SEO, WhatsApp, SSR+ISR |
| **POS** | Punto de venta con búsqueda, carrito y descuento automático de stock |
| **Dashboard** | KPIs en tiempo real + gráfica de ventas de 30 días |
| **Suscripciones** | Planes con integración Mercado Pago |

---

## 🗂️ Estructura del proyecto

```
app/
├── login, register, forgot-password, verify-email   (autenticación)
├── dashboard         panel principal con KPIs y gráfica
├── inventory         CRUD productos + categorías
├── sales             POS + historial + detalle
├── customers         CRM básico
├── settings          configuración de tienda (3 tabs)
├── subscription      planes + checkout
├── onboarding        wizard inicial
├── catalog/[slug]    catálogo público (SSR+ISR)
├── pricing           página de planes
└── api/webhooks      webhook de Mercado Pago

components/
├── auth, dashboard, inventory, sales, settings, subscription, catalog
└── ui                shadcn/ui

lib/
├── supabase          clients (browser, server, admin)
├── actions           Server Actions (auth, products, sales, etc.)
├── stores            Zustand (carrito POS)
├── mercadopago       integración de pagos
├── types             tipos TypeScript
├── utils             format, slug, whatsapp
└── constants         límites de planes
```

---

## 🔒 Seguridad

- **Row Level Security** en todas las tablas: cada tienda solo ve sus datos
- **Middleware** protege rutas del dashboard
- **Validación Zod** en todas las Server Actions
- **Triggers PostgreSQL** garantizan integridad del stock (transaccional)

---

## 🧪 QA — Flujos verificados

- ✅ Build de producción sin errores (21 rutas)
- ✅ TypeScript sin errores
- ✅ Registro → verificación → onboarding → dashboard
- ✅ Crear producto → subir fotos → ver en catálogo
- ✅ POS → vender → stock se descuenta → alerta de stock bajo
- ✅ Cancelar venta → stock se devuelve
- ✅ Catálogo público SSR con SEO y WhatsApp

---

Hecho con ❤️ para emprendedores de México y LATAM.
