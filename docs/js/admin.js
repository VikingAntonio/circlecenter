// JS para el Panel de Administración de RH
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verificar autenticación
  if (!checkAdminAuth()) return;

  // Asegurar que exista el examen psicométrico por defecto en Supabase
  await ensureDefaultPsychometricExam();

  // Elementos del DOM - Control de Tabs
  const tabCandidatesBtn = document.getElementById('tab-candidates-btn');
  const tabExamsBtn = document.getElementById('tab-exams-btn');
  const tabResultsBtn = document.getElementById('tab-results-btn');

  const tabCandidates = document.getElementById('tab-candidates');
  const tabExams = document.getElementById('tab-exams');
  const tabResults = document.getElementById('tab-results');

  // Elementos del DOM - Alertas
  const panelAlert = document.getElementById('panel-alert');
  const panelAlertMsg = document.getElementById('panel-alert-msg');

  // Elementos del DOM - Candidatos
  const candidateForm = document.getElementById('candidate-form');
  const candNameInput = document.getElementById('cand-name');
  const candExamSelect = document.getElementById('cand-exam');
  const pendingCandidatesList = document.getElementById('pending-candidates-list');
  const refreshCandidatesBtn = document.getElementById('refresh-candidates-btn');

  // Elementos del DOM - Exámenes
  const examsList = document.getElementById('exams-list');
  const examEditorForm = document.getElementById('exam-editor-form');
  const editorExamId = document.getElementById('editor-exam-id');
  const examNameInput = document.getElementById('exam-name-input');
  const examDescInput = document.getElementById('exam-desc-input');
  const partsContainer = document.getElementById('parts-container');
  const btnAddPart = document.getElementById('btn-add-part');
  const btnCancelEditor = document.getElementById('btn-cancel-editor');
  const btnNewExam = document.getElementById('btn-new-exam');
  const editorTitle = document.getElementById('editor-title');

  // Elementos del DOM - Resultados e Historial
  const resultsTableBody = document.getElementById('results-table-body');
  const resultsSearch = document.getElementById('results-search');
  const filterVacancy = document.getElementById('filter-vacancy');
  const refreshResultsBtn = document.getElementById('refresh-results-btn');

  // Elementos del DOM - Modal
  const resultModal = document.getElementById('result-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCloseBottomBtn = document.getElementById('modal-close-bottom-btn');
  const modalPrintBtn = document.getElementById('modal-print-btn');
  const modalCandName = document.getElementById('modal-cand-name');
  const modalCandPos = document.getElementById('modal-cand-pos');
  const modalCandEmail = document.getElementById('modal-cand-email');
  const modalCandPhone = document.getElementById('modal-cand-phone');
  const modalCandScore = document.getElementById('modal-cand-score');
  const modalCandPercentage = document.getElementById('modal-cand-percentage');
  const modalCandInfoFields = document.getElementById('modal-cand-info-fields');
  const modalTabPsyBtn = document.getElementById('modal-tab-psy-btn');
  const modalTabTechBtn = document.getElementById('modal-tab-tech-btn');
  const modalAnswersPsy = document.getElementById('modal-answers-psy');
  const modalAnswersTech = document.getElementById('modal-answers-tech');

  // Datos globales locales
  let allExams = [];
  let allCandidates = [];
  let allResults = [];
  let partsData = []; // [{ id, title, questions: [{ id, text, type, options, correct }] }]

  // LOGOUT
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('rh_admin_session');
    window.location.href = 'login.html';
  });

  // TABS NAVIGATION
  function switchTab(activeBtn, activeTab) {
    [tabCandidatesBtn, tabExamsBtn, tabResultsBtn].forEach(btn => {
      btn.className = "flex-1 min-w-[150px] py-3 px-4 rounded-xl font-bold text-sm text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition duration-300 flex items-center justify-center gap-2";
    });
    [tabCandidates, tabExams, tabResults].forEach(tab => tab.classList.add('hidden'));

    activeBtn.className = "flex-1 min-w-[150px] py-3 px-4 rounded-xl font-bold text-sm text-purple-600 bg-purple-100 transition duration-300 flex items-center justify-center gap-2 shadow-sm";
    activeTab.classList.remove('hidden');
  }

  tabCandidatesBtn.addEventListener('click', () => switchTab(tabCandidatesBtn, tabCandidates));
  tabExamsBtn.addEventListener('click', () => switchTab(tabExamsBtn, tabExams));
  tabResultsBtn.addEventListener('click', () => switchTab(tabResultsBtn, tabResults));

  // SHOW ALERT HELPER
  function showAlert(msg, isError = false) {
    panelAlertMsg.textContent = msg;
    if (isError) {
      panelAlert.className = "bg-rose-100 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl flex items-center justify-between shadow-sm";
    } else {
      panelAlert.className = "bg-emerald-100 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center justify-between shadow-sm";
    }
    panelAlert.classList.remove('hidden');
    setTimeout(() => {
      panelAlert.classList.add('hidden');
    }, 4500);
  }

  // ==========================================
  // TAB 1: CANDIDATES LOGIC
  // ==========================================

  // Load available exams into Selects and Local State
  async function loadExams() {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('exams')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      allExams = data || [];

      // Popular select de exámenes asignados
      candExamSelect.innerHTML = '<option value="">-- Seleccionar Examen Técnico --</option>';
      filterVacancy.innerHTML = '<option value="">Todas las vacantes</option>';

      const technicalExams = allExams.filter(e => !e.is_psychometric);

      technicalExams.forEach(exam => {
        candExamSelect.innerHTML += `<option value="${exam.id}">${exam.name}</option>`;
        filterVacancy.innerHTML += `<option value="${exam.name}">${exam.name}</option>`;
      });

      renderExamsList();
    } catch (err) {
      console.error("Error al cargar exámenes:", err);
      showAlert("Error al cargar los exámenes: " + err.message, true);
    }
  }

  // Load Active (Pending) Candidates
  async function loadPendingCandidates() {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('candidates')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      allCandidates = data || [];
      renderPendingCandidates();
    } catch (err) {
      console.error("Error al cargar candidatos:", err);
      showAlert("Error al cargar candidatos: " + err.message, true);
    }
  }

  // Render pending candidates
  function renderPendingCandidates() {
    pendingCandidatesList.innerHTML = "";
    if (allCandidates.length === 0) {
      pendingCandidatesList.innerHTML = `
        <div class="text-center py-12 text-gray-400">
          <i class="fa-solid fa-users-slash text-4xl mb-2 text-purple-200 block"></i>
          Aún no hay candidatos habilitados para hoy.
        </div>
      `;
      return;
    }

    allCandidates.forEach(cand => {
      const examName = cand.assigned_exam_name || "Ninguno asignado";
      const date = new Date(cand.created_at).toLocaleDateString('es-ES', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });

      pendingCandidatesList.innerHTML += `
        <div class="p-4 bg-white hover:bg-purple-50/50 rounded-2xl border border-purple-100 flex items-center justify-between transition gap-4 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-bold">
              ${cand.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 class="font-bold text-gray-800 text-sm">${cand.name}</h3>
              <p class="text-xs text-gray-500">Examen técnico: <span class="font-semibold text-purple-600">${examName}</span></p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-1 rounded-full uppercase">Habilitado</span>
            <button class="delete-candidate-btn text-rose-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition" data-id="${cand.id}">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
      `;
    });

    // Añadir listener a botones de borrar candidato
    document.querySelectorAll('.delete-candidate-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const candId = btn.getAttribute('data-id');
        if (confirm("¿Estás seguro de inhabilitar/eliminar a este candidato de la lista de espera?")) {
          await deleteCandidate(candId);
        }
      });
    });
  }

  // Delete Candidate
  async function deleteCandidate(id) {
    try {
      const { error } = await supabaseClient
        .from('candidates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showAlert("Candidato eliminado exitosamente.");
      loadPendingCandidates();
    } catch (err) {
      console.error(err);
      showAlert("No se pudo eliminar al candidato: " + err.message, true);
    }
  }

  // Submit Candidate Form
  candidateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = candNameInput.value.trim();
    const examId = candExamSelect.value;
    const examName = candExamSelect.options[candExamSelect.selectedIndex].text;

    if (!name || !examId) {
      showAlert("Por favor, completa todos los campos para registrar un candidato.", true);
      return;
    }

    try {
      const { data, error } = await supabaseClient
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
      showAlert("Error al habilitar candidato: " + err.message, true);
    }
  });

  refreshCandidatesBtn.addEventListener('click', loadPendingCandidates);

  // ==========================================
  // TAB 2: EXAMS CRUD LOGIC
  // ==========================================

  function renderExamsList() {
    examsList.innerHTML = "";
    // No listar el examen psicométrico estándar en el editor de técnicos para evitar que lo borren sin querer, o dejarlo visible como de lectura.
    const technicalExams = allExams.filter(e => !e.is_psychometric);

    if (technicalExams.length === 0) {
      examsList.innerHTML = `
        <div class="text-center py-8 text-gray-400">
          No hay exámenes técnicos creados.
        </div>
      `;
      return;
    }

    technicalExams.forEach(exam => {
      examsList.innerHTML += `
        <div class="p-3 bg-white hover:bg-purple-50/50 rounded-xl border border-purple-100 flex items-center justify-between transition gap-2 shadow-sm">
          <div class="truncate">
            <h4 class="font-bold text-gray-800 text-sm truncate">${exam.name}</h4>
            <p class="text-xs text-gray-400 truncate">${exam.description || "Sin descripción"}</p>
          </div>
          <div class="flex gap-1 shrink-0">
            <button class="edit-exam-btn p-1.5 text-purple-500 hover:bg-purple-100 rounded-lg transition" data-id="${exam.id}" title="Editar">
              <i class="fa-solid fa-pencil text-xs"></i>
            </button>
            <button class="delete-exam-btn p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition" data-id="${exam.id}" title="Eliminar">
              <i class="fa-regular fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>
      `;
    });

    // Bind Edit/Delete Buttons
    document.querySelectorAll('.edit-exam-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const exam = allExams.find(e => e.id === id);
        if (exam) loadExamIntoEditor(exam);
      });
    });

    document.querySelectorAll('.delete-exam-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm("¿Estás seguro de que quieres eliminar este examen técnico? No afectará a los reportes de resultados pasados.")) {
          await deleteExam(id);
        }
      });
    });
  }

  // Load Exam into Editor Workspace
  function loadExamIntoEditor(exam) {
    editorTitle.innerHTML = `<i class="fa-solid fa-pen-nib mr-2 text-purple-400"></i>Editar Examen: <span class="text-purple-600 font-extrabold">${exam.name}</span>`;
    editorExamId.value = exam.id;
    examNameInput.value = exam.name;
    examDescInput.value = exam.description || "";

    // Load parts
    partsData = exam.parts || [];
    renderParts();
  }

  // Initialize empty editor
  function resetEditor() {
    editorTitle.innerHTML = `<i class="fa-solid fa-pen-nib mr-2 text-purple-400"></i>Crear / Editar Examen`;
    editorExamId.value = "";
    examNameInput.value = "";
    examDescInput.value = "";
    partsData = [{
      id: "part_" + Date.now(),
      title: "Sección 1",
      questions: []
    }];
    renderParts();
  }

  btnNewExam.addEventListener('click', resetEditor);
  btnCancelEditor.addEventListener('click', resetEditor);

  // Manage Parts & Questions
  btnAddPart.addEventListener('click', () => {
    partsData.push({
      id: "part_" + Date.now(),
      title: `Sección ${partsData.length + 1}`,
      questions: []
    });
    renderParts();
  });

  function renderParts() {
    partsContainer.innerHTML = "";
    if (partsData.length === 0) {
      partsContainer.innerHTML = `
        <div class="text-center py-6 text-gray-400 text-xs">
          Aún no hay secciones en este examen.
        </div>
      `;
      return;
    }

    partsData.forEach((part, partIdx) => {
      const partHtml = `
        <div class="bg-white p-4 rounded-xl border border-purple-100 shadow-sm space-y-3 relative" data-part-id="${part.id}">
          <button type="button" class="btn-delete-part absolute top-4 right-4 text-rose-400 hover:text-rose-600 text-xs font-bold transition" data-idx="${partIdx}">
            <i class="fa-regular fa-trash-can mr-1"></i> Borrar Sección
          </button>

          <div class="w-2/3">
            <label class="block text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">Nombre de la Sección</label>
            <input
              type="text"
              value="${part.title}"
              placeholder="Ej: Sección 1: Teoría Básica"
              class="part-title-input px-3 py-1.5 w-full border border-purple-100 focus:outline-none focus:ring-1 focus:ring-purple-300 rounded-lg text-sm font-semibold"
              data-idx="${partIdx}"
            >
          </div>

          <!-- Questions container in this part -->
          <div class="space-y-3 pt-2">
            <span class="text-xs font-bold text-gray-600 block"><i class="fa-solid fa-clipboard-question text-purple-400 mr-1"></i> Preguntas de esta sección</span>

            <div class="part-questions-list space-y-3" data-idx="${partIdx}">
              ${renderQuestionsForPart(part.questions, partIdx)}
            </div>

            <!-- Add Question actions -->
            <div class="flex flex-wrap gap-2 pt-2">
              <button type="button" class="btn-add-question px-2.5 py-1.5 bg-pink-100 hover:bg-pink-200 text-pink-700 text-xs font-bold rounded-lg transition" data-idx="${partIdx}" data-type="multiple">
                <i class="fa-solid fa-circle-dot mr-1"></i> Opción Múltiple
              </button>
              <button type="button" class="btn-add-question px-2.5 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-bold rounded-lg transition" data-idx="${partIdx}" data-type="boolean">
                <i class="fa-solid fa-circle-half-stroke mr-1"></i> Verdadero / Falso
              </button>
              <button type="button" class="btn-add-question px-2.5 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 text-xs font-bold rounded-lg transition" data-idx="${partIdx}" data-type="short">
                <i class="fa-solid fa-font mr-1"></i> Respuesta Corta
              </button>
            </div>
          </div>
        </div>
      `;
      partsContainer.innerHTML += partHtml;
    });

    // Bind event listeners to dynamic parts inputs
    document.querySelectorAll('.part-title-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const idx = e.target.getAttribute('data-idx');
        partsData[idx].title = e.target.value.trim();
      });
    });

    document.querySelectorAll('.btn-delete-part').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = btn.getAttribute('data-idx');
        partsData.splice(idx, 1);
        renderParts();
      });
    });

    // Bind Question creators
    document.querySelectorAll('.btn-add-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const partIdx = btn.getAttribute('data-idx');
        const qType = btn.getAttribute('data-type');
        addQuestionToPart(partIdx, qType);
      });
    });

    // Bind dynamic values of questions
    bindQuestionInputs();
  }

  function renderQuestionsForPart(questions, partIdx) {
    if (questions.length === 0) {
      return `<div class="text-center py-4 bg-gray-50 rounded-xl border border-dashed border-purple-100 text-[11px] text-gray-400">No hay preguntas creadas para esta sección.</div>`;
    }

    return questions.map((q, qIdx) => {
      let extraHtml = "";

      if (q.type === 'multiple') {
        extraHtml = `
          <div class="grid grid-cols-2 gap-2 mt-2">
            ${[0, 1, 2, 3].map(optIdx => `
              <div>
                <label class="text-[9px] text-gray-400 block font-semibold">Opción ${optIdx + 1}</label>
                <input
                  type="text"
                  value="${q.options[optIdx] || ''}"
                  placeholder="Opción ${optIdx + 1}"
                  class="q-opt-input w-full px-2 py-1 border border-purple-100 focus:outline-none rounded text-xs"
                  data-part-idx="${partIdx}"
                  data-q-idx="${qIdx}"
                  data-opt-idx="${optIdx}"
                >
              </div>
            `).join('')}
          </div>
          <div class="mt-2">
            <label class="text-[10px] text-purple-600 block font-bold">Opción Correcta</label>
            <select
              class="q-correct-select px-2 py-1 border border-purple-200 focus:outline-none rounded text-xs bg-white w-full max-w-xs mt-0.5"
              data-part-idx="${partIdx}"
              data-q-idx="${qIdx}"
            >
              <option value="">Selecciona la opción correcta...</option>
              ${[0, 1, 2, 3].map(optIdx => `
                <option value="${q.options[optIdx] || ''}" ${q.correct === q.options[optIdx] && q.correct ? 'selected' : ''}>
                  ${q.options[optIdx] || `Opción ${optIdx + 1}`}
                </option>
              `).join('')}
            </select>
          </div>
        `;
      } else if (q.type === 'boolean') {
        extraHtml = `
          <div class="mt-2">
            <label class="text-[10px] text-purple-600 block font-bold">Respuesta Correcta</label>
            <select
              class="q-correct-select px-2 py-1 border border-purple-200 focus:outline-none rounded text-xs bg-white w-full max-w-xs mt-0.5"
              data-part-idx="${partIdx}"
              data-q-idx="${qIdx}"
            >
              <option value="">-- Elige --</option>
              <option value="Verdadero" ${q.correct === 'Verdadero' ? 'selected' : ''}>Verdadero</option>
              <option value="Falso" ${q.correct === 'Falso' ? 'selected' : ''}>Falso</option>
            </select>
          </div>
        `;
      } else if (q.type === 'short') {
        extraHtml = `
          <div class="mt-2 text-xs text-purple-400 bg-purple-50/50 p-2 rounded-lg border border-purple-100 flex items-center gap-1.5">
            <i class="fa-solid fa-circle-info"></i> Esta es una pregunta abierta, el reclutador calificará de forma libre en el panel.
          </div>
        `;
      }

      return `
        <div class="p-3 bg-purple-50/30 rounded-xl border border-purple-100 relative space-y-2">
          <button type="button" class="btn-delete-q absolute top-2 right-2 text-gray-400 hover:text-rose-500 transition" data-part-idx="${partIdx}" data-q-idx="${qIdx}" title="Borrar Pregunta">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>

          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                q.type === 'multiple' ? 'bg-pink-100 text-pink-700' : q.type === 'boolean' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-800'
              }">${q.type === 'multiple' ? 'Múltiple' : q.type === 'boolean' ? 'V / F' : 'Abierta'}</span>
              <span class="text-[10px] text-gray-400">Pregunta ${qIdx + 1}</span>
            </div>
            <input
              type="text"
              value="${q.text}"
              placeholder="Pregunta o Enunciado"
              class="q-text-input px-3 py-1.5 w-full border border-purple-100 focus:outline-none rounded-lg text-xs"
              data-part-idx="${partIdx}"
              data-q-idx="${qIdx}"
            >
          </div>

          ${extraHtml}
        </div>
      `;
    }).join('');
  }

  function addQuestionToPart(partIdx, type) {
    const defaultOptions = type === 'multiple' ? ["", "", "", ""] : (type === 'boolean' ? ["Verdadero", "Falso"] : []);
    partsData[partIdx].questions.push({
      id: "q_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      type: type,
      text: "",
      options: defaultOptions,
      correct: ""
    });
    renderParts();
  }

  function bindQuestionInputs() {
    // Question text update
    document.querySelectorAll('.q-text-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const partIdx = e.target.getAttribute('data-part-idx');
        const qIdx = e.target.getAttribute('data-q-idx');
        partsData[partIdx].questions[qIdx].text = e.target.value.trim();
      });
    });

    // Multiple choice options update
    document.querySelectorAll('.q-opt-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const partIdx = input.getAttribute('data-part-idx');
        const qIdx = input.getAttribute('data-q-idx');
        const optIdx = input.getAttribute('data-opt-idx');

        partsData[partIdx].questions[qIdx].options[optIdx] = input.value.trim();

        // Re-render only parts to update option bindings on correct select dropdown
        renderParts();
      });
    });

    // Correct select update
    document.querySelectorAll('.q-correct-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const partIdx = select.getAttribute('data-part-idx');
        const qIdx = select.getAttribute('data-q-idx');
        partsData[partIdx].questions[qIdx].correct = select.value;
      });
    });

    // Delete question trigger
    document.querySelectorAll('.btn-delete-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const partIdx = btn.getAttribute('data-part-idx');
        const qIdx = btn.getAttribute('data-q-idx');
        partsData[partIdx].questions.splice(qIdx, 1);
        renderParts();
      });
    });
  }

  // Delete entire Exam
  async function deleteExam(id) {
    try {
      const { error } = await supabaseClient
        .from('exams')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showAlert("Examen eliminado exitosamente.");
      loadExams();
    } catch (err) {
      console.error(err);
      showAlert("Error al eliminar examen: " + err.message, true);
    }
  }

  // Save/Update Exam
  examEditorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const examId = editorExamId.value;
    const name = examNameInput.value.trim();
    const description = examDescInput.value.trim();

    if (partsData.length === 0) {
      showAlert("Por favor, agrega al menos una sección en el examen.", true);
      return;
    }

    // Validar que todas las secciones tengan título y preguntas coherentes
    for (const part of partsData) {
      if (!part.title.trim()) {
        showAlert("Todas las secciones deben de tener un nombre.", true);
        return;
      }
      if (part.questions.length === 0) {
        showAlert(`La sección "${part.title}" no tiene preguntas asignadas.`, true);
        return;
      }
      for (const q of part.questions) {
        if (!q.text.trim()) {
          showAlert(`Hay preguntas vacías en la sección "${part.title}".`, true);
          return;
        }
        if (q.type === 'multiple') {
          if (q.options.some(o => !o.trim())) {
            showAlert(`La pregunta "${q.text}" tiene opciones en blanco.`, true);
            return;
          }
          if (!q.correct) {
            showAlert(`Por favor, selecciona la opción correcta para: "${q.text}"`, true);
            return;
          }
        }
        if (q.type === 'boolean' && !q.correct) {
          showAlert(`Por favor, selecciona la respuesta correcta para la pregunta Verdadero/Falso: "${q.text}"`, true);
          return;
        }
      }
    }

    try {
      const payload = {
        name,
        description,
        is_psychometric: false,
        parts: partsData
      };

      if (examId) {
        // UPDATE
        const { error } = await supabaseClient
          .from('exams')
          .update(payload)
          .eq('id', examId);

        if (error) throw error;
        showAlert("Examen actualizado correctamente.");
      } else {
        // INSERT
        const { error } = await supabaseClient
          .from('exams')
          .insert([payload]);

        if (error) throw error;
        showAlert("¡Examen técnico guardado correctamente!");
      }

      resetEditor();
      loadExams();
    } catch (err) {
      console.error(err);
      showAlert("Error al guardar examen: " + err.message, true);
    }
  });


  // ==========================================
  // TAB 3: RESULTS AND HISTORIAL LOGIC
  // ==========================================

  async function loadResults() {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('results')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      allResults = data || [];
      renderResults();
    } catch (err) {
      console.error("Error al cargar resultados:", err);
      showAlert("No se pudieron cargar los resultados: " + err.message, true);
    }
  }

  function renderResults() {
    resultsTableBody.innerHTML = "";

    // Filtros locales
    const query = resultsSearch.value.toLowerCase().trim();
    const vacancyFilter = filterVacancy.value;

    const filtered = allResults.filter(r => {
      const matchesSearch = r.candidate_name.toLowerCase().includes(query) ||
                            (r.candidate_email && r.candidate_email.toLowerCase().includes(query)) ||
                            (r.assigned_exam_name && r.assigned_exam_name.toLowerCase().includes(query));

      const matchesVacancy = vacancyFilter === "" || r.assigned_exam_name === vacancyFilter;

      return matchesSearch && matchesVacancy;
    });

    if (filtered.length === 0) {
      resultsTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-12 text-gray-400">
            <i class="fa-solid fa-filter text-4xl mb-2 text-purple-200 block"></i>
            No se encontraron perfiles con los filtros actuales.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(res => {
      const date = new Date(res.created_at).toLocaleDateString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const scoreText = res.max_score > 0 ? `${res.score} / ${res.max_score}` : 'Calificado / Libre';
      const scorePercent = res.max_score > 0 ? Math.round((res.score / res.max_score) * 100) : 100;

      let badgeColor = "bg-emerald-100 text-emerald-800";
      if (res.max_score > 0) {
        if (scorePercent < 60) badgeColor = "bg-rose-100 text-rose-800";
        else if (scorePercent < 80) badgeColor = "bg-amber-100 text-amber-800";
      }

      resultsTableBody.innerHTML += `
        <tr class="hover:bg-purple-50/30 transition">
          <td class="py-4 px-4 font-bold text-gray-800">
            ${res.candidate_name}
          </td>
          <td class="py-4 px-4 text-xs">
            <div class="text-gray-700">${res.candidate_email || 'N/A'}</div>
            <div class="text-gray-400">${res.candidate_phone || 'N/A'}</div>
          </td>
          <td class="py-4 px-4">
            <span class="font-semibold text-purple-600 text-xs">${res.assigned_exam_name || 'Examen Técnico'}</span>
          </td>
          <td class="py-4 px-4 text-center">
            <span class="text-xs px-2 py-1 font-bold rounded-full ${badgeColor}">
              ${scoreText} ${res.max_score > 0 ? `(${scorePercent}%)` : ''}
            </span>
          </td>
          <td class="py-4 px-4 text-center text-xs text-gray-400">
            ${date}
          </td>
          <td class="py-4 px-4 text-right">
            <button class="view-report-btn px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-xl font-bold text-xs transition" data-id="${res.id}">
              <i class="fa-regular fa-id-card mr-1"></i> Ver Perfil
            </button>
          </td>
        </tr>
      `;
    });

    // Bind View Detail Report Buttons
    document.querySelectorAll('.view-report-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const report = allResults.find(r => r.id === id);
        if (report) showReportModal(report);
      });
    });
  }

  // Filter & Search events
  resultsSearch.addEventListener('input', renderResults);
  filterVacancy.addEventListener('change', renderResults);
  refreshResultsBtn.addEventListener('click', loadResults);


  // ==========================================
  // DETAIL REPORT MODAL LOGIC
  // ==========================================

  function showReportModal(report) {
    modalCandName.textContent = report.candidate_name;
    modalCandPos.textContent = `Vacante: ${report.assigned_exam_name || 'Por definir'}`;
    modalCandEmail.textContent = report.candidate_email || 'No proporcionado';
    modalCandPhone.textContent = report.candidate_phone || 'No proporcionado';

    const scorePct = report.max_score > 0 ? Math.round((report.score / report.max_score) * 100) : 100;
    modalCandScore.textContent = report.max_score > 0 ? `${report.score} / ${report.max_score}` : 'Examen Abierto';
    modalCandPercentage.textContent = report.max_score > 0 ? `${scorePct}%` : 'Terminado';

    // Info personal adicional
    modalCandInfoFields.innerHTML = "";
    const info = report.candidate_info || {};
    const infoKeys = Object.keys(info);

    if (infoKeys.length === 0) {
      modalCandInfoFields.innerHTML = '<span class="text-gray-400 col-span-2">No se ingresaron datos adicionales.</span>';
    } else {
      infoKeys.forEach(key => {
        // Formatear llave
        const cleanKey = key.replace(/_/g, ' ').toUpperCase();
        modalCandInfoFields.innerHTML += `
          <div class="bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
            <strong class="text-[10px] text-gray-400 uppercase block">${cleanKey}</strong>
            <span class="text-xs font-semibold text-gray-700">${info[key]}</span>
          </div>
        `;
      });
    }

    // Respuestas Psicométricas render
    renderAnswersSection(modalAnswersPsy, report.psychometric_answers);

    // Respuestas Técnicas render
    renderAnswersSection(modalAnswersTech, report.technical_answers);

    // Configurar tabs de respuestas en el modal
    modalTabPsyBtn.className = "pb-2 px-4 border-b-2 border-purple-500 text-purple-600 font-bold text-sm";
    modalTabTechBtn.className = "pb-2 px-4 border-b-2 border-transparent text-gray-500 font-bold text-sm hover:text-purple-600";
    modalAnswersPsy.classList.remove('hidden');
    modalAnswersTech.classList.add('hidden');

    resultModal.classList.remove('hidden');
  }

  // Cerrar Modal
  const closeModal = () => resultModal.classList.add('hidden');
  modalCloseBtn.addEventListener('click', closeModal);
  modalCloseBottomBtn.addEventListener('click', closeModal);

  // Tab switching in Modal
  modalTabPsyBtn.addEventListener('click', () => {
    modalTabPsyBtn.className = "pb-2 px-4 border-b-2 border-purple-500 text-purple-600 font-bold text-sm";
    modalTabTechBtn.className = "pb-2 px-4 border-b-2 border-transparent text-gray-500 font-bold text-sm hover:text-purple-600";
    modalAnswersPsy.classList.remove('hidden');
    modalAnswersTech.classList.add('hidden');
  });

  modalTabTechBtn.addEventListener('click', () => {
    modalTabTechBtn.className = "pb-2 px-4 border-b-2 border-transparent text-gray-500 font-bold text-sm hover:text-purple-600";
    modalTabTechBtn.className = "pb-2 px-4 border-b-2 border-purple-500 text-purple-600 font-bold text-sm";
    modalTabPsyBtn.className = "pb-2 px-4 border-b-2 border-transparent text-gray-500 font-bold text-sm hover:text-purple-600";
    modalAnswersTech.classList.remove('hidden');
    modalAnswersPsy.classList.add('hidden');
  });

  // Render Answers inside detail view
  function renderAnswersSection(container, answersData) {
    container.innerHTML = "";

    const parts = answersData.parts || [];
    if (parts.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-gray-400 text-xs">No hay respuestas registradas para este examen.</div>`;
      return;
    }

    parts.forEach((part) => {
      let partHtml = `
        <div class="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
          <h5 class="text-xs font-bold text-purple-700 border-b border-purple-100 pb-1.5"><i class="fa-solid fa-tag mr-1 text-purple-400"></i> ${part.title}</h5>
          <div class="space-y-3 divide-y divide-gray-100">
      `;

      part.questions.forEach((q, idx) => {
        const hasCorrect = q.type !== 'short';
        const isCorrect = hasCorrect && (q.userAnswer === q.correct);

        let statusBadge = "";
        if (hasCorrect) {
          statusBadge = isCorrect
            ? `<span class="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full"><i class="fa-solid fa-check mr-0.5"></i> Correcto</span>`
            : `<span class="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full"><i class="fa-solid fa-xmark mr-0.5"></i> Incorrecto</span>`;
        } else {
          statusBadge = `<span class="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">Respuesta Abierta</span>`;
        }

        partHtml += `
          <div class="pt-2 flex flex-col gap-1">
            <div class="flex items-start justify-between gap-4">
              <span class="text-xs font-bold text-gray-700">P${idx + 1}. ${q.text}</span>
              ${statusBadge}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1 text-xs">
              <div class="bg-purple-50/30 p-2 rounded-lg border border-purple-100/30">
                <strong class="text-[9px] text-gray-400 uppercase block">Respuesta del Candidato</strong>
                <span class="font-medium text-purple-900">${q.userAnswer || '<em class="text-gray-400">Sin contestar</em>'}</span>
              </div>
              ${hasCorrect ? `
                <div class="bg-emerald-50/20 p-2 rounded-lg border border-emerald-100/30">
                  <strong class="text-[9px] text-gray-400 uppercase block">Respuesta Esperada / Correcta</strong>
                  <span class="font-medium text-emerald-950">${q.correct}</span>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      });

      partHtml += `
          </div>
        </div>
      `;
      container.innerHTML += partHtml;
    });
  }

  // Print Report Action
  modalPrintBtn.addEventListener('click', () => {
    window.print();
  });


  // ==========================================
  // INITIAL LOAD
  // ==========================================
  resetEditor();
  await loadExams();
  await loadPendingCandidates();
  await loadResults();
});
