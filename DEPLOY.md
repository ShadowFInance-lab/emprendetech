# 🚀 Deploy de EmprendeTech a Vercel

El proyecto **ya está listo**: build limpio, git commit hecho, sin secretos en el repo.
Elige UNA de las dos rutas. La **Ruta A (Vercel CLI)** es la más rápida y NO necesita GitHub.

---

## ✅ RUTA A — Vercel CLI (recomendada, ~5 min, sin GitHub)

Abre una terminal en `C:\Users\USER\emprendeia-saas` y corre:

```bash
npm i -g vercel        # instala la CLI (una sola vez)
vercel login           # inicia sesión (abre el navegador)
vercel                 # primer deploy (preview)
```

Cuando `vercel` pregunte:
- **Set up and deploy?** → Yes
- **Which scope?** → tu cuenta
- **Link to existing project?** → No
- **Project name?** → `emprendetech` (o el que quieras)
- **Directory?** → `./` (Enter)
- **Override settings?** → No

Te dará una URL tipo `https://emprendetech-xxxx.vercel.app`.

### Configurar variables de entorno (OBLIGATORIO)
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
# pega: https://lmwjzqhcenlyhxyxoftx.supabase.co  → elige Production, Preview, Development

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# pega: sb_publishable_4Y4AFUj-REgS4LYQlt-KOA_2ZCYkQZR

vercel env add SUPABASE_SERVICE_ROLE_KEY
# pega tu service_role (Supabase → Settings → API → service_role → Reveal)

vercel env add NEXT_PUBLIC_APP_NAME
# escribe: EmprendeTech

vercel env add NEXT_PUBLIC_APP_URL
# pega la URL que te dio Vercel (ej: https://emprendetech.vercel.app)
```

### Deploy final a producción
```bash
vercel --prod
```

---

## 🅱️ RUTA B — GitHub + Vercel (con interfaz web)

1. Crea un repo nuevo en https://github.com/new (ej: `emprendetech`, privado)
2. En tu terminal:
   ```bash
   cd C:\Users\USER\emprendeia-saas
   git remote add origin https://github.com/TU_USUARIO/emprendetech.git
   git push -u origin main
   ```
3. En https://vercel.com/new → **Import** el repo
4. En **Environment Variables**, agrega las 5 de la tabla de abajo
5. **Deploy**

---

## 🔑 Variables de entorno (las 5)

| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://lmwjzqhcenlyhxyxoftx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_4Y4AFUj-REgS4LYQlt-KOA_2ZCYkQZR` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(tu service_role de Supabase → Settings → API)* |
| `NEXT_PUBLIC_APP_NAME` | `EmprendeTech` |
| `NEXT_PUBLIC_APP_URL` | *(la URL de Vercel, ej: `https://emprendetech.vercel.app`)* |

---

## ⚙️ Configurar Supabase para el dominio de producción (IMPORTANTE)

En **Supabase → Authentication → URL Configuration**:
- **Site URL**: `https://TU-URL.vercel.app`
- **Redirect URLs**: agrega `https://TU-URL.vercel.app/**`

(Esto hace que el login, registro y OAuth Google/Facebook funcionen en producción.)

---

## 📋 Migraciones pendientes (para features completas)

Si aún no las corriste, en **Supabase → SQL Editor**:
- `supabase/migrations/006_vip_plus.sql` → activa el plan VIP Plus + contador
- `supabase/migrations/007_offers.sql` → activa ofertas masivas (precio tachado)

---

## ✅ Checklist final
- [ ] Deploy hecho (`vercel --prod` o import en Vercel)
- [ ] 5 variables de entorno configuradas
- [ ] `NEXT_PUBLIC_APP_URL` apunta a la URL real de Vercel
- [ ] Supabase Auth: Site URL + Redirect URLs actualizados
- [ ] Migraciones 006 y 007 ejecutadas
