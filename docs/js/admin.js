// JS de la Página Principal Administrativa y Cola de Espera (admin.html)
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verificar sesión
  if (!checkAdminAuth()) return;

  // Asegurar que existan datos obligatorios en Supabase
  await ensureDefaultPsychometricExam();
  await ensureDefaultRegistrationForm();

  // Elementos DOM
  const candidateForm = document.getElementById('candidate-form');
  const candNameInput = document.getElementById('cand-name');
  const candExamSelect = document.getElementById('cand-exam');
  const pendingCandidatesList = document.getElementById('pending-candidates-list');
  const refreshCandidatesBtn = document.getElementById('refresh-candidates-btn');
  const alertBox = document.getElementById('alert-box');
  const alertMsg = document.getElementById('alert-msg');

  let allExams = [];
  let pendingCandidates = [];

  // LOGOUT
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('rh_admin_session');
    window.location.href = 'login.html';
  });

  // Mostrar mensaje de alerta
  function showAlert(msg, isError = false) {
    alertMsg.textContent = msg;
    if (isError) {
      alertBox.className = "bg-rose-100 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl flex items-center justify-between text-sm shadow-sm";
    } else {
      alertBox.className = "bg-emerald-100 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between text-sm shadow-sm";
    }
    alertBox.classList.remove('hidden');
    setTimeout(() => {
      alertBox.classList.add('hidden');
    }, 4000);
  }

  // Cargar Exámenes Técnicos para Asignar
  async function loadExams() {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('exams')
        .select('*')
        .eq('is_psychometric', false)
        .order('name', { ascending: true });

      if (error) throw error;
      allExams = data || [];

      candExamSelect.innerHTML = '<option value="">-- Seleccionar Examen --</option>';
      allExams.forEach(exam => {
        candExamSelect.innerHTML += `<option value="${exam.id}">${exam.name}</option>`;
      });
    } catch (err) {
      console.error(err);
      showAlert("Error al obtener exámenes técnicos: " + err.message, true);
    }
  }

  // Cargar Candidatos Activos/Pendientes
  async function loadPendingCandidates() {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('candidates')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      pendingCandidates = data || [];
      renderPendingCandidates();
    } catch (err) {
      console.error(err);
      showAlert("Error al cargar candidatos activos: " + err.message, true);
    }
  }

  // Renderizar Candidatos en Espera
  function renderPendingCandidates() {
    pendingCandidatesList.innerHTML = "";
    if (pendingCandidates.length === 0) {
      pendingCandidatesList.innerHTML = `
        <div class="text-center py-12 text-gray-400">
          <i class="fa-solid fa-users-slash text-4xl mb-2 text-blue-100 block"></i>
          Aún no hay candidatos en espera hoy.
        </div>
      `;
      return;
    }

    pendingCandidates.forEach(cand => {
      const examName = cand.assigned_exam_name || "Sin examen técnico";
      pendingCandidatesList.innerHTML += `
        <div class="p-4 bg-blue-50/20 hover:bg-blue-50 rounded-2xl border border-blue-100/50 flex items-center justify-between gap-4 transition shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold">
              ${cand.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 class="font-bold text-gray-800 text-sm">${cand.name}</h3>
              <p class="text-xs text-gray-400">Examen: <strong class="text-blue-500">${examName}</strong></p>
            </div>
          </div>
          <button class="delete-cand-btn text-rose-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-xl transition" data-id="${cand.id}">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      `;
    });

    // Vincular botón de inhabilitar
    document.querySelectorAll('.delete-cand-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm("¿Inhabilitar y retirar de la lista de espera?")) {
          await deleteCandidate(id);
        }
      });
    });
  }

  // Eliminar Candidato de Espera
  async function deleteCandidate(id) {
    try {
      const { error } = await supabaseClient
        .from('candidates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showAlert("Candidato retirado de la lista.");
      loadPendingCandidates();
    } catch (err) {
      console.error(err);
      showAlert("Error al inhabilitar candidato: " + err.message, true);
    }
  }

  // Enviar Formulario de Candidato
  candidateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = candNameInput.value.trim();
    const examId = candExamSelect.value;
    const examName = candExamSelect.options[candExamSelect.selectedIndex].text;

    if (!name || !examId) {
      showAlert("Completa todos los campos.", true);
      return;
    }

    try {
      const { error } = await supabaseClient
        .from('candidates')
        .insert([{
          name,
          assigned_exam_id: examId,
          assigned_exam_name: examName,
          status: 'pending'
        }]);

      if (error) throw error;
      showAlert(`¡Candidato ${name} habilitado correctamente!`);
      candidateForm.reset();
      loadPendingCandidates();
    } catch (err) {
      console.error(err);
      showAlert("Error al habilitar acceso: " + err.message, true);
    }
  });

  refreshCandidatesBtn.addEventListener('click', loadPendingCandidates);

  // Inicializar
  await loadExams();
  await loadPendingCandidates();
});
