# Base de datos de la tienda (Supabase)

Proyecto actual: `igjhhojtfwzyunymeopt` (ya configurado en `js/supabase-config.js`).
El anterior (`nyxzfboowawkldmhjmfe`) quedó pausado y ya no se usa.

Si la base de datos no responde (proyecto pausado, sin conexión o sin las tablas),
la tienda sigue funcionando, pero los pedidos solo llegan por WhatsApp con el aviso
**"Sin registrar en el sistema"**, y no funcionan las cuentas de cliente.

## 1. Crear el proyecto

1. Entra a <https://supabase.com> e inicia sesión.
2. **New project**. Elige una región cercana (por ejemplo *West US*) y guarda la
   contraseña de la base de datos en un lugar seguro.
3. Espera a que termine de crearse (1–2 minutos).

> El plan gratuito **pausa el proyecto tras una semana sin uso** (le pasó al
> anterior). Para la tienda en operación conviene el plan Pro o revisar que no se
> pause.

## 2. Crear las tablas y la seguridad

En **SQL Editor → New query**, pega y ejecuta (**Run**), en este orden:

1. Todo el contenido de [`schema.sql`](schema.sql) — tablas, reglas de seguridad y
   las funciones `cotizar_pedido` y `crear_pedido`.
2. Todo el contenido de [`productos.sql`](productos.sql) — el catálogo con precios.

Los dos se pueden volver a ejecutar sin perder datos.

## 3. Conectar la página

En **Project Settings → API Keys** copia la *Publishable key* (`sb_publishable_...`),
y en **Project Settings → Data API** la *Project URL*. Pégalas en
[`js/supabase-config.js`](../js/supabase-config.js):

```js
const SUPABASE_URL  = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_...';
```

Esa llave es pública a propósito; la seguridad la dan las reglas de `schema.sql`.
**Nunca** pongas en la página la llave `service_role` / *secret*.

## 4. Cuentas de cliente

En **Authentication → URL Configuration**:

- **Site URL**: la dirección donde quede publicada la tienda (por ejemplo
  `https://www.elrosal.mx`). Para pruebas: `http://localhost:3000`.
- **Redirect URLs**: agrega la misma dirección y también
  `.../reset-password.html` (para recuperar contraseña).

Para "Continuar con Google": **Authentication → Sign In / Providers → Google**, con
un Client ID de Google Cloud. Si no lo configuras, ese botón no funcionará.

## Panel de la tienda (sitio aparte, carpeta `admin/`)

En el panel cambias **precios, ofertas y disponibilidad** de los productos y atiendes
los **pedidos** (marcar entregado o cancelado, escribirle al cliente por WhatsApp).
Los cambios se ven en la tienda en cuanto el cliente recarga la página.

Por seguridad el panel **no está dentro de la tienda**: es otro sitio en Vercel,
conectado a la misma base de datos, y para entrar pide contraseña **y** un código
de la app de autenticación del celular (verificación en dos pasos).

### Publicar el panel en Vercel (una sola vez)

1. En Vercel: **Add New → Project** e importa el mismo repositorio de GitHub.
2. En **Root Directory** elige `admin` y ponle un nombre al proyecto
   (por ejemplo `rosal-panel`). Deja Framework Preset en **Other** y dale **Deploy**.
3. El panel queda en su propia dirección (por ejemplo `rosal-panel.vercel.app`).
   La tienda (`abarroteselrosal.vercel.app/admin`) ya no muestra nada.

En tu computadora, con `npm run dev`, el panel está en `http://localhost:3000/admin/index.html`.

### Verificación en dos pasos

Si al ejecutar una migración sale `relation "public.admins" does not exist`, tu base
se creó con la primera versión de `schema.sql`: ejecuta
[`activar-panel.sql`](activar-panel.sql) (con tu correo al final) y listo, ya trae
todo lo del panel, los avisos en tiempo real y la verificación en dos pasos.

Si no, ejecuta una vez [`migracion-panel-dos-pasos.sql`](migracion-panel-dos-pasos.sql) en el
SQL Editor (las bases nuevas ya la traen en `schema.sql`). La primera vez que entres
al panel te mostrará un código QR: escanéalo con **Google Authenticator** o
**Microsoft Authenticator** y escribe el código de 6 dígitos. Después, cada vez que
entres te pedirá el código que muestre la app.

Si pierdes el celular: en Supabase ve a **Authentication → Users**, abre la cuenta del
administrador y borra su factor de MFA. Al entrar de nuevo al panel podrás configurar
el celular nuevo.

### Activarlo (una sola vez)

1. En **SQL Editor**, vuelve a ejecutar todo [`schema.sql`](schema.sql) y después
   todo [`productos.sql`](productos.sql). No se pierde nada: agregan los permisos
   del panel y los 2 productos que estaban sin precio (quedan como no disponibles).
2. Crea la cuenta del administrador: **Authentication → Users → Add user → Create new
   user**, con su correo y una contraseña segura, y marca **Auto Confirm User**.
3. Dale permiso de administrador en **SQL Editor** (cambia el correo):

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'correo-del-admin@ejemplo.com';
   ```

4. Entra al panel (su dirección de Vercel, o `http://localhost:3000/admin/index.html`) con ese
   correo y contraseña, y configura la verificación en dos pasos.

Para quitarle el acceso a alguien:

```sql
delete from public.admins
where user_id = (select id from auth.users where email = 'correo-del-admin@ejemplo.com');
```

### Cómo se usa

- **Precio**: escribe el precio y presiona Enter (o sal del campo). Se guarda solo.
- **Poner en oferta**: en *Precio antes* escribe el precio normal y en *Precio* el de
  oferta. La tienda muestra el descuento y el producto aparece en **Ofertas**.
- **Quitar oferta**: botón *Quitar oferta*; el producto vuelve a su precio normal.
- **Agotado**: apaga *Disponible*. Deja de mostrarse y no se puede pedir.

## Agregar productos nuevos o cambiar nombres y fotos

Eso sigue en [`data/productos.js`](../data/productos.js) (nombre, foto, descripción):

1. Edita `data/productos.js` (para un producto nuevo usa un `id` que no exista).
2. Ejecuta `npm run productos:sql` y después ejecuta `productos.sql` en el SQL Editor.

`productos.sql` agrega los productos nuevos con su precio, pero **no cambia** precios,
ofertas ni disponibilidad de los que ya existen: eso se maneja desde el panel.

## Precios en .99 y frutas y verduras

Todos los precios terminan en **.99** (al .99 más cercano). Si en el panel escribes
otro precio, se guarda en .99 (45.50 → 45.99). Las frutas y verduras se venden **por
kilo** (y también por pieza, con el peso aproximado de una pieza) o **por pieza**:
eso se define en `data/productos.js` (`venta`, `pesoPza`, `paso`).

Si tu base es anterior a este cambio, ejecuta una vez
[`migracion-precios-y-frutas.sql`](migracion-precios-y-frutas.sql) en el SQL Editor
**antes** de publicar la nueva versión de la tienda. Al final debe mostrar
`precios_sin_99 = 0`.

## Programa de puntos

Con cuenta, el cliente gana **1 punto por cada $10** de productos cuando en el panel
marcas su pedido como **Entregado**, más **50 puntos** con su primer pedido entregado.
Cada **50 puntos = $10 de descuento**, que usa al finalizar su pedido. Si cancelas un
pedido, se le regresan los puntos que usó. Los puntos no vencen. Las reglas están en
"PROGRAMA DE PUNTOS" de `schema.sql` y en `PUNTOS` de `js/checkout.js`.

Si tu base es anterior a los puntos, ejecuta una vez
[`migracion-puntos.sql`](migracion-puntos.sql) **antes** de publicar la nueva versión
de la tienda y del panel.

## Correos

Las plantillas de los correos (confirmar cuenta, restablecer contraseña…) y cómo
conectar un servicio de correo para que lleguen a tus clientes están en
[`correos/LEEME.md`](correos/LEEME.md).

## Pago con tarjeta

Si tu base se creó antes de que existiera el pago con tarjeta, ejecuta una vez
[`migracion-pago-tarjeta.sql`](migracion-pago-tarjeta.sql) en el SQL Editor.
Sin ella, los pedidos con tarjeta se rechazan con "Método de pago inválido".
Las bases nuevas no la necesitan: `schema.sql` ya incluye la tarjeta.

## Pedidos al instante en el panel

Para que los pedidos nuevos lleguen solos al panel de administrador (con campana y aviso),
ejecuta una vez [`migracion-pedidos-en-vivo.sql`](migracion-pedidos-en-vivo.sql)
en el SQL Editor. Las bases nuevas no la necesitan: ya viene en `schema.sql`.

En el panel, toca **Activar avisos** una vez: el navegador pide permiso para
mostrar notificaciones y suena la campana de prueba. Arriba debe decir
**En vivo**; si dice "Revisando cada 30 s", el panel igual avisa, pero con
hasta 30 segundos de retraso.

## Qué protege la base de datos

- El total se calcula en el servidor con los precios de la tabla `products`; lo que
  mande el navegador del cliente no cuenta.
- Los clientes no pueden crear, cambiar ni borrar pedidos o precios: los pedidos solo
  entran con `crear_pedido`, que revisa productos, cantidades, teléfono, dirección y pago.
- Solo las cuentas en la tabla `admins` **que además pasaron la verificación en dos
  pasos** pueden usar el panel, y aun así solo pueden cambiar precio, oferta y
  disponibilidad de productos y el estado de los pedidos. Con la pura contraseña la
  base de datos no deja ver pedidos ni cambiar precios.
- Cada cliente ve solo su perfil y sus pedidos.
- Máximo 5 pedidos por teléfono por hora, para frenar pedidos falsos en serie.
- El envío a domicilio ($10.00) está en `private.calcular_pedido` (`c_envio`); si
  cambia, edítalo ahí **y** en `SHIPPING_FEE` de `js/checkout.js`.
