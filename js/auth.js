/* ================================================================
   ABARROTES EL ROSAL — auth.js
   Autenticación completa con Supabase Auth (vanilla JS)
   ================================================================ */

/* ── Estado de sesión ─────────────────────────────────────────── */
let _currentUser = null;

/* ── Inicialización al cargar la página ──────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await _initSession();
  _listenAuthChanges();
  _injectAuthModal();
  _injectGuestModal();
  _bindAccountBtn();
});

/* ── Obtener sesión activa ────────────────────────────────────── */
async function _initSession() {
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  _currentUser = session?.user ?? null;
  _updateAccountBtn(_currentUser);
}

/* ── Escuchar cambios de sesión (login, logout, refresh) ─────── */
function _listenAuthChanges() {
  window.supabaseClient.auth.onAuthStateChange((_event, session) => {
    _currentUser = session?.user ?? null;
    _updateAccountBtn(_currentUser);
    if (typeof updateDeliveryInfo === 'function') updateDeliveryInfo();
  });
}

/* ── Actualizar botón "Mi Cuenta" según estado de sesión ─────── */
function _updateAccountBtn(user) {
  const btn = document.getElementById('account-btn');
  if (!btn) return;

  if (user) {
    const name = user.user_metadata?.full_name || user.email.split('@')[0];
    const initial = name.charAt(0).toUpperCase();
    btn.innerHTML = `
      <span class="auth-avatar">${initial}</span>
      <span class="auth-username">${name}</span>
      <span class="auth-chevron">▾</span>
    `;
    btn.onclick = _toggleUserDropdown;
  } else {
    btn.innerHTML = `<span class="icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span><span>Mi Cuenta</span>`;
    btn.onclick = openAuthModal;
  }
}

/* ── Dropdown de usuario logueado ────────────────────────────── */
function _toggleUserDropdown(e) {
  e.stopPropagation();
  let dd = document.getElementById('user-dropdown');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'user-dropdown';
    dd.className = 'user-dropdown';
    dd.innerHTML = `
      <a href="mi-cuenta.html#perfil" class="user-dd-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#555"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Ver / Editar Perfil
      </a>
      <a href="mi-cuenta.html#pedidos" class="user-dd-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#555"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg> Mis Pedidos
      </a>
      <div class="user-dd-divider"></div>
      <button class="user-dd-item user-dd-signout" onclick="signOut()" style="color: #ec1d25;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#ec1d25"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> Cerrar Sesión
      </button>
    `;
    document.getElementById('account-btn').parentElement.style.position = 'relative';
    document.getElementById('account-btn').parentElement.appendChild(dd);
  }
  dd.classList.toggle('open');
  // Cerrar al hacer click fuera
  setTimeout(() => {
    document.addEventListener('click', function closeDD(ev) {
      if (!dd.contains(ev.target)) {
        dd.classList.remove('open');
        document.removeEventListener('click', closeDD);
      }
    });
  }, 0);
}

/* ── Iconos de línea para el modal ───────────────────────────── */
function _icon(d, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
}
const _ICON_MAIL = '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>';
const _ICON_LOCK = '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';
const _ICON_USER = '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
const _ICON_CHECK = '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>';
const _ICON_EYE = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>';
const _ICON_EYE_OFF = '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>';
const _GOOGLE_LOGO = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>';

function _eyeButton(inputId) {
  return `<button type="button" class="auth-eye" onclick="togglePassword('${inputId}', this)" aria-label="Mostrar contraseña">${_icon(_ICON_EYE)}</button>`;
}

/* ── Mostrar / ocultar contraseña ────────────────────────────── */
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.innerHTML = _icon(show ? _ICON_EYE_OFF : _ICON_EYE);
  btn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
}

/* ── Título y subtítulo según el panel ───────────────────────── */
const _AUTH_HEADINGS = {
  login:    ['Inicia sesión', 'Consulta tus pedidos y guarda tu dirección de entrega.'],
  register: ['Crea tu cuenta', 'Compra más rápido y sigue tus pedidos desde cualquier lugar.'],
  forgot:   ['Recupera tu contraseña', 'Te enviaremos un enlace a tu correo para crear una nueva.'],
};
function _setAuthHeading(panel) {
  const [title, subtitle] = _AUTH_HEADINGS[panel];
  const t = document.getElementById('auth-title');
  const s = document.getElementById('auth-subtitle');
  if (t) t.textContent = title;
  if (s) s.textContent = subtitle;
}

/* ── Inyectar modal de autenticación en el DOM ───────────────── */
function _injectAuthModal() {
  if (document.getElementById('auth-modal')) return; // ya existe

  const modal = document.createElement('div');
  modal.id = 'auth-modal';
  modal.className = 'auth-backdrop';
  modal.innerHTML = `
    <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button class="auth-close" onclick="closeAuthModal()" aria-label="Cerrar">${_icon('<path d="M18 6 6 18M6 6l12 12"/>', 20)}</button>

      <div class="auth-head">
        <img src="img/logo.png" alt="El Rosal" class="auth-logo">
        <h2 class="auth-title" id="auth-title">Inicia sesión</h2>
        <p class="auth-subtitle" id="auth-subtitle">Consulta tus pedidos y guarda tu dirección de entrega.</p>
      </div>

      <!-- Pestañas -->
      <div class="auth-tabs" role="tablist">
        <button class="auth-tab active" id="tab-login" role="tab" onclick="switchTab('login')">Iniciar sesión</button>
        <button class="auth-tab" id="tab-register" role="tab" onclick="switchTab('register')">Crear cuenta</button>
      </div>

      <!-- Mensaje de error -->
      <div class="auth-error" id="auth-error" role="alert" style="display:none"></div>

      <!-- ═══ PANEL LOGIN ═══ -->
      <div id="panel-login" class="auth-panel active">
        <div class="auth-field">
          <label for="login-email">Correo electrónico</label>
          <div class="auth-input">
            ${_icon(_ICON_MAIL)}
            <input type="email" id="login-email" placeholder="tucorreo@email.com" autocomplete="email">
          </div>
        </div>
        <div class="auth-field">
          <div class="auth-label-row">
            <label for="login-pass">Contraseña</label>
            <a href="#" class="auth-forgot-link" onclick="showForgotPanel(event)">¿Olvidaste tu contraseña?</a>
          </div>
          <div class="auth-input">
            ${_icon(_ICON_LOCK)}
            <input type="password" id="login-pass" placeholder="Tu contraseña" autocomplete="current-password">
            ${_eyeButton('login-pass')}
          </div>
        </div>
        <button class="auth-btn-primary" onclick="loginWithEmail()">Iniciar sesión</button>
        <div class="auth-divider"><span>o continúa con</span></div>
        <button class="auth-btn-google" onclick="loginWithGoogle()">${_GOOGLE_LOGO} Google</button>
      </div>

      <!-- ═══ PANEL REGISTRO ═══ -->
      <div id="panel-register" class="auth-panel">
        <div class="auth-field">
          <label for="reg-name">Nombre completo</label>
          <div class="auth-input">
            ${_icon(_ICON_USER)}
            <input type="text" id="reg-name" placeholder="Tu nombre" autocomplete="name">
          </div>
        </div>
        <div class="auth-field">
          <label for="reg-email">Correo electrónico</label>
          <div class="auth-input">
            ${_icon(_ICON_MAIL)}
            <input type="email" id="reg-email" placeholder="tucorreo@email.com" autocomplete="email">
          </div>
        </div>
        <div class="auth-field">
          <label for="reg-pass">Contraseña</label>
          <div class="auth-input">
            ${_icon(_ICON_LOCK)}
            <input type="password" id="reg-pass" placeholder="Mínimo 6 caracteres" autocomplete="new-password">
            ${_eyeButton('reg-pass')}
          </div>
        </div>
        <div class="auth-field">
          <label for="reg-pass2">Confirmar contraseña</label>
          <div class="auth-input">
            ${_icon(_ICON_LOCK)}
            <input type="password" id="reg-pass2" placeholder="Repite tu contraseña" autocomplete="new-password">
            ${_eyeButton('reg-pass2')}
          </div>
        </div>
        <button class="auth-btn-primary" onclick="registerWithEmail()">Crear cuenta</button>

        <!-- Mensaje de éxito en registro -->
        <div id="reg-success" class="auth-success" role="status" style="display:none">
          ${_icon(_ICON_CHECK, 18)}
          <span>¡Cuenta creada! Revisa tu correo para verificar tu cuenta.</span>
        </div>

        <div class="auth-divider"><span>o continúa con</span></div>
        <button class="auth-btn-google" onclick="loginWithGoogle()">${_GOOGLE_LOGO} Google</button>
      </div>

      <!-- ═══ PANEL OLVIDÉ CONTRASEÑA ═══ -->
      <div id="panel-forgot" class="auth-panel">
        <div class="auth-field">
          <label for="forgot-email">Correo electrónico</label>
          <div class="auth-input">
            ${_icon(_ICON_MAIL)}
            <input type="email" id="forgot-email" placeholder="tucorreo@email.com" autocomplete="email">
          </div>
        </div>
        <button class="auth-btn-primary" id="btn-send-reset" onclick="sendResetEmail()">Enviar enlace</button>
        <div id="forgot-success" class="auth-success" role="status" style="display:none">
          ${_icon(_ICON_CHECK, 18)}
          <span>Listo. Revisa tu correo: te enviamos un enlace para crear una contraseña nueva.</span>
        </div>
        <div id="forgot-error" class="auth-error" role="alert" style="display:none"></div>
        <button class="auth-forgot-back" onclick="hideForgotPanel()">${_icon('<path d="m15 18-6-6 6-6"/>', 18)} Volver a iniciar sesión</button>
      </div>
    </div>
`;

  // Cerrar al hacer click en el fondo
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeAuthModal();
  });

  // Enter envía el formulario del panel activo
  modal.querySelectorAll('.auth-panel input').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') inp.closest('.auth-panel').querySelector('.auth-btn-primary').click();
    });
  });

  document.body.appendChild(modal);
  _injectAuthStyles();
}

/* ── Inyectar modal de invitado en el DOM ───────────────────── */
let _guestCallback = null;

function _injectGuestModal() {
  if (document.getElementById('guest-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'guest-modal';
  modal.className = 'auth-backdrop';
  modal.innerHTML = `
    <div class="auth-modal guest-modal" role="dialog" aria-modal="true" aria-label="Datos de entrega">
      <button class="auth-close" onclick="closeGuestModal()" aria-label="Cerrar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      
      <h2 style="font-family:'Nunito',sans-serif; margin-bottom:1rem; color:var(--auth-red)">Datos de entrega</h2>
      <p style="font-size:0.9rem; color:#666; margin-bottom:1.5rem">Ingresa tus datos para completar el pedido por WhatsApp.</p>

      <div class="auth-panel active">
        <div class="auth-field">
          <label for="guest-name">Nombre completo</label>
          <input type="text" id="guest-name" placeholder="Tu nombre" autocomplete="name">
        </div>
        <div class="auth-field">
          <label for="guest-address">Dirección de entrega</label>
          <input type="text" id="guest-address" placeholder="Calle, número, colonia">
        </div>
        <button class="auth-btn-primary" onclick="_confirmGuestData()">Continuar pedido</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeGuestModal();
  });

  document.body.appendChild(modal);
}

function openGuestModal(callback) {
  _guestCallback = callback;
  const m = document.getElementById('guest-modal');
  if (m) {
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('guest-name')?.focus(), 250);
  }
}

function closeGuestModal() {
  const m = document.getElementById('guest-modal');
  if (m) {
    m.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function _confirmGuestData() {
  const name = document.getElementById('guest-name').value.trim();
  const address = document.getElementById('guest-address').value.trim();
  
  if (!name || !address) {
    alert('Por favor, ingresa tu nombre y dirección para continuar.');
    return;
  }

  if (_guestCallback) {
    _guestCallback({ nombre: name, direccion: address });
  }
  closeGuestModal();
}

/* ── Estilos del modal ────────────────────────────────────────── */
function _injectAuthStyles() {
  if (document.getElementById('auth-styles')) return;
  const style = document.createElement('style');
  style.id = 'auth-styles';
  style.textContent = `
    /* ── Variables de color */
    :root {
      --auth-blue: var(--blue, #004795);
      --auth-blue-dark: var(--blue-dark, #002f6c);
      --auth-blue-soft: #eaf2fc;
      --auth-text: #303030;
      --auth-muted: #6b7280;
      --auth-border: #e5e7eb;
      --auth-red: #ec1d25; /* Keep for small accents if needed */
    }

    /* ── Backdrop ─────────────────────────────────────── */
    .auth-backdrop {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(17, 24, 39, 0.5);
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
      opacity: 0; pointer-events: none;
      transition: opacity 0.2s;
    }
    .auth-backdrop.open {
      opacity: 1; pointer-events: all;
    }

    /* ── Modal box ────────────────────────────────────── */
    .auth-modal {
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.22);
      width: 100%; max-width: 420px;
      padding: 28px 28px 24px;
      position: relative;
      transform: translateY(12px);
      transition: transform 0.22s ease-out;
      max-height: calc(100vh - 2rem);
      overflow-y: auto;
      color: var(--auth-text);
    }
    .auth-backdrop.open .auth-modal {
      transform: translateY(0);
    }

    /* En celular sale desde abajo, como la confirmación del pedido */
    @media (max-width: 560px) {
      .auth-backdrop { align-items: flex-end; padding: 0; }
      .auth-modal {
        max-width: none; max-height: 92vh;
        border-radius: 20px 20px 0 0;
        padding: 24px 20px 20px;
      }
    }

    /* ── Encabezado ───────────────────────────────────── */
    .auth-head { text-align: center; margin-bottom: 20px; }
    .auth-logo { height: 34px; width: auto; display: block; margin: 0 auto 16px; }
    .auth-title { font-size: 1.35rem; font-weight: 800; color: var(--auth-text); line-height: 1.25; }
    .auth-subtitle {
      font-size: 0.9rem;
      color: var(--auth-muted);
      margin-top: 4px;
      line-height: 1.45;
    }

    /* ── Close button ─────────────────────────────────── */
    .auth-close {
      position: absolute; top: 14px; right: 14px;
      background: none; border: none;
      color: var(--auth-muted); cursor: pointer;
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .auth-close:hover { background: #f3f4f6; color: var(--auth-text); }

    /* ── Tabs (selector tipo píldora) ─────────────────── */
    .auth-tabs {
      display: flex; gap: 4px;
      background: #f0f4f8;
      border-radius: 999px;
      padding: 4px;
      margin-bottom: 20px;
    }
    .auth-tab {
      flex: 1; background: transparent; border: none;
      padding: 9px 12px;
      border-radius: 999px;
      font-size: 0.92rem; font-weight: 700;
      color: var(--auth-muted); cursor: pointer;
      transition: background 0.18s, color 0.18s, box-shadow 0.18s;
    }
    .auth-tab.active {
      background: #fff;
      color: var(--auth-blue);
      box-shadow: 0 1px 4px rgba(0,0,0,0.12);
    }
    .auth-tab:hover:not(.active) { color: var(--auth-text); }

    /* ── Panels ───────────────────────────────────────── */
    .auth-panel { display: none; flex-direction: column; gap: 14px; }
    .auth-panel.active { display: flex; }

    /* ── Fields ───────────────────────────────────────── */
    .auth-field { display: flex; flex-direction: column; gap: 6px; }
    .auth-field label { font-size: 0.85rem; font-weight: 700; color: var(--auth-text); }
    .auth-label-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .auth-input {
      position: relative;
      display: flex; align-items: center;
    }
    .auth-input > svg {
      position: absolute; left: 14px;
      color: #9ca3af;
      pointer-events: none;
    }
    .auth-input input {
      width: 100%;
      height: 48px;
      padding: 0 44px 0 42px;
      border: 1.5px solid var(--auth-border);
      border-radius: 12px;
      font-size: 0.95rem;
      color: var(--auth-text);
      background: #fff;
      transition: border-color 0.18s, box-shadow 0.18s;
      outline: none;
    }
    .auth-input input::placeholder { color: #9ca3af; }
    .auth-input input:focus {
      border-color: var(--auth-blue);
      box-shadow: 0 0 0 3px rgba(0,71,149,0.12);
    }
    .auth-input:focus-within > svg { color: var(--auth-blue); }
    .auth-eye {
      position: absolute; right: 6px;
      width: 36px; height: 36px;
      border: none; background: none; border-radius: 50%;
      color: #9ca3af; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .auth-eye:hover { background: #f3f4f6; color: var(--auth-text); }

    /* ── Primary button ───────────────────────────────── */
    .auth-btn-primary {
      background: var(--auth-blue);
      color: #fff;
      border: none;
      height: 50px;
      border-radius: 999px;
      font-size: 1rem; font-weight: 800;
      cursor: pointer;
      transition: background 0.18s;
      width: 100%;
      margin-top: 4px;
    }
    .auth-btn-primary:hover { background: var(--auth-blue-dark); }
    .auth-btn-primary:disabled { opacity: 0.7; cursor: wait; }

    /* ── Google button ────────────────────────────────── */
    .auth-btn-google {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      height: 48px;
      border: 1.5px solid var(--auth-border);
      border-radius: 999px;
      background: #fff;
      font-size: 0.95rem; font-weight: 700; color: var(--auth-text);
      cursor: pointer;
      width: 100%;
      transition: border-color 0.18s, background 0.18s;
    }
    .auth-btn-google:hover { border-color: #cbd5e1; background: #f9fafb; }

    /* ── Divider ──────────────────────────────────────── */
    .auth-divider {
      display: flex; align-items: center; gap: 12px;
      color: var(--auth-muted); font-size: 0.82rem;
    }
    .auth-divider::before, .auth-divider::after {
      content: ''; flex: 1; height: 1px; background: var(--auth-border);
    }

    /* ── Error / Success ──────────────────────────────── */
    .auth-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 0.88rem;
      font-weight: 600;
      margin-bottom: 14px;
    }
    .auth-panel .auth-error { margin-bottom: 0; }
    .auth-success {
      display: flex; gap: 8px; align-items: flex-start;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 0.88rem;
      font-weight: 600;
    }
    .auth-success svg { flex: 0 0 18px; margin-top: 1px; }

    /* ── Forgot password link & panel ─────────────────── */
    .auth-forgot-link {
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--auth-blue);
      text-decoration: none;
    }
    .auth-forgot-link:hover { text-decoration: underline; }
    .auth-forgot-back {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      background: none; border: none; cursor: pointer;
      color: var(--auth-blue); font-size: 0.9rem; font-weight: 700;
      padding: 6px 0;
    }
    .auth-forgot-back:hover { text-decoration: underline; }

    /* ── Header account button ────────────────────────── */
    .header-action { cursor: pointer; }
    .auth-avatar {
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px;
      border-radius: 50%;
      background: var(--auth-blue);
      color: #fff;
      font-size: 0.85rem; font-weight: 700;
    }
    .auth-username {
      font-size: 0.82rem; font-weight: 600;
      max-width: 90px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .auth-chevron { font-size: 0.65rem; opacity: 0.7; }

    /* ── User dropdown ────────────────────────────────── */
    .user-dropdown {
      position: absolute;
      top: calc(100% + 8px); right: 0;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
      min-width: 180px;
      z-index: 8888;
      padding: 6px;
      opacity: 0; pointer-events: none;
      transform: translateY(-6px);
      transition: opacity 0.18s, transform 0.18s;
    }
    .user-dropdown.open { opacity: 1; pointer-events: all; transform: translateY(0); }
    .user-dd-item {
      display: flex; align-items: center; gap: 10px;
      padding: 0.6rem 0.85rem;
      font-size: 0.88rem; font-weight: 500; color: #333;
      text-decoration: none;
      border-radius: 8px;
      border: none; background: none; width: 100%;
      cursor: pointer; text-align: left;
      transition: background 0.15s;
    }
    .user-dd-item:hover { background: #f5f5f5; }
    .user-dd-divider { height: 1px; background: #eee; margin: 4px 0; }
    .user-dd-signout { color: #c00; }
    .user-dd-signout:hover { background: #fff0f0; }
  `;
  document.head.appendChild(style);
}

/* ── Enlazar botón de cuenta ─────────────────────────────────── */
function _bindAccountBtn() {
  const btn = document.getElementById('account-btn');
  if (!btn) return;
  // El onclick se asigna en _updateAccountBtn
}

/* ── Abrir / Cerrar modal ────────────────────────────────────── */
function openAuthModal() {
  const m = document.getElementById('auth-modal');
  if (!m) return;
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
  clearAuthError();
  // Enfocar primer campo
  setTimeout(() => {
    const el = document.getElementById('login-email');
    if (el) el.focus();
  }, 250);
}

function closeAuthModal() {
  const m = document.getElementById('auth-modal');
  if (!m) return;
  m.classList.remove('open');
  document.body.style.overflow = '';
}

/* ── Cambiar pestaña ─────────────────────────────────────────── */
function switchTab(tab) {
  // Ocultar panel de forgot si está visible
  hideForgotPanel();
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('panel-login').classList.toggle('active', tab === 'login');
  document.getElementById('panel-register').classList.toggle('active', tab === 'register');
  _setAuthHeading(tab);
  clearAuthError();
}

/* ── Mostrar panel de contraseña olvidada ────────────────────── */
function showForgotPanel(e) {
  e.preventDefault();
  // Ocultar pestañas y paneles normales
  document.getElementById('auth-tabs') && (document.getElementById('auth-tabs').style.display = 'none');
  document.querySelector('.auth-tabs').style.display = 'none';
  document.getElementById('panel-login').classList.remove('active');
  document.getElementById('panel-register').classList.remove('active');
  document.getElementById('auth-error').style.display = 'none';
  // Mostrar panel forgot
  document.getElementById('panel-forgot').classList.add('active');
  _setAuthHeading('forgot');
  // Pre-llenar email si ya fue ingresado
  const loginEmail = document.getElementById('login-email').value.trim();
  if (loginEmail) document.getElementById('forgot-email').value = loginEmail;
  // Reset mensajes
  document.getElementById('forgot-success').style.display = 'none';
  document.getElementById('forgot-error').style.display = 'none';
  setTimeout(() => document.getElementById('forgot-email')?.focus(), 100);
}

/* ── Ocultar panel de contraseña olvidada ────────────────────── */
function hideForgotPanel() {
  document.querySelector('.auth-tabs').style.display = '';
  document.getElementById('panel-forgot').classList.remove('active');
  document.getElementById('panel-login').classList.add('active');
  document.getElementById('tab-login').classList.add('active');
  document.getElementById('tab-register').classList.remove('active');
  _setAuthHeading('login');
}

/* ── Enviar email de restablecimiento ────────────────────────── */
async function sendResetEmail() {
  const email = document.getElementById('forgot-email').value.trim();
  const successEl = document.getElementById('forgot-success');
  const errorEl   = document.getElementById('forgot-error');
  const btn       = document.getElementById('btn-send-reset');

  successEl.style.display = 'none';
  errorEl.style.display   = 'none';

  if (!email) {
    errorEl.textContent = 'Por favor ingresa tu correo electrónico.';
    errorEl.style.display = 'block';
    return;
  }

  btn.textContent = 'Enviando...'; btn.disabled = true;

  const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password.html'
  });

  btn.textContent = 'Enviar enlace'; btn.disabled = false;

  if (error) {
    errorEl.textContent = error.message || 'Error al enviar el correo. Inténtalo de nuevo.';
    errorEl.style.display = 'block';
  } else {
    successEl.style.display = 'block';
    btn.style.display = 'none';
  }
}

/* ── Mostrar / limpiar error ─────────────────────────────────── */
function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}
function clearAuthError() {
  const el = document.getElementById('auth-error');
  if (el) el.style.display = 'none';
}

/* ── LOGIN con email ─────────────────────────────────────────── */
async function loginWithEmail() {
  clearAuthError();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-pass').value;
  if (!email || !password) { showAuthError('Completa todos los campos.'); return; }

  const btn = document.querySelector('#panel-login .auth-btn-primary');
  btn.textContent = 'Entrando...'; btn.disabled = true;

  const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });

  btn.textContent = 'Iniciar sesión'; btn.disabled = false;

  if (error) {
    showAuthError('Correo o contraseña incorrectos.');
  } else {
    closeAuthModal();
  }
}

/* ── REGISTRO con email ─────────────────────────────────────── */
async function registerWithEmail() {
  clearAuthError();
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const pass     = document.getElementById('reg-pass').value;
  const pass2    = document.getElementById('reg-pass2').value;

  if (!name || !email || !pass || !pass2) { showAuthError('Completa todos los campos.'); return; }
  if (pass !== pass2) { showAuthError('Las contraseñas no coinciden.'); return; }
  if (pass.length < 6) { showAuthError('La contraseña debe tener al menos 6 caracteres.'); return; }

  const btn = document.querySelector('#panel-register .auth-btn-primary');
  btn.textContent = 'Creando cuenta...'; btn.disabled = true;

  const { data, error } = await window.supabaseClient.auth.signUp({
    email, password: pass,
    options: { 
      data: { full_name: name },
      emailRedirectTo: window.location.origin 
    }
  });

  btn.textContent = 'Crear cuenta'; btn.disabled = false;

  if (error) {
    showAuthError(error.message || 'Error al crear la cuenta.');
    return;
  }

  // El perfil en "perfiles" lo crea la base de datos al registrarse
  // (trigger on_auth_user_created en supabase/schema.sql)

  document.getElementById('reg-success').style.display = 'block';
  setTimeout(() => closeAuthModal(), 3000);
}

/* ── LOGIN con Google ────────────────────────────────────────── */
async function loginWithGoogle() {
  await window.supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });
}

/* ── CERRAR SESIÓN ───────────────────────────────────────────── */
async function signOut() {
  await window.supabaseClient.auth.signOut();
  window.location.href = 'index.html';
}

/* ── Obtener usuario actual ──────────────────────────────────── */
function getCurrentUser() {
  return _currentUser;
}

/* ── Click en Mis Pedidos ────────────────────────────────────── */
window.handleMisPedidosClick = function() {
  if (getCurrentUser()) {
    window.location.href = 'mi-cuenta.html#pedidos';
  } else {
    openAuthModal();
  }
};
