# 🔌 Integraciones externas — Mercanta Business

Guía para dejar funcionando login social, redes y Mercado Pago. La **arquitectura ya está en el código**; aquí está exactamente qué credenciales crear y dónde ponerlas.

---

## 1. Login social (Continuar con Google / Facebook)

**Arquitectura: ✅ ya implementada** (botones en login/registro → `supabase.auth.signInWithOAuth` → `/auth/callback` → sesión). **No necesitas variables en la app** — las credenciales van en el panel de Supabase.

### Google
1. Ve a **https://console.cloud.google.com** → crea un proyecto.
2. **APIs y servicios → Pantalla de consentimiento OAuth** → configúrala (External).
3. **Credenciales → Crear credenciales → ID de cliente OAuth → Aplicación web**.
4. En **URI de redirección autorizados** pega:
   `https://lmwjzqhcenlyhxyxoftx.supabase.co/auth/v1/callback`
5. Copia el **Client ID** y **Client Secret**.
6. Supabase → **Authentication → Providers → Google** → pégalos → **Enable** → Save.

### Facebook
1. **https://developers.facebook.com** → Mis apps → Crear app (tipo "Consumidor").
2. Agrega el producto **Facebook Login**.
3. En **Valid OAuth Redirect URIs**: `https://lmwjzqhcenlyhxyxoftx.supabase.co/auth/v1/callback`
4. Copia **App ID** y **App Secret**.
5. Supabase → Authentication → Providers → **Facebook** → pégalos → Enable.

> Apple/Microsoft: Supabase también los soporta (`apple`, `azure`). Cuando los quieras, se agrega el botón y se habilita el provider igual que arriba.

**Después de habilitarlos en Supabase, los botones "Continuar con Google/Facebook" funcionan sin tocar el código.**

---

## 2. Redes del catálogo (Instagram / Facebook / TikTok / WhatsApp)

Esto es **distinto** al login. Vincular la *cuenta de negocio* del cliente por OAuth requiere apps verificadas:
- **WhatsApp Business / Instagram / Facebook** → Meta for Developers + **revisión de negocio** (Graph API permissions).
- **TikTok** → TikTok for Developers + revisión.

Hoy funciona con **@usuario** (sin URL manual). El OAuth real de estas redes es un proyecto que requiere tus apps aprobadas por Meta/TikTok. Variables que harían falta el día que las tengas:
```
META_APP_ID=
META_APP_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
```

---

## 3. Mercado Pago (cobros de planes y ventas)

**Arquitectura: ✅ ya implementada** (`createCheckoutAction` → preferencia → Checkout Pro → webhook `/api/webhooks/mercadopago` activa el plan).

### Variables de entorno (Vercel → Settings → Environment Variables, scope **Production**)
```
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-...      (Public Key)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...                (Access Token — SECRETO)
NEXT_PUBLIC_APP_URL=https://emprendetech-shadow-black-s-projects.vercel.app
```
> ⚠️ **Después de agregar/cambiar variables, haz REDEPLOY** (Vercel solo las aplica a deploys nuevos). Verifica en **`/api/mp-status`** que digan `true`.

### Por qué "solo aparece Mercado Pago Seguro / no abre el pago"
Es porque `MERCADOPAGO_ACCESS_TOKEN` no se está leyendo en el servidor (deploy sin la variable). Al estar `true` en `/api/mp-status`, el botón crea la preferencia y abre el Checkout real.

---

## 4. Modo Sandbox (pruebas sin dinero real)

Para probar sin cobrar de verdad, usa **credenciales de prueba** de Mercado Pago:
1. MP → **Tus integraciones → tu app → Credenciales de prueba** → copia el **TEST** Access Token y Public Key.
2. Ponlos en Vercel (en lugar de los `APP_USR-` de producción) → Redeploy.
3. MP → **Cuentas de prueba** → crea un **vendedor** y un **comprador** de prueba.

---

## 5. PASOS PARA PROBAR MERCADO PAGO

1. Asegúrate de que `/api/mp-status` diga `mercadopago_access_token_presente: true`.
2. Entra a `…/subscription` y pulsa **"Elegir VIP Plus"** → te lleva al Checkout de Mercado Pago.
3. Paga con una **tarjeta de prueba**:
   | Resultado | Tarjeta | CVV | Vence | Titular |
   |---|---|---|---|---|
   | ✅ Aprobado | `5031 7557 3453 0604` (Master) | 123 | 11/30 | **APRO** |
   | ❌ Rechazado | misma tarjeta | 123 | 11/30 | **OTHE** |
   | ⏳ Pendiente | misma tarjeta | 123 | 11/30 | **CONT** |
   (el **nombre del titular** define el resultado del pago).
4. Al aprobarse, Mercado Pago llama al **webhook** → tu plan cambia a VIP Plus.
5. Verifica: vuelve a `…/subscription` → debe decir **"TU PLAN"** en VIP Plus (recarga). Y en la barra lateral el badge del plan se actualiza.
6. Para **rechazado**: usa titular `OTHE` → vuelves con estado "failure" y el plan NO cambia.

---

## 6. Lista completa de variables de entorno

| Variable | Para qué | Dónde se pone | Estado |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Base de datos/Auth | Vercel | ✅ configurada |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Base de datos/Auth | Vercel | ✅ configurada |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhook MP (activar plan) | Vercel | ⚠️ verifica |
| `NEXT_PUBLIC_APP_URL` | URLs de retorno + webhook | Vercel | ⚠️ **crítica** para pagos |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Checkout | Vercel | ⚠️ verifica en /api/mp-status |
| `MERCADOPAGO_ACCESS_TOKEN` | Preferencia + webhook | Vercel | ⚠️ verifica en /api/mp-status |
| Google Client ID/Secret | Login Google | **Supabase** (no en la app) | ⬜ por configurar |
| Facebook App ID/Secret | Login Facebook | **Supabase** (no en la app) | ⬜ por configurar |
| `META_APP_ID` / `META_APP_SECRET` | Redes catálogo (futuro) | Vercel | ⬜ opcional |
| `TIKTOK_CLIENT_KEY` / `_SECRET` | TikTok (futuro) | Vercel | ⬜ opcional |

**Comprueba el estado real en vivo:** abre `/api/mp-status`.
