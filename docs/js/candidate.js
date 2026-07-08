// JS para el Flujo del Candidato
document.addEventListener('DOMContentLoaded', async () => {
  if (!supabaseClient) {
    console.error("No se detectó el cliente de Supabase.");
    return;
  }

  // Elementos de Secciones
  const stepSelectCandidate = document.getElementById('step-select-candidate');
  const stepInfoForm = document.getElementById('step-info-form');
  const stepPsychometric = document.getElementById('step-psychometric');
  const stepTechnical = document.getElementById('step-technical');
  const stepCompleted = document.getElementById('step-completed');

  // Elementos de Control / Header
  const statusBar = document.getElementById('status-bar');
  const currentCandidateDisplay = document.getElementById('current-candidate-display');

  // Elementos del Paso 1: Selección de candidato
  const selectCand = document.getElementById('select-cand');
  const noCandidatesAlert = document.getElementById('no-candidates-alert');
  const btnConfirmCand = document.getElementById('btn-confirm-cand');

  // Elementos del Paso 2: Info form
  const candInfoForm = document.getElementById('cand-info-form');
  const infoEmail = document.getElementById('info-email');
  const infoPhone = document.getElementById('info-phone');
  const infoExp = document.getElementById('info-exp');
  const infoDegree = document.getElementById('info-degree');
  const infoExtra = document.getElementById('info-extra');

  // Elementos del Paso 3: Psicométrico
  const psyQuestionsContainer = document.getElementById('psy-questions-container');
  const psyProgressText = document.getElementById('psy-progress-text');
  const btnSubmitPsy = document.getElementById('btn-submit-psy');

  // Elementos del Paso 4: Técnico
  const techExamTitle = document.getElementById('tech-exam-title');
  const techExamDesc = document.getElementById('tech-exam-desc');
  const techQuestionsContainer = document.getElementById('tech-questions-container');
  const techProgressText = document.getElementById('tech-progress-text');
  const btnSubmitTech = document.getElementById('btn-submit-tech');

  // Elementos del Paso 5: Completado
  const btnRestart = document.getElementById('btn-restart');

  // Estado Local del Candidato
  let activeCandidates = [];
  let selectedCandidate = null; // { id, name, assigned_exam_id, assigned_exam_name }
  let psychometricExam = null; // Examen psicométrico general
  let assignedTechnicalExam = null; // Examen de profesión técnico asignado

  let candidateInfoData = {};
  let psychometricAnswers = {}; // { qId: userAnswer }
  let technicalAnswers = {}; // { qId: userAnswer }

  // Cambiar vista de paso
  function showStep(stepElement) {
    [stepSelectCandidate, stepInfoForm, stepPsychometric, stepTechnical, stepCompleted].forEach(step => {
      step.classList.add('hidden');
    });
    stepElement.classList.remove('hidden');
  }

  // ==========================================
  // PASO 1: CARGAR CANDIDATOS HABILITADOS
  // ==========================================
  async function loadActiveCandidates() {
    try {
      const { data, error } = await supabaseClient
        .from('candidates')
        .select('*')
        .eq('status', 'pending')
        .order('name', { ascending: true });

      if (error) throw error;
      activeCandidates = data || [];

      selectCand.innerHTML = '<option value="">-- Elige tu Nombre Completo --</option>';
      if (activeCandidates.length === 0) {
        selectCand.innerHTML = '<option value="">No hay candidatos pendientes habilitados</option>';
        noCandidatesAlert.classList.remove('hidden');
      } else {
        noCandidatesAlert.classList.add('hidden');
        activeCandidates.forEach(cand => {
          selectCand.innerHTML += `<option value="${cand.id}">${cand.name} (${cand.assigned_exam_name || 'Sin examen técnico'})</option>`;
        });
      }
    } catch (err) {
      console.error("Error al cargar candidatos habilitados:", err);
    }
  }

  // Confirmar Selección de Nombre
  btnConfirmCand.addEventListener('click', async () => {
    const candId = selectCand.value;
    if (!candId) {
      alert("Por favor, selecciona tu nombre de la lista.");
      return;
    }

    selectedCandidate = activeCandidates.find(c => c.id === candId);
    if (!selectedCandidate) return;

    // Actualizar barra de estado con el nombre del candidato
    currentCandidateDisplay.textContent = selectedCandidate.name;
    statusBar.classList.remove('hidden');

    // Cargar exámenes necesarios
    await loadRequiredExams();

    // Pasar al paso del formulario
    showStep(stepInfoForm);
  });

  // Carga paralela de examen psicométrico y técnico asignado
  async function loadRequiredExams() {
    try {
      // 1. Asegurar y obtener psicométrico por defecto
      const psychometricId = await ensureDefaultPsychometricExam();
      if (psychometricId) {
        const { data: psyData } = await supabaseClient
          .from('exams')
          .select('*')
          .eq('is_psychometric', true)
          .limit(1);

        if (psyData && psyData.length > 0) {
          psychometricExam = psyData[0];
        }
      }

      // 2. Obtener examen técnico asignado
      if (selectedCandidate.assigned_exam_id) {
        const { data: techData } = await supabaseClient
          .from('exams')
          .select('*')
          .eq('id', selectedCandidate.assigned_exam_id)
          .limit(1);

        if (techData && techData.length > 0) {
          assignedTechnicalExam = techData[0];
        }
      }
    } catch (err) {
      console.error("Error al cargar exámenes requeridos:", err);
    }
  }

  // ==========================================
  // PASO 2: FORMULARIO INFORMACIÓN PERSONAL
  // ==========================================
  candInfoForm.addEventListener('submit', (e) => {
    e.preventDefault();

    candidateInfoData = {
      email: infoEmail.value.trim(),
      phone: infoPhone.value.trim(),
      experiencia_anos: infoExp.value,
      grado_estudios: infoDegree.value,
      resumen_profesional: infoExtra.value.trim()
    };

    // Preparar y renderizar examen psicométrico
    renderPsychometricExam();
    showStep(stepPsychometric);
  });

  // ==========================================
  // PASO 3: EXAMEN PSICOMÉTRICO GENERAL
  // ==========================================
  function renderPsychometricExam() {
    psyQuestionsContainer.innerHTML = "";
    if (!psychometricExam || !psychometricExam.parts || psychometricExam.parts.length === 0) {
      psyQuestionsContainer.innerHTML = `<div class="text-center py-8 text-gray-500">No hay examen psicométrico configurado. Por favor, continúa.</div>`;
      psyProgressText.textContent = "0 / 0 Respondidas";
      return;
    }

    let questionCount = 0;
    psychometricAnswers = {};

    psychometricExam.parts.forEach((part, partIdx) => {
      let partHtml = `
        <div class="bg-pink-50/40 p-5 rounded-2xl border border-pink-100/60 space-y-4 shadow-sm">
          <h3 class="text-sm font-bold text-pink-700 flex items-center gap-1.5 border-b border-pink-100 pb-2">
            <i class="fa-solid fa-folder text-pink-400"></i> ${part.title}
          </h3>
          <div class="space-y-4">
      `;

      part.questions.forEach((q) => {
        questionCount++;
        let questionWidget = "";

        if (q.type === 'multiple') {
          questionWidget = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              ${q.options.map((opt, oIdx) => `
                <label class="flex items-center gap-2 p-2.5 rounded-xl border border-pink-100 bg-white hover:bg-pink-50/50 cursor-pointer transition text-xs font-semibold text-gray-700">
                  <input type="radio" name="psy_q_${q.id}" value="${opt}" class="psy-radio-input focus:ring-pink-400 text-pink-500" data-q-id="${q.id}">
                  <span>${opt}</span>
                </label>
              `).join('')}
            </div>
          `;
        } else if (q.type === 'boolean') {
          questionWidget = `
            <div class="grid grid-cols-2 gap-3 mt-2 max-w-xs">
              <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-pink-100 bg-white hover:bg-pink-50/50 cursor-pointer transition text-xs font-bold text-gray-700">
                <input type="radio" name="psy_q_${q.id}" value="Verdadero" class="psy-radio-input focus:ring-pink-400 text-pink-500" data-q-id="${q.id}">
                Verdadero
              </label>
              <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-pink-100 bg-white hover:bg-pink-50/50 cursor-pointer transition text-xs font-bold text-gray-700">
                <input type="radio" name="psy_q_${q.id}" value="Falso" class="psy-radio-input focus:ring-pink-400 text-pink-500" data-q-id="${q.id}">
                Falso
              </label>
            </div>
          `;
        } else if (q.type === 'short') {
          questionWidget = `
            <textarea
              rows="2"
              placeholder="Escribe tu respuesta aquí..."
              class="psy-textarea-input w-full mt-2 px-3 py-2 rounded-xl border border-pink-100 text-xs focus:ring-2 focus:ring-pink-400 focus:outline-none"
              data-q-id="${q.id}"
            ></textarea>
          `;
        }

        partHtml += `
          <div class="space-y-1">
            <span class="text-xs font-bold text-gray-700 block">Pregunta: ${q.text}</span>
            ${questionWidget}
          </div>
        `;
      });

      partHtml += `
          </div>
        </div>
      `;
      psyQuestionsContainer.innerHTML += partHtml;
    });

    updateProgressText(psyProgressText, 0, questionCount);

    // Bind Radio changes
    document.querySelectorAll('.psy-radio-input').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const qId = radio.getAttribute('data-q-id');
        psychometricAnswers[qId] = radio.value;
        const totalAnswered = countAnswered(psychometricAnswers, '.psy-textarea-input');
        updateProgressText(psyProgressText, totalAnswered, questionCount);
      });
    });

    // Bind Textarea changes
    document.querySelectorAll('.psy-textarea-input').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        const qId = textarea.getAttribute('data-q-id');
        const val = textarea.value.trim();
        if (val) {
          psychometricAnswers[qId] = val;
        } else {
          delete psychometricAnswers[qId];
        }
        const totalAnswered = countAnswered(psychometricAnswers, '.psy-textarea-input');
        updateProgressText(psyProgressText, totalAnswered, questionCount);
      });
    });
  }

  function countAnswered(ansObj, textareaSelector) {
    let textareas = 0;
    document.querySelectorAll(textareaSelector).forEach(ta => {
      if (ta.value.trim()) textareas++;
    });
    // Contamos las llaves del objeto de respuestas
    return Object.keys(ansObj).length;
  }

  function updateProgressText(element, answered, total) {
    element.textContent = `${answered} / ${total} Respondidas`;
  }

  // Submit Psicométrico
  btnSubmitPsy.addEventListener('click', () => {
    // Validar que todas las preguntas hayan sido respondidas
    let totalQuestions = 0;
    if (psychometricExam && psychometricExam.parts) {
      psychometricExam.parts.forEach(p => totalQuestions += p.questions.length);
    }

    if (Object.keys(psychometricAnswers).length < totalQuestions) {
      alert("Por favor, responde todas las preguntas del examen psicométrico para poder continuar.");
      return;
    }

    // Proceder al Examen Técnico
    if (assignedTechnicalExam) {
      renderTechnicalExam();
      showStep(stepTechnical);
    } else {
      // Si no tiene examen técnico asignado por algún motivo, finalizamos directo
      saveAllResultsAndFinish();
    }
  });


  // ==========================================
  // PASO 4: EXAMEN TÉCNICO / PROFESIONAL
  // ==========================================
  function renderTechnicalExam() {
    techExamTitle.innerHTML = `<i class="fa-solid fa-award mr-2 text-indigo-400"></i>Examen Profesional: <span class="text-indigo-600 font-extrabold">${assignedTechnicalExam.name}</span>`;
    techExamDesc.textContent = assignedTechnicalExam.description || "Evaluación técnica específica para esta vacante.";

    techQuestionsContainer.innerHTML = "";
    if (!assignedTechnicalExam.parts || assignedTechnicalExam.parts.length === 0) {
      techQuestionsContainer.innerHTML = `<div class="text-center py-8 text-gray-500">Este examen técnico no contiene preguntas aún. Puedes finalizar la evaluación.</div>`;
      techProgressText.textContent = "0 / 0 Respondidas";
      return;
    }

    let questionCount = 0;
    technicalAnswers = {};

    assignedTechnicalExam.parts.forEach((part, partIdx) => {
      let partHtml = `
        <div class="bg-indigo-50/40 p-5 rounded-2xl border border-indigo-100/60 space-y-4 shadow-sm">
          <h3 class="text-sm font-bold text-indigo-700 flex items-center gap-1.5 border-b border-indigo-100 pb-2">
            <i class="fa-solid fa-folder text-indigo-400"></i> ${part.title}
          </h3>
          <div class="space-y-4">
      `;

      part.questions.forEach((q) => {
        questionCount++;
        let questionWidget = "";

        if (q.type === 'multiple') {
          questionWidget = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              ${q.options.map((opt, oIdx) => `
                <label class="flex items-center gap-2 p-2.5 rounded-xl border border-indigo-100 bg-white hover:bg-indigo-50/50 cursor-pointer transition text-xs font-semibold text-gray-700">
                  <input type="radio" name="tech_q_${q.id}" value="${opt}" class="tech-radio-input focus:ring-indigo-400 text-indigo-500" data-q-id="${q.id}">
                  <span>${opt}</span>
                </label>
              `).join('')}
            </div>
          `;
        } else if (q.type === 'boolean') {
          questionWidget = `
            <div class="grid grid-cols-2 gap-3 mt-2 max-w-xs">
              <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-indigo-100 bg-white hover:bg-indigo-50/50 cursor-pointer transition text-xs font-bold text-gray-700">
                <input type="radio" name="tech_q_${q.id}" value="Verdadero" class="tech-radio-input focus:ring-indigo-400 text-indigo-500" data-q-id="${q.id}">
                Verdadero
              </label>
              <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-indigo-100 bg-white hover:bg-indigo-50/50 cursor-pointer transition text-xs font-bold text-gray-700">
                <input type="radio" name="tech_q_${q.id}" value="Falso" class="tech-radio-input focus:ring-indigo-400 text-indigo-500" data-q-id="${q.id}">
                Falso
              </label>
            </div>
          `;
        } else if (q.type === 'short') {
          questionWidget = `
            <textarea
              rows="3"
              placeholder="Escribe detalladamente tu respuesta aquí..."
              class="tech-textarea-input w-full mt-2 px-3 py-2 rounded-xl border border-indigo-100 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              data-q-id="${q.id}"
            ></textarea>
          `;
        }

        partHtml += `
          <div class="space-y-1">
            <span class="text-xs font-bold text-gray-700 block">Pregunta: ${q.text}</span>
            ${questionWidget}
          </div>
        `;
      });

      partHtml += `
          </div>
        </div>
      `;
      techQuestionsContainer.innerHTML += partHtml;
    });

    updateProgressText(techProgressText, 0, questionCount);

    // Bind Radio changes
    document.querySelectorAll('.tech-radio-input').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const qId = radio.getAttribute('data-q-id');
        technicalAnswers[qId] = radio.value;
        const totalAnswered = countAnswered(technicalAnswers, '.tech-textarea-input');
        updateProgressText(techProgressText, totalAnswered, questionCount);
      });
    });

    // Bind Textarea changes
    document.querySelectorAll('.tech-textarea-input').forEach(textarea => {
      textarea.addEventListener('input', (e) => {
        const qId = textarea.getAttribute('data-q-id');
        const val = textarea.value.trim();
        if (val) {
          technicalAnswers[qId] = val;
        } else {
          delete technicalAnswers[qId];
        }
        const totalAnswered = countAnswered(technicalAnswers, '.tech-textarea-input');
        updateProgressText(techProgressText, totalAnswered, questionCount);
      });
    });
  }

  // Submit Technical Exam
  btnSubmitTech.addEventListener('click', () => {
    let totalQuestions = 0;
    if (assignedTechnicalExam && assignedTechnicalExam.parts) {
      assignedTechnicalExam.parts.forEach(p => totalQuestions += p.questions.length);
    }

    if (Object.keys(technicalAnswers).length < totalQuestions) {
      alert("Por favor, responde todas las preguntas del examen técnico antes de finalizar.");
      return;
    }

    if (confirm("¿Estás seguro de que deseas enviar tus respuestas finales? No se podrán cambiar.")) {
      saveAllResultsAndFinish();
    }
  });


  // ==========================================
  // GUARDAR TODO EN SUPABASE Y TERMINAR
  // ==========================================
  async function saveAllResultsAndFinish() {
    try {
      // 1. Calificar Examen Técnico Localmente para guardar score
      let score = 0;
      let maxScore = 0;

      // Estructuramos las respuestas técnicas con el formato completo
      const structuredTechnical = {
        name: assignedTechnicalExam ? assignedTechnicalExam.name : "N/A",
        parts: assignedTechnicalExam ? JSON.parse(JSON.stringify(assignedTechnicalExam.parts)) : []
      };

      structuredTechnical.parts.forEach(part => {
        part.questions.forEach(q => {
          q.userAnswer = technicalAnswers[q.id] || "";

          if (q.type !== 'short') {
            maxScore++;
            if (q.userAnswer === q.correct) {
              score++;
            }
          }
        });
      });

      // Estructuramos respuestas psicométricas
      const structuredPsychometric = {
        name: psychometricExam ? psychometricExam.name : "N/A",
        parts: psychometricExam ? JSON.parse(JSON.stringify(psychometricExam.parts)) : []
      };

      structuredPsychometric.parts.forEach(part => {
        part.questions.forEach(q => {
          q.userAnswer = psychometricAnswers[q.id] || "";
        });
      });

      // 2. Guardar en la tabla 'results' de Supabase
      const { error: insertError } = await supabaseClient
        .from('results')
        .insert([{
          candidate_name: selectedCandidate.name,
          candidate_email: candidateInfoData.email,
          candidate_phone: candidateInfoData.phone,
          candidate_info: candidateInfoData,
          position: selectedCandidate.assigned_exam_name,
          psychometric_answers: structuredPsychometric,
          technical_answers: structuredTechnical,
          assigned_exam_name: selectedCandidate.assigned_exam_name,
          score: score,
          max_score: maxScore
        }]);

      if (insertError) throw insertError;

      // 3. Borrar candidato de la lista de pendientes (cambiar status a completed)
      // El requerimiento dice: "una vez termine... en admin usuarios desaparecería"
      // Así que simplemente actualizamos su estatus a 'completed' para que el filtro lo oculte.
      const { error: updateError } = await supabaseClient
        .from('candidates')
        .update({ status: 'completed' })
        .eq('id', selectedCandidate.id);

      if (updateError) throw updateError;

      // Ocultar barra de estado y mostrar paso completado
      statusBar.classList.add('hidden');
      showStep(stepCompleted);

    } catch (err) {
      console.error("Error al guardar resultados en base de datos:", err);
      alert("Hubo un problema al guardar tus respuestas. Por favor, avisa al personal de Recursos Humanos: " + err.message);
    }
  }

  // Restart flow
  btnRestart.addEventListener('click', () => {
    // Reset inputs
    candInfoForm.reset();
    psyQuestionsContainer.innerHTML = "";
    techQuestionsContainer.innerHTML = "";
    selectedCandidate = null;
    psychometricAnswers = {};
    technicalAnswers = {};
    candidateInfoData = {};

    loadActiveCandidates();
    showStep(stepSelectCandidate);
  });

  // INITIAL LOAD
  await loadActiveCandidates();
});
