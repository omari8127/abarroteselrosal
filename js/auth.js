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
    btn.innerHTML = `<span class="icon">👤</span><span>Mi Cuenta</span>`;
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
        <span>✏️</span> Ver / Editar Perfil
      </a>
      <a href="mi-cuenta.html#pedidos" class="user-dd-item">
        <span>📦</span> Mis Pedidos
      </a>
      <div class="user-dd-divider"></div>
      <button class="user-dd-item user-dd-signout" onclick="signOut()">
        <span>🚪</span> Cerrar Sesión
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

/* ── Inyectar modal de autenticación en el DOM ───────────────── */
function _injectAuthModal() {
  if (document.getElementById('auth-modal')) return; // ya existe

  const modal = document.createElement('div');
  modal.id = 'auth-modal';
  modal.className = 'auth-backdrop';
  modal.innerHTML = `
    <div class="auth-modal" role="dialog" aria-modal="true" aria-label="Iniciar sesión">
      <button class="auth-close" onclick="closeAuthModal()" aria-label="Cerrar">✕</button>

      <!-- Pestañas -->
      <div class="auth-tabs">
        <button class="auth-tab active" id="tab-login" onclick="switchTab('login')">Iniciar Sesión</button>
        <button class="auth-tab" id="tab-register" onclick="switchTab('register')">Registrarse</button>
      </div>

      <!-- Mensaje de error -->
      <div class="auth-error" id="auth-error" style="display:none"></div>

      <!-- ═══ PANEL LOGIN ═══ -->
      <div id="panel-login" class="auth-panel active">
        <div class="auth-field">
          <label for="login-email">Correo electrónico</label>
          <input type="email" id="login-email" placeholder="tucorreo@email.com" autocomplete="email">
        </div>
        <div class="auth-field">
          <label for="login-pass">Contraseña</label>
          <input type="password" id="login-pass" placeholder="••••••••" autocomplete="current-password">
          <a href="#" class="auth-forgot-link" onclick="showForgotPanel(event)">¿Olvidaste tu contraseña?</a>
        </div>
        <button class="auth-btn-primary" onclick="loginWithEmail()">Entrar</button>
        <div class="auth-divider"><span>o</span></div>
        <button class="auth-btn-google" onclick="loginWithGoogle()">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continuar con Google
        </button>
      </div>

      <!-- ═══ PANEL REGISTRO ═══ -->
      <div id="panel-register" class="auth-panel">
        <div class="auth-field">
          <label for="reg-name">Nombre completo</label>
          <input type="text" id="reg-name" placeholder="Tu nombre" autocomplete="name">
        </div>
        <div class="auth-field">
          <label for="reg-email">Correo electrónico</label>
          <input type="email" id="reg-email" placeholder="tucorreo@email.com" autocomplete="email">
        </div>
        <div class="auth-field">
          <label for="reg-pass">Contraseña</label>
          <input type="password" id="reg-pass" placeholder="Mínimo 6 caracteres" autocomplete="new-password">
        </div>
        <div class="auth-field">
          <label for="reg-pass2">Confirmar contraseña</label>
          <input type="password" id="reg-pass2" placeholder="Repite tu contraseña" autocomplete="new-password">
        </div>
        <button class="auth-btn-primary" onclick="registerWithEmail()">Crear cuenta</button>
        <div class="auth-divider"><span>o</span></div>
        <button class="auth-btn-google" onclick="loginWithGoogle()">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continuar con Google
        </button>

        <!-- Mensaje de éxito en registro -->
        <div id="reg-success" class="auth-success" style="display:none">
          ✅ ¡Cuenta creada! Revisa tu correo para verificar tu cuenta.
        </div>
      </div>

      <!-- ═══ PANEL OLVIDÉ CONTRASEÑA ═══ -->
      <div id="panel-forgot" class="auth-panel">
        <div class="auth-forgot-header">
          <button class="auth-forgot-back" onclick="hideForgotPanel()">← Volver al inicio de sesión</button>
        </div>
        <p class="auth-forgot-desc">Ingresa tu correo y te enviaremos un link para restablecer tu contraseña.</p>
        <div class="auth-field">
          <label for="forgot-email">Correo electrónico</label>
          <input type="email" id="forgot-email" placeholder="tucorreo@email.com" autocomplete="email">
        </div>
        <button class="auth-btn-primary" id="btn-send-reset" onclick="sendResetEmail()">Enviar link</button>
        <div id="forgot-success" class="auth-success" style="display:none">
          ✅ Revisa tu correo, te enviamos el link para restablecer tu contraseña.
        </div>
        <div id="forgot-error" class="auth-error" style="display:none"></div>
      </div>
    </div>
  `;

  // Cerrar al hacer click en el fondo
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeAuthModal();
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
      <button class="auth-close" onclick="closeGuestModal()" aria-label="Cerrar">✕</button>
      
      <h2 style="font-family:'Barlow Condensed',sans-serif; margin-bottom:1rem; color:var(--auth-red)">Datos de entrega</h2>
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
      --auth-red: #ec1d25;
      --auth-red-dark: #c9181d;
    }

    /* ── Backdrop ─────────────────────────────────────── */
    .auth-backdrop {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.55);
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
      opacity: 0; pointer-events: none;
      transition: opacity 0.22s;
    }
    .auth-backdrop.open {
      opacity: 1; pointer-events: all;
    }

    /* ── Modal box ────────────────────────────────────── */
    .auth-modal {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      width: 100%; max-width: 420px;
      padding: 2rem 2rem 1.5rem;
      position: relative;
      transform: translateY(20px);
      transition: transform 0.22s;
      max-height: 90vh;
      overflow-y: auto;
    }
    .auth-backdrop.open .auth-modal {
      transform: translateY(0);
    }
    @media (max-width: 480px) {
      .auth-modal { padding: 1.5rem 1.25rem 1.25rem; max-width: 95vw; }
    }

    /* ── Close button ─────────────────────────────────── */
    .auth-close {
      position: absolute; top: 14px; right: 16px;
      background: none; border: none;
      font-size: 1.2rem; color: #888; cursor: pointer;
      width: 32px; height: 32px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s;
    }
    .auth-close:hover { background: #f0f0f0; color: #333; }

    /* ── Tabs ─────────────────────────────────────────── */
    .auth-tabs {
      display: flex; gap: 0; margin-bottom: 1.5rem;
      border-bottom: 2px solid #eee;
    }
    .auth-tab {
      flex: 1; background: none; border: none;
      padding: 0.75rem 1rem;
      font-size: 0.95rem; font-weight: 600;
      color: #888; cursor: pointer;
      border-bottom: 3px solid transparent;
      margin-bottom: -2px;
      transition: color 0.18s, border-color 0.18s;
    }
    .auth-tab.active {
      color: var(--auth-red);
      border-bottom-color: var(--auth-red);
    }
    .auth-tab:hover:not(.active) { color: #555; }

    /* ── Panels ───────────────────────────────────────── */
    .auth-panel { display: none; flex-direction: column; gap: 0.9rem; }
    .auth-panel.active { display: flex; }

    /* ── Fields ───────────────────────────────────────── */
    .auth-field { display: flex; flex-direction: column; gap: 5px; }
    .auth-field label { font-size: 0.83rem; font-weight: 600; color: #444; }
    .auth-field input {
      padding: 0.65rem 0.9rem;
      border: 1.5px solid #ddd;
      border-radius: 8px;
      font-size: 0.95rem;
      transition: border-color 0.18s, box-shadow 0.18s;
      outline: none;
    }
    .auth-field input:focus {
      border-color: var(--auth-red);
      box-shadow: 0 0 0 3px rgba(236,29,37,0.12);
    }

    /* ── Primary button ───────────────────────────────── */
    .auth-btn-primary {
      background: var(--auth-red);
      color: #fff;
      border: none;
      padding: 0.75rem;
      border-radius: 8px;
      font-size: 1rem; font-weight: 700;
      cursor: pointer;
      transition: background 0.18s, transform 0.15s;
      width: 100%;
      margin-top: 0.25rem;
    }
    .auth-btn-primary:hover { background: var(--auth-red-dark); transform: translateY(-1px); }
    .auth-btn-primary:active { transform: translateY(0); }

    /* ── Google button ────────────────────────────────── */
    .auth-btn-google {
      display: flex; align-items: center; justify-content: center; gap: 10px;
      padding: 0.7rem;
      border: 1.5px solid #ddd;
      border-radius: 8px;
      background: #fff;
      font-size: 0.92rem; font-weight: 600; color: #333;
      cursor: pointer;
      width: 100%;
      transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
    }
    .auth-btn-google:hover {
      border-color: #999;
      background: #fafafa;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    /* ── Divider ──────────────────────────────────────── */
    .auth-divider {
      display: flex; align-items: center; gap: 10px;
      color: #bbb; font-size: 0.8rem;
    }
    .auth-divider::before, .auth-divider::after {
      content: ''; flex: 1; height: 1px; background: #eee;
    }

    /* ── Error / Success ──────────────────────────────── */
    .auth-error {
      background: #fff0f0;
      border: 1px solid #ffc0c0;
      color: #c00;
      border-radius: 8px;
      padding: 0.65rem 0.9rem;
      font-size: 0.88rem;
    }
    .auth-success {
      background: #f0fff4;
      border: 1px solid #a3e8b5;
      color: #166534;
      border-radius: 8px;
      padding: 0.65rem 0.9rem;
      font-size: 0.88rem;
    }

    /* ── Forgot password link & panel ─────────────────── */
    .auth-forgot-link {
      font-size: 0.78rem;
      color: #999;
      text-decoration: none;
      text-align: right;
      align-self: flex-end;
      margin-top: 2px;
      transition: color 0.15s;
    }
    .auth-forgot-link:hover { color: var(--auth-red); text-decoration: underline; }
    .auth-forgot-header { margin-bottom: 0.25rem; }
    .auth-forgot-back {
      background: none; border: none; cursor: pointer;
      color: var(--auth-red); font-size: 0.85rem; font-weight: 600;
      padding: 0; transition: opacity 0.15s;
    }
    .auth-forgot-back:hover { opacity: 0.75; }
    .auth-forgot-desc {
      font-size: 0.88rem; color: #666;
      line-height: 1.5; margin-bottom: 0.25rem;
    }

    /* ── Header account button ────────────────────────── */
    .header-action { cursor: pointer; }
    .auth-avatar {
      display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px;
      border-radius: 50%;
      background: var(--auth-red);
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
    redirectTo: 'https://abarroteselrosal.vercel.app/reset-password.html'
  });

  btn.textContent = 'Enviar link'; btn.disabled = false;

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

  btn.textContent = 'Entrar'; btn.disabled = false;

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

  // Crear perfil en la tabla "perfiles"
  if (data.user) {
    await window.supabaseClient.from('perfiles').upsert({
      id: data.user.id,
      nombre: name,
      telefono: null,
      direccion: null
    });
  }

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
