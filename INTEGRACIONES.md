# 🔌 Integraciones externas — Mercanta Business

Guía para dejar funcionando login social, redes y Mercado Pago. La **arquitectura ya está en el código** (botones en login/registro y botones "Conectar" dentro de Configuración). Aquí están los pasos EXACTOS por red.

> **Dato clave del proyecto**
> URL de callback de Supabase (la misma para todo): 
> `https://lmwjzqhcenlyhxyxoftx.supabase.co/auth/v1/callback`
> Project Ref de Supabase: `lmwjzqhcenlyhxyxoftx`

---

## 1. GOOGLE — pasos exactos

**A) Página exacta donde crear la app:** https://console.cloud.google.com/
**B) Qué botón presionar:**
1. Arriba, selector de proyecto → **"Proyecto nuevo"** → ponle nombre (ej. *Mercanta*) → **Crear**.
2. Menú ☰ → **APIs y servicios → Pantalla de consentimiento OAuth** → tipo **Externo** → **Crear** → llena nombre de app + correo de soporte → **Guardar y continuar** (puedes dejar scopes por defecto).
3. Menú ☰ → **APIs y servicios → Credenciales** → botón **"+ CREAR CREDENCIALES"** → **"ID de cliente de OAuth"**.

**C) Qué tipo de aplicación seleccionar:** **Aplicación web** (Web application).
**D) Qué permisos solicitar:** los básicos `email`, `profile`, `openid` (vienen por defecto; no necesitas verificación de Google para login básico).
**E) Qué Client ID copiar:** el campo **"Tu ID de cliente"** (termina en `.apps.googleusercontent.com`).
**F) Qué Client Secret copiar:** el campo **"Tu secreto de cliente"**.
**G) Dónde pegarlos en Supabase:** Supabase → tu proyecto → **Authentication → Providers → Google** → pega **Client ID** y **Client Secret** → activa el switch **Enable Sign in with Google** → **Save**.
**H) URL de callback a registrar:** en Google, dentro de la credencial, sección **"URIs de redireccionamiento autorizados" → AGREGAR URI**:
`https://lmwjzqhcenlyhxyxoftx.supabase.co/auth/v1/callback`
(Opcional, en "Orígenes autorizados de JavaScript": `https://emprendetech-shadow-black-s-projects.vercel.app`)
**I) Cómo probar:** entra a tu app → **Configuración → Conectar redes → [Conectar] Google**, o en el login pulsa **"Continuar con Google"**. Debe abrir la pantalla oficial de Google y volver con la sesión iniciada / la cuenta vinculada.

---

## 2. FACEBOOK — pasos exactos

**A) Página exacta donde crear la app:** https://developers.facebook.com/apps/
**B) Qué botón presionar:** **"Crear app"** (Create App).
**C) Qué tipo de aplicación seleccionar:** caso de uso **"Autenticar y solicitar datos de usuarios con el inicio de sesión con Facebook"** → tipo **Consumidor / Empresa**. Después, en el panel, **Agregar producto → "Inicio de sesión con Facebook" → Configurar**.
**D) Qué permisos solicitar:** `email` y `public_profile` (login básico; no requieren revisión).
**E) Qué Client ID copiar:** **Configuración → Básica → "Identificador de la app" (App ID)**.
**F) Qué Client Secret copiar:** **Configuración → Básica → "Clave secreta de la app" (App Secret)** → botón **Mostrar**.
**G) Dónde pegarlos en Supabase:** Supabase → **Authentication → Providers → Facebook** → pega **App ID** (en *Client ID*) y **App Secret** (en *Client Secret*) → **Enable** → **Save**.
**H) URL de callback a registrar:** en Facebook → **Inicio de sesión con Facebook → Configuración → "URI de redireccionamiento de OAuth válidos"**:
`https://lmwjzqhcenlyhxyxoftx.supabase.co/auth/v1/callback`
(En *Configuración → Básica* agrega el **Dominio de la app**: `lmwjzqhcenlyhxyxoftx.supabase.co`. Para publicar, pasa la app a **modo Activo**.)
**I) Cómo probar:** app → **Configuración → Conectar redes → [Conectar] Facebook** o login **"Continuar con Facebook"**. Abre Facebook, autorizas y vuelves conectado.

---

## 3. INSTAGRAM BUSINESS — pasos exactos

> ✅ **En la app:** el botón **"Conectar Instagram Business"** abre el **login real de Facebook** pidiendo permisos de Instagram (`instagram_basic`, `pages_show_list`) — sin pegar URLs. Funciona en cuanto el proveedor Facebook está habilitado en Supabase. Para leer datos de IG en producción, Meta exige **Revisión de la app**.
>
> ⚠️ **Por qué vía Facebook:** Supabase no tiene proveedor nativo "Instagram". Una cuenta **Instagram Business** se autentica **a través de Facebook** (debe estar ligada a una Página de Facebook) usando la **Instagram Graph API**.

**A) Página exacta donde crear la app:** https://developers.facebook.com/apps/ (la misma de Facebook; puedes reutilizar la app del paso 2).
**B) Qué botón presionar:** en el panel de la app → **"Agregar producto"** → activa **"Inicio de sesión con Facebook"** y **"Instagram Graph API"**.
**C) Qué tipo de aplicación seleccionar:** tipo **Empresa** (Business).
**D) Qué permisos solicitar (requieren App Review de Meta):** `instagram_basic`, `pages_show_list`, `pages_read_engagement`, `business_management` (agrega `instagram_content_publish` solo si vas a publicar).
**E) Qué Client ID copiar:** el **App ID** de Facebook (Configuración → Básica).
**F) Qué Client Secret copiar:** el **App Secret** de Facebook (Configuración → Básica).
**G) Dónde pegarlos en Supabase:** se pegan en **Authentication → Providers → Facebook** (Instagram Business viaja sobre el proveedor de Facebook; no hay casilla "Instagram" separada).
**H) URL de callback a registrar:** la misma de Facebook:
`https://lmwjzqhcenlyhxyxoftx.supabase.co/auth/v1/callback`
**I) Cómo probar:** 1) Convierte tu Instagram a cuenta **Business/Creador** y enlázala a una **Página de Facebook**. 2) Envía los permisos a **Revisión de la app**. 3) Aprobados, conéctala desde **Configuración → Conectar redes**. Mientras no estén aprobados, solo funciona con tu propia cuenta de desarrollador (modo prueba).

---

## 4. TIKTOK BUSINESS — pasos exactos

> ✅ **En la app:** el **flujo OAuth real de TikTok ya está implementado** (`/api/oauth/tiktok/start` → login oficial de TikTok → `/api/oauth/tiktok/callback` → guarda el token en `social_connections`). El botón **"Conectar TikTok"** abre el login real **en cuanto pongas `TIKTOK_CLIENT_KEY` y `TIKTOK_CLIENT_SECRET` en Vercel**; si faltan, te avisa (no finge conexión).
>
> ⚠️ TikTok no es proveedor nativo de Supabase, por eso usa esta ruta propia (Login Kit) en vez de Supabase Auth.

**A) Página exacta donde crear la app:** https://developers.tiktok.com/ → **Manage apps** (https://developers.tiktok.com/apps).
**B) Qué botón presionar:** **"Connect an app"** (o **"Create an app"**).
**C) Qué tipo de aplicación seleccionar:** app de **TikTok for Developers** con cuenta/identidad **verificada** (para Business añade *TikTok for Business*).
**D) Qué permisos (scopes) solicitar:** `user.info.basic` (perfil); agrega `video.list` / `video.publish` solo si listarás o publicarás videos. Cada scope pasa por **revisión**.
**E) Qué Client ID copiar:** **Client key** (TikTok lo llama *Client key*).
**F) Qué Client Secret copiar:** **Client secret**.
**G) Dónde pegarlos:** TikTok no se pega en Supabase. Van como variables de entorno en **Vercel → Settings → Environment Variables**:
```
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
```
(y se consumen desde una ruta OAuth propia en el servidor).
**H) URL de callback (Redirect URI) a registrar en TikTok:**
`https://emprendetech-shadow-black-s-projects.vercel.app/api/oauth/tiktok/callback`
(esta ruta **ya existe** en la app — solo regístrala en TikTok).
**I) Cómo probar:** pon `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET` en Vercel + Redeploy. Corre la migración `016_social_connections.sql`. Con la app en *sandbox*, agrega tu usuario TikTok como **tester**, ve a Configuración → **Conectar TikTok**, autoriza y verás tu cuenta conectada (con botón Desconectar). En producción requiere la **revisión aprobada**.

---

## 5. Resumen de estados (login social)

| Red | Proveedor nativo en Supabase | Conectar en la plataforma | Qué falta para activarlo |
|---|---|---|---|
| **Google** | ✅ Sí | ✅ Botón [Conectar] real (Identity Linking) | Pegar Client ID/Secret en Supabase + habilitar **Manual Linking** |
| **Facebook** | ✅ Sí | ✅ Botón [Conectar] real | Pegar App ID/Secret en Supabase + Manual Linking |
| **Instagram Business** | ❌ No (vía Facebook) | ✅ Botón abre login real (Facebook + permisos IG) | Facebook habilitado en Supabase + **App Review** para datos IG |
| **TikTok Business** | ❌ No (OAuth propio ✅ implementado) | ✅ Botón abre login real de TikTok | `TIKTOK_CLIENT_KEY/SECRET` en Vercel + migración 016 + app aprobada |

> **Habilitar el botón [Conectar] de Google/Facebook:** además de pegar credenciales, ve a **Supabase → Authentication → Settings** y activa **"Manual linking"** (permite vincular varias identidades a una misma cuenta y desconectarlas).

---

## 6. Mercado Pago (cobros de planes y ventas)

**Arquitectura: ✅ ya implementada** (`createCheckoutAction` → preferencia → Checkout Pro → webhook `/api/webhooks/mercadopago` activa el plan).

### Variables de entorno (Vercel → Settings → Environment Variables, scope **Production**)
```
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-...      (Public Key)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...                (Access Token — SECRETO)
MERCADOPAGO_CLIENT_ID=...                           (para OAuth Connect de cuenta tienda)
MERCADOPAGO_CLIENT_SECRET=...                       (para OAuth Connect de cuenta tienda)
NEXT_PUBLIC_APP_URL=https://emprendetech-shadow-black-s-projects.vercel.app
```
> ⚠️ **Después de agregar/cambiar variables, haz REDEPLOY** (Vercel solo las aplica a deploys nuevos). Verifica en **`/api/mp-status`** que digan `true`.

### Probar Mercado Pago
1. `/api/mp-status` debe decir `mercadopago_access_token_presente: true`.
2. `…/subscription` → **"Elegir VIP Plus"** → abre el Checkout de Mercado Pago.
3. Tarjeta de prueba:
   | Resultado | Tarjeta | CVV | Vence | Titular |
   |---|---|---|---|---|
   | ✅ Aprobado | `5031 7557 3453 0604` | 123 | 11/30 | **APRO** |
   | ❌ Rechazado | misma | 123 | 11/30 | **OTHE** |
   | ⏳ Pendiente | misma | 123 | 11/30 | **CONT** |
4. Al aprobarse → webhook → tu plan cambia a VIP Plus.

---

## 7. Lista completa de variables de entorno

| Variable | Para qué | Dónde se pone | Estado |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Base de datos/Auth | Vercel | ✅ configurada |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Base de datos/Auth | Vercel | ✅ configurada |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhook MP (activar plan) | Vercel | ⚠️ verifica |
| `NEXT_PUBLIC_APP_URL` | URLs de retorno + webhook | Vercel | ⚠️ **crítica** para pagos |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Checkout | Vercel | ⚠️ verifica en /api/mp-status |
| `MERCADOPAGO_ACCESS_TOKEN` | Preferencia + webhook | Vercel | ⚠️ verifica en /api/mp-status |
| `MERCADOPAGO_CLIENT_ID` | OAuth Connect tienda | Vercel | para botón "Conectar MP" |
| `MERCADOPAGO_CLIENT_SECRET` | OAuth Connect tienda | Vercel | para botón "Conectar MP" |
| Google Client ID/Secret | Login + Conectar Google | **Supabase** (no en la app) | ⬜ por configurar |
| Facebook App ID/Secret | Login + Conectar Facebook | **Supabase** (no en la app) | ⬜ por configurar |
| `TIKTOK_CLIENT_KEY` / `_SECRET` | Conectar TikTok (OAuth propio) | Vercel | ⬜ requiere app aprobada |

**Comprueba el estado real de pagos en vivo:** abre `/api/mp-status`.
