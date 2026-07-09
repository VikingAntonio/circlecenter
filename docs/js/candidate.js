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
  let selectedCandidate = null; // { id, name, assigned_exams: [...] }
  let psychometricExam = null;

  // Flujo multi-examen técnico
  let assignedTechnicalExamsList = []; // Arreglo de exámenes completos traídos de Supabase
  let currentTechnicalExamIndex = 0; // Índice en assignedTechnicalExamsList

  let dynamicFormStructure = []; // Campos cargados dinámicamente
  let candidateInfoAnswers = {}; // { fieldId: value }
  let psychometricAnswers = {};

  // Guardaremos las respuestas técnicas indexadas por el id del examen para soportar múltiples exámenes independientes
  // { [examId]: { [questionId]: answerValue } }
  let technicalAnswersByExam = {};

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
          let examsLabel = "Sin exámenes asignados";
          if (cand.assigned_exams && Array.isArray(cand.assigned_exams) && cand.assigned_exams.length > 0) {
            examsLabel = cand.assigned_exams.map(e => e.name).join(', ');
          } else if (cand.assigned_exam_name) {
            examsLabel = cand.assigned_exam_name;
          }
          selectCand.innerHTML += `<option value="${cand.id}">${cand.name} (${examsLabel})</option>`;
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

      // 2. Obtener exámenes profesionales asignados (pueden ser múltiples)
      assignedTechnicalExamsList = [];
      const examIdsToFetch = [];

      if (selectedCandidate.assigned_exams && Array.isArray(selectedCandidate.assigned_exams)) {
        selectedCandidate.assigned_exams.forEach(e => {
          if (e.id) examIdsToFetch.push(e.id);
        });
      } else if (selectedCandidate.assigned_exam_id) {
        examIdsToFetch.push(selectedCandidate.assigned_exam_id);
      }

      if (examIdsToFetch.length > 0) {
        const { data: techData } = await supabaseClient
          .from('exams')
          .select('*')
          .in('id', examIdsToFetch);

        if (techData && techData.length > 0) {
          // Mantener el orden original que eligió el reclutador
          examIdsToFetch.forEach(id => {
            const match = techData.find(t => t.id === id);
            if (match) assignedTechnicalExamsList.push(match);
          });
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
      showPastelAlert("Por favor, responde todo el examen psicométrico para poder avanzar.");
      return;
    }

    if (assignedTechnicalExamsList.length > 0) {
      currentTechnicalExamIndex = 0;
      renderTechnicalExam();
      showStep(stepTechnical);
    } else {
      saveAndFinish();
    }
  });


  // ==========================================
  // PASO 4: EXAMEN TÉCNICO / PROFESIONAL (SOPORTE MULTI-EXAMEN SEQUENCIAL)
  // ==========================================
  function renderTechnicalExam() {
    const exam = assignedTechnicalExamsList[currentTechnicalExamIndex];
    if (!exam) return;

    // Actualizar tags de encabezado
    const techHeaderTag = document.getElementById('tech-header-tag');
    if (techHeaderTag) {
      techHeaderTag.textContent = `Examen Técnico ${currentTechnicalExamIndex + 1} de ${assignedTechnicalExamsList.length}`;
    }

    techExamTitle.innerHTML = `<i class="fa-solid fa-award mr-2 text-blue-400"></i>Examen Profesional: <span class="text-blue-600 font-extrabold">${exam.name}</span>`;
    techExamDesc.textContent = exam.description || "Evaluación práctica de profesión.";

    // Inicializar respuestas para este examen si no existen
    if (!technicalAnswersByExam[exam.id]) {
      technicalAnswersByExam[exam.id] = {};
    }
    const currentAnswers = technicalAnswersByExam[exam.id];

    techQuestionsContainer.innerHTML = "";
    if (!exam.parts || exam.parts.length === 0) {
      techQuestionsContainer.innerHTML = `<div class="text-center py-8 text-gray-400 text-sm">Este examen no contiene preguntas aún. Puedes finalizar el proceso.</div>`;
      techProgressText.textContent = "0 / 0 Respondidas";
      return;
    }

    let qCount = 0;

    exam.parts.forEach(part => {
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
        const savedVal = currentAnswers[q.id] || "";

        if (q.type === 'multiple') {
          widget = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              ${q.options.map(opt => {
                const checked = savedVal === opt ? 'checked' : '';
                return `
                  <label class="flex items-center gap-2 p-2.5 rounded-xl border border-blue-50 bg-white hover:bg-blue-50/50 cursor-pointer transition text-xs font-semibold text-gray-700">
                    <input type="radio" name="tech_q_${q.id}" value="${opt}" ${checked} class="tech-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                    <span>${opt}</span>
                  </label>
                `;
              }).join('')}
            </div>
          `;
        } else if (q.type === 'boolean') {
          widget = `
            <div class="grid grid-cols-2 gap-3 mt-2 max-w-xs">
              <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-indigo-50 bg-white hover:bg-indigo-50/50 cursor-pointer transition text-xs font-bold text-gray-700">
                <input type="radio" name="tech_q_${q.id}" value="Verdadero" ${savedVal === 'Verdadero' ? 'checked' : ''} class="tech-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                Verdadero
              </label>
              <label class="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-indigo-50 bg-white hover:bg-indigo-50/50 cursor-pointer transition text-xs font-bold text-gray-700">
                <input type="radio" name="tech_q_${q.id}" value="Falso" ${savedVal === 'Falso' ? 'checked' : ''} class="tech-radio-input focus:ring-blue-400 text-blue-500" data-q-id="${q.id}">
                Falso
              </label>
            </div>
          `;
        } else if (q.type === 'short') {
          widget = `
            <textarea rows="3" class="tech-textarea-input w-full mt-2 px-3 py-2 rounded-xl border border-indigo-100 text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none" data-q-id="${q.id}">${savedVal}</textarea>
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

    const answeredCount = Object.keys(currentAnswers).length;
    updateProgress(techProgressText, answeredCount, qCount);

    // Actualizar texto del botón según si hay más exámenes después
    if (currentTechnicalExamIndex < assignedTechnicalExamsList.length - 1) {
      btnSubmitTech.innerHTML = `Siguiente Examen (${currentTechnicalExamIndex + 2}/${assignedTechnicalExamsList.length}) <i class="fa-solid fa-chevron-right ml-1"></i>`;
    } else {
      btnSubmitTech.innerHTML = `Finalizar Todo el Proceso <i class="fa-solid fa-circle-check ml-1"></i>`;
    }

    // Binds
    document.querySelectorAll('.tech-radio-input').forEach(radio => {
      radio.addEventListener('change', () => {
        const qId = radio.getAttribute('data-q-id');
        currentAnswers[qId] = radio.value;
        const total = Object.keys(currentAnswers).length;
        updateProgress(techProgressText, total, qCount);
      });
    });

    document.querySelectorAll('.tech-textarea-input').forEach(ta => {
      ta.addEventListener('input', () => {
        const qId = ta.getAttribute('data-q-id');
        const val = ta.value.trim();
        if (val) {
          currentAnswers[qId] = val;
        } else {
          delete currentAnswers[qId];
        }
        const total = Object.keys(currentAnswers).length;
        updateProgress(techProgressText, total, qCount);
      });
    });
  }

  btnSubmitTech.addEventListener('click', () => {
    const exam = assignedTechnicalExamsList[currentTechnicalExamIndex];
    if (!exam) return;

    let totalQuestions = 0;
    if (exam.parts) {
      exam.parts.forEach(p => totalQuestions += p.questions.length);
    }

    const currentAnswers = technicalAnswersByExam[exam.id] || {};
    if (Object.keys(currentAnswers).length < totalQuestions) {
      showPastelAlert("Por favor, responde todas las preguntas de este examen técnico para poder avanzar.");
      return;
    }

    // Si hay más exámenes técnicos en la lista, pasar al siguiente
    if (currentTechnicalExamIndex < assignedTechnicalExamsList.length - 1) {
      showPastelConfirm("¿Deseas guardar tus respuestas de este examen y continuar al siguiente?", (accepted) => {
        if (accepted) {
          currentTechnicalExamIndex++;
          renderTechnicalExam();
          techQuestionsContainer.scrollTop = 0;
        }
      }, "Siguiente Examen");
    } else {
      showPastelConfirm("¿Estás seguro de enviar tus respuestas y finalizar todo el proceso?", (accepted) => {
        if (accepted) {
          saveAndFinish();
        }
      }, "Finalizar Evaluación");
    }
  });


  // ==========================================
  // GUARDAR EN SUPABASE
  // ==========================================
  async function saveAndFinish() {
    try {
      // Si el candidato hizo múltiples exámenes, guardaremos un registro consolidado de resultados
      // donde 'technical_answers' unifica las respuestas de todos los exámenes, y guardaremos el score acumulado.
      let consolidatedScore = 0;
      let consolidatedMaxScore = 0;
      let consolidatedExamNames = [];

      // Estructuraremos un JSON unificado para 'technical_answers' con las partes de todos los exámenes realizados
      const consolidatedTechnical = {
        name: assignedTechnicalExamsList.map(e => e.name).join(' + '),
        parts: []
      };

      assignedTechnicalExamsList.forEach(exam => {
        consolidatedExamNames.push(exam.name);
        const examAnswers = technicalAnswersByExam[exam.id] || {};

        // Copiar las secciones y añadir las respuestas del usuario
        const partsCopy = JSON.parse(JSON.stringify(exam.parts || []));
        partsCopy.forEach(part => {
          // Diferenciar el título de la sección por el nombre del examen para mayor claridad en perfiles
          part.title = `${exam.name} - ${part.title}`;
          part.questions.forEach(q => {
            q.userAnswer = examAnswers[q.id] || "";
            if (q.type !== 'short') {
              consolidatedMaxScore++;
              if (q.userAnswer === q.correct) {
                consolidatedScore++;
              }
            }
          });
        });

        consolidatedTechnical.parts = consolidatedTechnical.parts.concat(partsCopy);
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
      const positionLabel = consolidatedExamNames.length > 0 ? consolidatedExamNames.join(', ') : "Evaluación General";

      // Guardar en results
      const { error: insertError } = await supabaseClient
        .from('results')
        .insert([{
          candidate_name: selectedCandidate.name,
          candidate_email: candidateEmail,
          candidate_phone: candidatePhone,
          candidate_info: candidateInfoAnswers,
          position: positionLabel,
          psychometric_answers: structuredPsychometric,
          technical_answers: consolidatedTechnical,
          assigned_exam_name: positionLabel,
          score: consolidatedScore,
          max_score: consolidatedMaxScore
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
      showPastelAlert("Error al finalizar la evaluación: " + err.message);
    }
  }

  btnRestart.addEventListener('click', () => {
    candInfoForm.reset();
    psyQuestionsContainer.innerHTML = "";
    techQuestionsContainer.innerHTML = "";
    selectedCandidate = null;
    candidateInfoAnswers = {};
    psychometricAnswers = {};
    technicalAnswersByExam = {};
    assignedTechnicalExamsList = [];
    currentTechnicalExamIndex = 0;
    loadActiveCandidates();
    showStep(stepSelectCandidate);
  });

  // Inicializar
  await loadActiveCandidates();
});
