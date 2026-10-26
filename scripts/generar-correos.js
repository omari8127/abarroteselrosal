// ================================================================
//  Genera las plantillas de correo de Supabase (supabase/correos/)
//  Uso: npm run correos
//  Cada archivo se pega en Supabase → Authentication → Emails →
//  Templates, en la plantilla del mismo nombre, junto con su asunto
//  (ver supabase/correos/LEEME.md).
//  Las variables {{ .ConfirmationURL }}, {{ .Token }}, {{ .Email }} y
//  {{ .NewEmail }} las llena Supabase al enviar el correo.
// ================================================================

const fs = require('fs');
const path = require('path');

const TIENDA = 'https://abarroteselrosal.vercel.app';
const AZUL = '#004795';

// Botón que se ve bien también en Outlook (tabla con fondo)
const boton = (texto, url) => `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px">
                <tr>
                  <td bgcolor="${AZUL}" style="border-radius:8px">
                    <a href="${url}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px">${texto}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6b7280">Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                <a href="${url}" target="_blank" style="color:${AZUL};word-break:break-all">${url}</a></p>`;

// Código de 6 dígitos grande y fácil de copiar
const codigo = token => `
              <div style="margin:24px 0 8px;padding:18px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;text-align:center;font-family:'Courier New',Courier,monospace;font-size:30px;font-weight:bold;letter-spacing:8px;color:#1f2937">${token}</div>`;

function correo({ preencabezado, titulo, cuerpo, accion, aviso }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7">
  <!-- Texto que se ve en la bandeja de entrada junto al asunto -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${preencabezado}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f5f7">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
          <tr>
            <td style="padding:0 4px 20px">
              <a href="${TIENDA}" target="_blank"><img src="${TIENDA}/img/correo-logo.png" width="150" alt="Abarrotes El Rosal" style="display:block;border:0;width:150px;height:auto"></a>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="border:1px solid #e5e7eb;border-radius:12px;padding:36px 36px 32px;font-family:Arial,Helvetica,sans-serif">
              <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#1f2937">${titulo}</h1>
              ${cuerpo}
              ${accion}
              <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #eef0f3;font-size:13px;line-height:1.5;color:#6b7280">${aviso}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8a94a3;text-align:center">
              Abarrotes El Rosal · Calle Huatulco 13609, Anexa 20 de Noviembre, Tijuana, B.C.<br>
              WhatsApp <a href="https://wa.me/526645187312" target="_blank" style="color:#6b7280">664 518 7312</a> · Lunes a domingo, 9:00 am a 9:00 pm<br>
              Este correo se envió a {{ .Email }} porque se usó en <a href="${TIENDA}" target="_blank" style="color:#6b7280">abarroteselrosal.vercel.app</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

const p = texto => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4b5563">${texto}</p>`;
const noFuisteTu = 'Si tú no lo pediste, ignora este correo: tu cuenta sigue segura y no se hará ningún cambio.';
const vence = 'Por seguridad, el enlace vence pronto. Si ya venció, pide uno nuevo desde la tienda.';

const plantillas = [
  {
    archivo: 'confirmar-cuenta.html',
    nombre: 'Confirm signup',
    asunto: 'Confirma tu cuenta de Abarrotes El Rosal',
    preencabezado: 'Un clic y listo: confirma tu correo para empezar a pedir y juntar puntos.',
    titulo: 'Confirma tu correo',
    cuerpo: p('¡Gracias por crear tu cuenta en Abarrotes El Rosal!')
      + p('Confirma tu correo para empezar a pedir. Con tu cuenta ganas <strong style="color:#1f2937">1 punto por cada $10</strong> de compra, más <strong style="color:#1f2937">50 puntos de regalo</strong> cuando te entreguemos tu primer pedido. Cada 50 puntos son $10 de descuento.'),
    accion: boton('Confirmar mi cuenta', '{{ .ConfirmationURL }}'),
    aviso: `Si tú no creaste esta cuenta, ignora este correo. ${vence}`,
  },
  {
    archivo: 'restablecer-contrasena.html',
    nombre: 'Reset password',
    asunto: 'Restablece tu contraseña de Abarrotes El Rosal',
    preencabezado: 'Crea una contraseña nueva para tu cuenta.',
    titulo: 'Restablece tu contraseña',
    cuerpo: p('Recibimos una solicitud para cambiar la contraseña de tu cuenta.')
      + p('Toca el botón para crear una contraseña nueva.'),
    accion: boton('Crear nueva contraseña', '{{ .ConfirmationURL }}'),
    aviso: `${noFuisteTu} ${vence}`,
  },
  {
    archivo: 'enlace-magico.html',
    nombre: 'Magic link',
    asunto: 'Tu enlace para entrar a Abarrotes El Rosal',
    preencabezado: 'Entra a tu cuenta sin contraseña.',
    titulo: 'Entra a tu cuenta',
    cuerpo: p('Toca el botón para entrar a tu cuenta, o escribe este código en la tienda:'),
    accion: codigo('{{ .Token }}') + boton('Entrar a mi cuenta', '{{ .ConfirmationURL }}'),
    aviso: `${noFuisteTu} ${vence}`,
  },
  {
    archivo: 'cambio-de-correo.html',
    nombre: 'Change email address',
    asunto: 'Confirma tu nuevo correo en Abarrotes El Rosal',
    preencabezado: 'Confirma el cambio de correo de tu cuenta.',
    titulo: 'Confirma tu nuevo correo',
    cuerpo: p('Pediste cambiar el correo de tu cuenta de <strong style="color:#1f2937">{{ .Email }}</strong> a <strong style="color:#1f2937">{{ .NewEmail }}</strong>.')
      + p('Toca el botón para confirmar el cambio.'),
    accion: boton('Confirmar cambio de correo', '{{ .ConfirmationURL }}'),
    aviso: `${noFuisteTu} ${vence}`,
  },
  {
    archivo: 'invitacion.html',
    nombre: 'Invite user',
    asunto: 'Te invitaron a Abarrotes El Rosal',
    preencabezado: 'Acepta la invitación y crea tu contraseña.',
    titulo: 'Te invitaron a Abarrotes El Rosal',
    cuerpo: p('Te crearon una cuenta en Abarrotes El Rosal. Acepta la invitación para elegir tu contraseña y entrar.'),
    accion: boton('Aceptar invitación', '{{ .ConfirmationURL }}'),
    aviso: `Si no esperabas esta invitación, ignora este correo. ${vence}`,
  },
  {
    archivo: 'reautenticacion.html',
    nombre: 'Reauthentication',
    asunto: 'Tu código de verificación de Abarrotes El Rosal',
    preencabezado: 'Usa este código para confirmar que eres tú.',
    titulo: 'Confirma que eres tú',
    cuerpo: p('Para continuar con el cambio en tu cuenta, escribe este código en la tienda:'),
    accion: codigo('{{ .Token }}'),
    aviso: `${noFuisteTu} El código vence pronto.`,
  },
];

const dir = path.join(__dirname, '..', 'supabase', 'correos');
fs.mkdirSync(dir, { recursive: true });
for (const t of plantillas) fs.writeFileSync(path.join(dir, t.archivo), correo(t));

// Guía con el asunto de cada plantilla
const filas = plantillas.map(t => `| **${t.nombre}** | ${t.asunto} | [\`${t.archivo}\`](${t.archivo}) |`).join('\n');
fs.writeFileSync(path.join(dir, 'LEEME.md'), `# Correos de la tienda (Supabase)

Generados con \`npm run correos\` (scripts/generar-correos.js); no los edites a mano.

## Pegar las plantillas

En Supabase → **Authentication → Emails → Templates**, para cada plantilla:
pon el **asunto** de la tabla y pega en **Message body** el contenido completo del
archivo. Guarda con **Save changes**.

| Plantilla en Supabase | Asunto | Archivo |
|---|---|---|
${filas}

La tienda hoy usa *Confirm signup* y *Reset password*; las demás quedan listas por
si se usan después.

## Enlaces de los correos

En **Authentication → URL Configuration**:

- **Site URL**: \`https://abarroteselrosal.vercel.app\`
- **Redirect URLs**: agrega \`https://abarroteselrosal.vercel.app/**\` y, para probar
  en tu computadora, \`http://localhost:3000/**\`.

Sin esto, el botón de los correos puede llevar a \`localhost\`.

## Que los correos sí lleguen a tus clientes (SMTP)

El correo que trae Supabase de fábrica **solo envía a los miembros de tu equipo en
Supabase** y muy pocos por hora: sirve para probar, no para clientes. Para la tienda
conecta un servicio propio en **Authentication → Emails → SMTP Settings**
(Enable custom SMTP). La opción más sencilla y gratis es una cuenta de Gmail:

1. En la cuenta de Google de la tienda activa la verificación en dos pasos y crea una
   **contraseña de aplicación** (Cuenta de Google → Seguridad → Contraseñas de aplicaciones).
2. En Supabase llena:
   - **Sender email**: el correo de Gmail de la tienda
   - **Sender name**: \`Abarrotes El Rosal\`
   - **Host**: \`smtp.gmail.com\` · **Port**: \`465\`
   - **Username**: el correo de Gmail · **Password**: la contraseña de aplicación
3. Guarda y crea una cuenta de prueba en la tienda para revisar que llegue.

Si después compras un dominio propio (por ejemplo \`elrosal.mx\`), conviene usar un
servicio como Resend o Brevo con ese dominio para que los correos no caigan en spam.
`);
console.log(`Listo: ${plantillas.length} correos en supabase/correos/`);
