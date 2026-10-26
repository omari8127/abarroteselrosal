# Correos de la tienda (Supabase)

Generados con `npm run correos` (scripts/generar-correos.js); no los edites a mano.

## Pegar las plantillas

En Supabase → **Authentication → Emails → Templates**, para cada plantilla:
pon el **asunto** de la tabla y pega en **Message body** el contenido completo del
archivo. Guarda con **Save changes**.

| Plantilla en Supabase | Asunto | Archivo |
|---|---|---|
| **Confirm signup** | Confirma tu cuenta de Abarrotes El Rosal | [`confirmar-cuenta.html`](confirmar-cuenta.html) |
| **Reset password** | Restablece tu contraseña de Abarrotes El Rosal | [`restablecer-contrasena.html`](restablecer-contrasena.html) |
| **Magic link** | Tu enlace para entrar a Abarrotes El Rosal | [`enlace-magico.html`](enlace-magico.html) |
| **Change email address** | Confirma tu nuevo correo en Abarrotes El Rosal | [`cambio-de-correo.html`](cambio-de-correo.html) |
| **Invite user** | Te invitaron a Abarrotes El Rosal | [`invitacion.html`](invitacion.html) |
| **Reauthentication** | Tu código de verificación de Abarrotes El Rosal | [`reautenticacion.html`](reautenticacion.html) |

La tienda hoy usa *Confirm signup* y *Reset password*; las demás quedan listas por
si se usan después.

## Enlaces de los correos

En **Authentication → URL Configuration**:

- **Site URL**: `https://abarroteselrosal.vercel.app`
- **Redirect URLs**: agrega `https://abarroteselrosal.vercel.app/**` y, para probar
  en tu computadora, `http://localhost:3000/**`.

Sin esto, el botón de los correos puede llevar a `localhost`.

## Que los correos sí lleguen a tus clientes (SMTP)

El correo que trae Supabase de fábrica **solo envía a los miembros de tu equipo en
Supabase** y muy pocos por hora: sirve para probar, no para clientes. Para la tienda
conecta un servicio propio en **Authentication → Emails → SMTP Settings**
(Enable custom SMTP). La opción más sencilla y gratis es una cuenta de Gmail:

1. En la cuenta de Google de la tienda activa la verificación en dos pasos y crea una
   **contraseña de aplicación** (Cuenta de Google → Seguridad → Contraseñas de aplicaciones).
2. En Supabase llena:
   - **Sender email**: el correo de Gmail de la tienda
   - **Sender name**: `Abarrotes El Rosal`
   - **Host**: `smtp.gmail.com` · **Port**: `465`
   - **Username**: el correo de Gmail · **Password**: la contraseña de aplicación
3. Guarda y crea una cuenta de prueba en la tienda para revisar que llegue.

Si después compras un dominio propio (por ejemplo `elrosal.mx`), conviene usar un
servicio como Resend o Brevo con ese dominio para que los correos no caigan en spam.
