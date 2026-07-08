// Script de Login administrativo para RH
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const errorAlert = document.getElementById('error-alert');
  const errorMsg = document.getElementById('error-msg');
  const togglePasswordBtn = document.getElementById('toggle-password');

  // Toggle para ver la contraseña
  togglePasswordBtn.addEventListener('click', () => {
    const isPassword = passwordInput.getAttribute('type') === 'password';
    passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
    togglePasswordBtn.innerHTML = isPassword
      ? '<i class="fa-regular fa-eye-slash"></i>'
      : '<i class="fa-regular fa-eye"></i>';
  });

  // Manejo de envío del formulario de Login
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // Credenciales requeridas: Frank / Asd123
    if (username === 'Frank' && password === 'Asd123') {
      // Guardar sesión administrativa en localStorage
      const sessionData = {
        username: username,
        isLoggedIn: true,
        loginTime: new Date().getTime()
      };
      localStorage.setItem('rh_admin_session', JSON.stringify(sessionData));

      // Redirigir al admin panel
      window.location.href = 'admin.html';
    } else {
      // Mostrar alerta de error
      errorMsg.textContent = "Usuario o contraseña incorrectos. Por favor, intente de nuevo.";
      errorAlert.classList.remove('hidden');
    }
  });
});
