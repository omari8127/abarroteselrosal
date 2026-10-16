# Base de datos de la tienda (Supabase)

El proyecto de Supabase anterior (`nyxzfboowawkldmhjmfe`) ya no existe. Mientras no
se cree uno nuevo, la tienda sigue funcionando, pero los pedidos solo llegan por
WhatsApp con el aviso **"Sin registrar en el sistema"**, y no funcionan las cuentas
de cliente.

## 1. Crear el proyecto

1. Entra a <https://supabase.com> e inicia sesión.
2. **New project**. Elige una región cercana (por ejemplo *West US*) y guarda la
   contraseña de la base de datos en un lugar seguro.
3. Espera a que termine de crearse (1–2 minutos).

> El plan gratuito **pausa el proyecto tras una semana sin uso**, y un proyecto
> pausado mucho tiempo se puede perder (probablemente le pasó al anterior). Para la
> tienda en operación conviene el plan Pro o revisar que no se pause.

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

## Cambiar precios o productos

1. Edita [`data/productos.js`](../data/productos.js).
2. Ejecuta `npm run productos:sql` (regenera `productos.sql`).
3. Pega `productos.sql` en el SQL Editor y ejecútalo.

Si te saltas el paso 3, el cliente verá un precio en la página pero el pedido se
cobrará con el de la base de datos (el resumen le avisa que "algunos precios se
actualizaron").

## Ver y atender pedidos

Por ahora, en **Table Editor → orders** (y `order_items` para ver los productos).
El `id` es el folio que aparece en el WhatsApp del cliente (`Pedido #123`).
Cambia `status` a `done` (entregado) o `canceled` (cancelado); el cliente lo ve en
**Mi cuenta → Mis pedidos**.

## Qué protege la base de datos

- El total se calcula en el servidor con los precios de la tabla `products`; lo que
  mande el navegador del cliente no cuenta.
- Nadie puede crear, cambiar ni borrar pedidos o precios desde la página, solo con
  `crear_pedido`, que revisa productos, cantidades, teléfono, dirección y pago.
- Cada cliente ve solo su perfil y sus pedidos.
- Máximo 5 pedidos por teléfono por hora, para frenar pedidos falsos en serie.
- El envío a domicilio ($10.00) está en `private.calcular_pedido` (`c_envio`); si
  cambia, edítalo ahí **y** en `SHIPPING_FEE` de `js/checkout.js`.
