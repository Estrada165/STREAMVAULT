# StreamVault — Guía de instalación paso a paso

## Lo que necesitas instalar primero (solo una vez)

### 1. Node.js
Ve a https://nodejs.org y descarga la versión **LTS** (la verde).
Instálalo como cualquier programa. Cuando termine, NO necesitas hacer nada más.

### 2. Visual Studio Code (si no lo tienes)
Ve a https://code.visualstudio.com y descárgalo.

---

## Configurar Supabase (tu base de datos gratuita)

### 1. Crear cuenta
Ve a https://supabase.com → Sign Up → crea tu cuenta gratis.

### 2. Crear proyecto
- Click en "New Project"
- Ponle nombre: `streamvault`
- Escribe una contraseña segura (guárdala en algún lado)
- Región: **South America (São Paulo)** — la más cercana a Perú
- Click "Create new project" — espera unos 2 minutos

### 3. Ejecutar el SQL (crear las tablas)
- En el panel izquierdo de Supabase, click en **"SQL Editor"**
- Click en **"New query"**
- Abre el archivo `supabase/migrations/001_init.sql` de tu proyecto
- Copia TODO el contenido y pégalo en el editor de Supabase
- Click en **"Run"** (botón verde abajo a la derecha)
- Si aparece "Success" está todo listo

### 4. Obtener tus claves
- En el panel izquierdo, click en **"Project Settings"** (ícono de engranaje)
- Click en **"API"**
- Copia:
  - **Project URL** → la que empieza con `https://xxxxx.supabase.co`
  - **anon public** → la clave larga que empieza con `eyJ...`

---

## Configurar el proyecto en tu computadora

### 1. Abrir la carpeta en VS Code
- Abre VS Code
- File → Open Folder → selecciona la carpeta `streamvault`

### 2. Crear el archivo .env
- En VS Code, en el explorador de archivos (izquierda), verás el archivo `.env.example`
- Click derecho → Copy
- Click derecho en la carpeta raíz → Paste
- Renómbralo a exactamente: `.env` (sin el `.example`)
- Ábrelo y edítalo:

```
VITE_SUPABASE_URL=https://TU_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...tu-clave-aqui...
VITE_ADMIN_EMAIL=tucorreo@gmail.com
```

Reemplaza los valores con los que copiaste de Supabase y tu correo real.

### 3. Crear tu usuario administrador en Supabase
- En Supabase → panel izquierdo → **Authentication** → **Users**
- Click en "Add user" → "Create new user"
- Email: el mismo correo que pusiste en `VITE_ADMIN_EMAIL`
- Password: la que quieras (mínimo 6 caracteres)
- Click "Create User"

Luego ve al **SQL Editor** y ejecuta esto (reemplaza el email):
```sql
INSERT INTO users (id, email, role, is_active)
SELECT id, email, 'admin', true
FROM auth.users
WHERE email = 'tucorreo@gmail.com';
```

### 4. Abrir la terminal en VS Code
- En VS Code: menú **Terminal** → **New Terminal**
- Verás una ventana negra abajo

### 5. Instalar dependencias
En la terminal, escribe esto y presiona Enter:
```
npm install
```
Espera que descargue todo (puede tardar 1-2 minutos, verás muchos textos).

### 6. Iniciar el proyecto
Cuando termine, escribe:
```
npm run dev
```
Verás algo como:
```
  VITE v5.x.x  ready in 500ms
  ➜  Local:   http://localhost:5173/
```

### 7. Abrir en el navegador
Abre tu navegador y ve a: **http://localhost:5173**

¡Listo! Deberías ver el login de StreamVault.

---

## Poner tus logos

Dentro de la carpeta del proyecto, ve a `public/logos/` y copia ahí todos tus archivos PNG de logos. Los nombres deben coincidir exactamente con los que están en la base de datos (netflix.png, disney.png, etc.). Si la carpeta no existe, créala.

---

## Subir a Vercel (para que esté en internet)

### 1. Crear cuenta en Vercel
Ve a https://vercel.com → Sign Up → usa tu cuenta de GitHub o Google.

### 2. Subir el proyecto a GitHub primero
- En VS Code, abre la terminal y ejecuta:
```
git init
git add .
git commit -m "StreamVault inicial"
```
- Ve a https://github.com → New repository → ponle nombre `streamvault` → Create
- Copia los comandos que GitHub te muestra (los de "push an existing repository") y ejecútalos en la terminal

### 3. Importar en Vercel
- En Vercel → "Add New Project"
- Selecciona tu repositorio `streamvault`
- En **"Environment Variables"** agrega las 3 variables de tu `.env`:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_ADMIN_EMAIL`
- Click "Deploy"
- En 2-3 minutos tendrás tu URL pública como `streamvault.vercel.app`

---

## Resumen de lo que hace cada página

| Rol | Ruta | Descripción |
|-----|------|-------------|
| Admin | /admin | Dashboard general |
| Admin | /admin/proveedores | Activar/desactivar proveedores |
| Admin | /admin/plataformas | Gestionar logos de plataformas |
| Admin | /admin/configuracion | Tipo de cambio USD/PEN |
| Proveedor | /proveedor | Dashboard de tu tienda |
| Proveedor | /proveedor/productos | Crear y editar productos |
| Proveedor | /proveedor/stock | Subir credenciales |
| Proveedor | /proveedor/distribuidores | Ver y recargar saldo a distribuidores |
| Proveedor | /proveedor/ventas | Historial de ventas |
| Proveedor | /proveedor/soporte | Responder tickets |
| Distribuidor | /tienda | Ver y comprar productos |
| Distribuidor | /dashboard | Ver pedidos y credenciales |
| Distribuidor | /carrito | Confirmar compra |
| Distribuidor | /soporte | Ver mis tickets |
| Distribuidor | /perfil | Mis datos y plantilla de WhatsApp |

---

## Si algo no funciona

- **"npm no se reconoce"** → No instalaste Node.js correctamente. Reinicia VS Code después de instalarlo.
- **Pantalla en blanco** → Revisa que el archivo `.env` existe y tiene los valores correctos.
- **"Error de Supabase"** → Verifica que ejecutaste el SQL completo sin errores.
- **No puedo logearme como admin** → Verifica que ejecutaste el INSERT SQL para crear tu perfil de admin.
