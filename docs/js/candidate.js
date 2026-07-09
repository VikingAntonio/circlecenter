// JS para el portal del candidato (candidate.js) con soporte para formulario dinámico
document.addEventListener('DOMContentLoaded', async () => {
  if (!supabaseClient) {
    console.error("No se detectó el cliente de Supabase.");
    return;
  }

  // Elementos DOM
  const stepSelectCandidate = document.getElementById('step-select-candidate');
  const stepInfoForm = document.getElementById('step-info-form');
  const stepPsychometric = document.getElementById('step-psychometric');
  const stepTechnical = document.getElementById('step-technical');
  const stepCompleted = document.getElementById('step-completed');

  const statusBar = document.getElementById('status-bar');
  const currentCandidateDisplay = document.getElementById('current-candidate-display');

  const selectCand = document.getElementById('select-cand');
  const noCandidatesAlert = document.getElementById('no-candidates-alert');
  const btnConfirmCand = document.getElementById('btn-confirm-cand');

  const candInfoForm = document.getElementById('cand-info-form');
  const dynamicFormFields = document.getElementById('dynamic-form-fields');

  const psyQuestionsContainer = document.getElementById('psy-questions-container');
  const psyProgressText = document.getElementById('psy-progress-text');
  const btnSubmitPsy = document.getElementById('btn-submit-psy');

  const techExamTitle = document.getElementById('tech-exam-title');
  const techExamDesc = document.getElementById('tech-exam-desc');
  const techQuestionsContainer = document.getElementById('tech-questions-container');
  const techProgressText = document.getElementById('tech-progress-text');
  const btnSubmitTech = document.getElementById('btn-submit-tech');

  const btnRestart = document.getElementById('btn-restart');

  // Estado Local del Candidato
  let activeCandidates = [];
  let selectedCandidate = null; // { id, name, assigned_exam_id, assigned_exam_name }
  let psychometricExam = null;
  let assignedTechnicalExam = null;

  let dynamicFormStructure = []; // Campos cargados dinámicamente
  let candidateInfoAnswers = {}; // { fieldId: value }
  let psychometricAnswers = {};
  let technicalAnswers = {};

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
        selectCand.innerHTML = '<option value="">No hay aspirantes habilitados hoy</option>';
        noCandidatesAlert.classList.remove('hidden');
      } else {
        noCandidatesAlert.classList.add('hidden');
        activeCandidates.forEach(cand => {
          selectCand.innerHTML += `<option value="${cand.id}">${cand.name} (${cand.assigned_exam_name || 'Sin examen asignado'})</option>`;
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Confirmar Selección del Aspirante
  btnConfirmCand.addEventListener('click', async () => {
    const candId = selectCand.value;
    if (!candId) {
      alert("Por favor, selecciona tu nombre de la lista para iniciar.");
      return;
    }

    selectedCandidate = activeCandidates.find(c => c.id === candId);
    if (!selectedCandidate) return;

    currentCandidateDisplay.textContent = selectedCandidate.name;
    statusBar.classList.remove('hidden');

    // Cargar estructura de exámenes y formulario
    await loadRequiredResources();
    renderDynamicForm();

    showStep(stepInfoForm);
  });

  // Carga paralela de base de datos
  async function loadRequiredResources() {
    try {
      // 1. Asegurar examen psicométrico por defecto y cargarlo
      await ensureDefaultPsychometricExam();
      const { data: psyData } = await supabaseClient
        .from('exams')
        .select('*')
        .eq('is_psychometric', true)
        .limit(1);

      if (psyData && psyData.length > 0) {
        psychometricExam = psyData[0];
      }

      // 2. Obtener examen profesional asignado
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

      // 3. Obtener estructura del Formulario de Registro Dinámico
      await ensureDefaultRegistrationForm();
      const { data: formStructureData } = await supabaseClient
        .from('registration_forms')
        .select('*')
        .eq('is_active', true)
        .limit(1);

      if (formStructureData && formStructureData.length > 0) {
        dynamicFormStructure = formStructureData[0].fields || [];
      } else {
        dynamicFormStructure = DEFAULT_REGISTRATION_FORM.fields;
      }

    } catch (err) {
      console.error(err);
    }
  }

  // Renderizar dinámicamente el Formulario de Registro
  function renderDynamicForm() {
    dynamicFormFields.innerHTML = "";
    if (dynamicFormStructure.length === 0) {
      dynamicFormFields.innerHTML = `<p class="col-span-2 text-center text-gray-400 text-xs">No se requieren datos para iniciar. Puedes continuar.</p>`;
      return;
    }

    dynamicFormStructure.forEach(field => {
      const isRequired = field.required ? 'required' : '';
      const reqMarker = field.required ? '<span class="text-rose-500 ml-0.5">*</span>' : '';
      let fieldWidget = "";

      if (field.type === 'select') {
        fieldWidget = `
          <select id="field_${field.id}" ${isRequired} class="cand-custom-input w-full px-4 py-3 rounded-2xl border border-blue-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
            <option value="">-- Elige una opción --</option>
            ${(field.options || []).map(opt => `<option value="${opt}">${opt}</option>`).join('')}
          </select>
        `;
      } else if (field.type === 'textarea') {
        fieldWidget = `
          <textarea id="field_${field.id}" rows="3" ${isRequired} class="cand-custom-input w-full px-4 py-3 rounded-2xl border border-blue-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 custom-scroll"></textarea>
        `;
      } else {
        fieldWidget = `
          <input type="${field.type}" id="field_${field.id}" ${isRequired} class="cand-custom-input w-full px-4 py-3 rounded-2xl border border-blue-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
        `;
      }

      // Columnas responsivas
      const colSpan = field.type === 'textarea' ? 'md:col-span-2' : '';

      dynamicFormFields.innerHTML += `
        <div class="${colSpan} space-y-1">
          <label class="block text-gray-600 text-sm font-semibold" for="field_${field.id}">
            ${field.label}${reqMarker}
          </label>
          ${fieldWidget}
        </div>
      `;
    });
  }

  // Guardar respuestas del Formulario de Registro
  candInfoForm.addEventListener('submit', (e) => {
    e.preventDefault();

    candidateInfoAnswers = {};
    dynamicFormStructure.forEach(field => {
      const el = document.getElementById(`field_${field.id}`);
      if (el) {
        candidateInfoAnswers[field.id] = el.value.trim();
      }
    });

    renderPsychometricExam();
    showStep(stepPsychometric);
  });

  // ==========================================
  // PASO 3: EXAMEN PSICOMÉTRICO GENERAL
  // ==========================================
  function renderPsychometricExam() {
    psyQuestionsContainer.innerHTML = "";
    if (!psychometricExam || !psychometricExam.parts || psychometricExam.parts.length === 0) {
      psyQuestionsContainer.innerHTML = `<div class="text-center py-8 text-gray-400 text-sm">No hay preguntas configuradas para este bloque. Haz clic en continuar.</div>`;
      psyProgressText.textContent = "0 / 0 Respondidas";
      return;
    }

    let qCount = 0;
    psychometricAnswers = {};

    psychometricExam.parts.forEach(part => {
      let partHtml = `
        <div class="bg-blue-50/30 p-5 rounded-2xl border border-blue-100 shadow-sm space-y-4">
          <h3 class="text-sm font-bold text-blue-700 flex items-center gap-1.5 border-b border-blue-100 pb-2">
            <i class="fa-solid fa-folder text-blue-400"></i> ${part.title}
          </h3>
          <div class="space-y-4">
      `;

      part.questions.forEach(q => {
        qCount++;
        let widget = "";

        if (q.type === 'multiple') {
          widget = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              ${q.options.map(opt => `
                <label class="flex items-center gap-2 p-2.5 rounded-xl border border-blue-50 bg-white hover:bg-blue-50/50 cursor-pointer transition text-xs font-semibold text-gray-700">
                  <input type="radio" name="psy_q_${q.id}" value="${opt}" class="psy-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                  <span>${opt}</span>
                </label>
              `).join('')}
            </div>
          `;
        } else if (q.type === 'boolean') {
          widget = `
            <div class="grid grid-cols-2 gap-3 mt-2 max-w-xs">
              <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-blue-50 bg-white hover:bg-blue-50/50 cursor-pointer transition text-xs font-bold text-gray-700">
                <input type="radio" name="psy_q_${q.id}" value="Verdadero" class="psy-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                Verdadero
              </label>
              <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-blue-50 bg-white hover:bg-blue-50/50 cursor-pointer transition text-xs font-bold text-gray-700">
                <input type="radio" name="psy_q_${q.id}" value="Falso" class="psy-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                Falso
              </label>
            </div>
          `;
        } else if (q.type === 'short') {
          widget = `
            <textarea rows="2" class="psy-textarea-input w-full mt-2 px-3 py-2 rounded-xl border border-blue-100 text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none" data-q-id="${q.id}"></textarea>
          `;
        }

        partHtml += `
          <div class="space-y-1">
            <span class="text-xs font-bold text-gray-700 block">Pregunta: ${q.text}</span>
            ${widget}
          </div>
        `;
      });

      partHtml += `
          </div>
        </div>
      `;
      psyQuestionsContainer.innerHTML += partHtml;
    });

    updateProgress(psyProgressText, 0, qCount);

    // Binds
    document.querySelectorAll('.psy-radio-input').forEach(radio => {
      radio.addEventListener('change', () => {
        const qId = radio.getAttribute('data-q-id');
        psychometricAnswers[qId] = radio.value;
        const total = countAnswers(psychometricAnswers, '.psy-textarea-input');
        updateProgress(psyProgressText, total, qCount);
      });
    });

    document.querySelectorAll('.psy-textarea-input').forEach(ta => {
      ta.addEventListener('input', () => {
        const qId = ta.getAttribute('data-q-id');
        const val = ta.value.trim();
        if (val) {
          psychometricAnswers[qId] = val;
        } else {
          delete psychometricAnswers[qId];
        }
        const total = countAnswers(psychometricAnswers, '.psy-textarea-input');
        updateProgress(psyProgressText, total, qCount);
      });
    });
  }

  function countAnswers(ansObj, taSelector) {
    return Object.keys(ansObj).length;
  }

  function updateProgress(element, answered, total) {
    element.textContent = `${answered} / ${total} Respondidas`;
  }

  // Enviar psicométrico
  btnSubmitPsy.addEventListener('click', () => {
    let totalQuestions = 0;
    if (psychometricExam && psychometricExam.parts) {
      psychometricExam.parts.forEach(p => totalQuestions += p.questions.length);
    }

    if (Object.keys(psychometricAnswers).length < totalQuestions) {
      alert("Por favor, responde todo el examen psicométrico para poder avanzar.");
      return;
    }

    if (assignedTechnicalExam) {
      renderTechnicalExam();
      showStep(stepTechnical);
    } else {
      saveAndFinish();
    }
  });


  // ==========================================
  // PASO 4: EXAMEN TÉCNICO / PROFESIONAL
  // ==========================================
  function renderTechnicalExam() {
    techExamTitle.innerHTML = `<i class="fa-solid fa-award mr-2 text-blue-400"></i>Examen Profesional: <span class="text-blue-600 font-extrabold">${assignedTechnicalExam.name}</span>`;
    techExamDesc.textContent = assignedTechnicalExam.description || "Evaluación práctica de profesión.";

    techQuestionsContainer.innerHTML = "";
    if (!assignedTechnicalExam.parts || assignedTechnicalExam.parts.length === 0) {
      techQuestionsContainer.innerHTML = `<div class="text-center py-8 text-gray-400 text-sm">Este examen no contiene preguntas aún. Puedes finalizar el proceso.</div>`;
      techProgressText.textContent = "0 / 0 Respondidas";
      return;
    }

    let qCount = 0;
    technicalAnswers = {};

    assignedTechnicalExam.parts.forEach(part => {
      let partHtml = `
        <div class="bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100/50 shadow-sm space-y-4">
          <h3 class="text-sm font-bold text-indigo-700 flex items-center gap-1.5 border-b border-indigo-100 pb-2">
            <i class="fa-solid fa-folder text-indigo-400"></i> ${part.title}
          </h3>
          <div class="space-y-4">
      `;

      part.questions.forEach(q => {
        qCount++;
        let widget = "";

        if (q.type === 'multiple') {
          widget = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              ${q.options.map(opt => `
                <label class="flex items-center gap-2 p-2.5 rounded-xl border border-indigo-50 bg-white hover:bg-indigo-50/50 cursor-pointer transition text-xs font-semibold text-gray-700">
                  <input type="radio" name="tech_q_${q.id}" value="${opt}" class="tech-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                  <span>${opt}</span>
                </label>
              `).join('')}
            </div>
          `;
        } else if (q.type === 'boolean') {
          widget = `
            <div class="grid grid-cols-2 gap-3 mt-2 max-w-xs">
              <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-indigo-50 bg-white hover:bg-indigo-50/50 cursor-pointer transition text-xs font-bold text-gray-700">
                <input type="radio" name="tech_q_${q.id}" value="Verdadero" class="tech-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                Verdadero
              </label>
              <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-indigo-50 bg-white hover:bg-indigo-50/50 cursor-pointer transition text-xs font-bold text-gray-700">
                <input type="radio" name="tech_q_${q.id}" value="Falso" class="tech-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                Falso
              </label>
            </div>
          `;
        } else if (q.type === 'short') {
          widget = `
            <textarea rows="3" class="tech-textarea-input w-full mt-2 px-3 py-2 rounded-xl border border-indigo-100 text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none" data-q-id="${q.id}"></textarea>
          `;
        }

        partHtml += `
          <div class="space-y-1">
            <span class="text-xs font-bold text-gray-700 block">Pregunta: ${q.text}</span>
            ${widget}
          </div>
        `;
      });

      partHtml += `
          </div>
        </div>
      `;
      techQuestionsContainer.innerHTML += partHtml;
    });

    updateProgress(techProgressText, 0, qCount);

    // Binds
    document.querySelectorAll('.tech-radio-input').forEach(radio => {
      radio.addEventListener('change', () => {
        const qId = radio.getAttribute('data-q-id');
        technicalAnswers[qId] = radio.value;
        const total = countAnswers(technicalAnswers, '.tech-textarea-input');
        updateProgress(techProgressText, total, qCount);
      });
    });

    document.querySelectorAll('.tech-textarea-input').forEach(ta => {
      ta.addEventListener('input', () => {
        const qId = ta.getAttribute('data-q-id');
        const val = ta.value.trim();
        if (val) {
          technicalAnswers[qId] = val;
        } else {
          delete technicalAnswers[qId];
        }
        const total = countAnswers(technicalAnswers, '.tech-textarea-input');
        updateProgress(techProgressText, total, qCount);
      });
    });
  }

  btnSubmitTech.addEventListener('click', () => {
    let totalQuestions = 0;
    if (assignedTechnicalExam && assignedTechnicalExam.parts) {
      assignedTechnicalExam.parts.forEach(p => totalQuestions += p.questions.length);
    }

    if (Object.keys(technicalAnswers).length < totalQuestions) {
      alert("Por favor, responde todas las preguntas del examen técnico para poder concluir.");
      return;
    }

    if (confirm("¿Estás seguro de enviar tus respuestas?")) {
      saveAndFinish();
    }
  });


  // ==========================================
  // GUARDAR EN SUPABASE
  // ==========================================
  async function saveAndFinish() {
    try {
      let score = 0;
      let maxScore = 0;

      // Estructurar examen profesional
      const structuredTechnical = {
        name: assignedTechnicalExam ? assignedTechnicalExam.name : "General/Psicométrico",
        parts: assignedTechnicalExam ? JSON.parse(JSON.stringify(assignedTechnicalExam.parts)) : []
      };

      structuredTechnical.parts.forEach(p => {
        p.questions.forEach(q => {
          q.userAnswer = technicalAnswers[q.id] || "";
          if (q.type !== 'short') {
            maxScore++;
            if (q.userAnswer === q.correct) {
              score++;
            }
          }
        });
      });

      // Estructurar psicométrico
      const structuredPsychometric = {
        name: psychometricExam ? psychometricExam.name : "N/A",
        parts: psychometricExam ? JSON.parse(JSON.stringify(psychometricExam.parts)) : []
      };

      structuredPsychometric.parts.forEach(p => {
        p.questions.forEach(q => {
          q.userAnswer = psychometricAnswers[q.id] || "";
        });
      });

      // Extraer campos clave para el registro histórico
      const candidateEmail = candidateInfoAnswers['email'] || "";
      const candidatePhone = candidateInfoAnswers['phone'] || "";

      // Guardar en results
      const { error: insertError } = await supabaseClient
        .from('results')
        .insert([{
          candidate_name: selectedCandidate.name,
          candidate_email: candidateEmail,
          candidate_phone: candidatePhone,
          candidate_info: candidateInfoAnswers,
          position: selectedCandidate.assigned_exam_name,
          psychometric_answers: structuredPsychometric,
          technical_answers: structuredTechnical,
          assigned_exam_name: selectedCandidate.assigned_exam_name,
          score: score,
          max_score: maxScore
        }]);

      if (insertError) throw insertError;

      // Actualizar a completado para sacarlo de la cola activa
      const { error: updateError } = await supabaseClient
        .from('candidates')
        .update({ status: 'completed' })
        .eq('id', selectedCandidate.id);

      if (updateError) throw updateError;

      statusBar.classList.add('hidden');
      showStep(stepCompleted);

    } catch (err) {
      console.error(err);
      alert("Error al finalizar la evaluación: " + err.message);
    }
  }

  btnRestart.addEventListener('click', () => {
    candInfoForm.reset();
    psyQuestionsContainer.innerHTML = "";
    techQuestionsContainer.innerHTML = "";
    selectedCandidate = null;
    candidateInfoAnswers = {};
    psychometricAnswers = {};
    technicalAnswers = {};
    loadActiveCandidates();
    showStep(stepSelectCandidate);
  });

  // Inicializar
  await loadActiveCandidates();
});
