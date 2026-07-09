// JS para la visualización de resultados e historial (admin_results.js)
document.addEventListener('DOMContentLoaded', async () => {
  if (!checkAdminAuth()) return;

  // Elementos DOM
  const resultsTableBody = document.getElementById('results-table-body');
  const resultsSearch = document.getElementById('results-search');
  const filterVacancy = document.getElementById('filter-vacancy');
  const refreshResultsBtn = document.getElementById('refresh-results-btn');

  // Modal Detail DOM
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

  let allResults = [];
  let distinctVacancies = new Set();

  // Cargar resultados
  async function loadResults() {
    if (!supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('results')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      allResults = data || [];

      // Extraer filtros de vacante
      distinctVacancies.clear();
      allResults.forEach(r => {
        if (r.assigned_exam_name) distinctVacancies.add(r.assigned_exam_name);
      });

      populateVacancyFilter();
      renderResults();
    } catch (err) {
      console.error(err);
    }
  }

  function populateVacancyFilter() {
    filterVacancy.innerHTML = '<option value="">Todas las vacantes</option>';
    distinctVacancies.forEach(vac => {
      filterVacancy.innerHTML += `<option value="${vac}">${vac}</option>`;
    });
  }

  function renderResults() {
    resultsTableBody.innerHTML = "";

    const query = resultsSearch.value.toLowerCase().trim();
    const vacancySel = filterVacancy.value;

    const filtered = allResults.filter(res => {
      const matchesSearch = res.candidate_name.toLowerCase().includes(query) ||
                            (res.candidate_email && res.candidate_email.toLowerCase().includes(query)) ||
                            (res.assigned_exam_name && res.assigned_exam_name.toLowerCase().includes(query));

      const matchesVacancy = vacancySel === "" || res.assigned_exam_name === vacancySel;

      return matchesSearch && matchesVacancy;
    });

    if (filtered.length === 0) {
      resultsTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-12 text-gray-400">
            <i class="fa-solid fa-filter text-4xl mb-2 text-blue-100 block"></i>
            No se encontraron aspirantes con los filtros configurados.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(res => {
      const date = new Date(res.created_at).toLocaleDateString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const scoreText = res.max_score > 0 ? `${res.score} / ${res.max_score}` : 'Libre / Abierto';
      const scorePercent = res.max_score > 0 ? Math.round((res.score / res.max_score) * 100) : 100;

      let badgeColor = "bg-emerald-50 text-emerald-700 border border-emerald-100";
      if (res.max_score > 0) {
        if (scorePercent < 60) badgeColor = "bg-rose-50 text-rose-700 border border-rose-100";
        else if (scorePercent < 80) badgeColor = "bg-amber-50 text-amber-700 border border-amber-100";
      }

      resultsTableBody.innerHTML += `
        <tr class="hover:bg-blue-50/20 transition">
          <td class="py-4 px-4 font-bold text-gray-800">
            ${res.candidate_name}
          </td>
          <td class="py-4 px-4 text-xs">
            <div class="text-gray-700">${res.candidate_email || 'N/A'}</div>
            <div class="text-gray-400">${res.candidate_phone || 'N/A'}</div>
          </td>
          <td class="py-4 px-4">
            <span class="font-semibold text-blue-600 text-xs">${res.assigned_exam_name || 'Examen Técnico'}</span>
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
            <button class="view-report-btn px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-xs transition" data-id="${res.id}">
              <i class="fa-regular fa-id-card mr-1"></i> Ver Reporte
            </button>
          </td>
        </tr>
      `;
    });

    // Bind Detail view click
    document.querySelectorAll('.view-report-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const report = allResults.find(r => r.id === id);
        if (report) showReportModal(report);
      });
    });
  }

  function showReportModal(report) {
    modalCandName.textContent = report.candidate_name;
    modalCandPos.textContent = `Vacante de Interés: ${report.assigned_exam_name || 'General'}`;
    modalCandEmail.textContent = report.candidate_email || 'No especificado';
    modalCandPhone.textContent = report.candidate_phone || 'No especificado';

    const scorePct = report.max_score > 0 ? Math.round((report.score / report.max_score) * 100) : 100;
    modalCandScore.textContent = report.max_score > 0 ? `${report.score} / ${report.max_score}` : 'Evaluación Abierta';
    modalCandPercentage.textContent = report.max_score > 0 ? `${scorePct}%` : 'Finalizado';

    // Formulario de Registro Dinámico render
    modalCandInfoFields.innerHTML = "";
    const info = report.candidate_info || {};
    const infoKeys = Object.keys(info);

    if (infoKeys.length === 0) {
      modalCandInfoFields.innerHTML = '<span class="text-gray-400 col-span-2">No se capturó información adicional de formulario.</span>';
    } else {
      infoKeys.forEach(key => {
        const cleanKey = key.replace(/_/g, ' ').toUpperCase();
        modalCandInfoFields.innerHTML += `
          <div class="bg-white p-2 rounded-xl border border-blue-50 shadow-sm">
            <strong class="text-[9px] text-blue-400 uppercase block">${cleanKey}</strong>
            <span class="text-xs font-semibold text-gray-700">${info[key]}</span>
          </div>
        `;
      });
    }

    // Renderizar secciones de examen
    renderAnswers(modalAnswersPsy, report.psychometric_answers);
    renderAnswers(modalAnswersTech, report.technical_answers);

    // Resetear Tabs
    modalTabPsyBtn.className = "pb-2 px-4 border-b-2 border-blue-500 text-blue-600 font-bold text-sm";
    modalTabTechBtn.className = "pb-2 px-4 border-b-2 border-transparent text-gray-500 font-bold text-sm hover:text-blue-600";
    modalAnswersPsy.classList.remove('hidden');
    modalAnswersTech.classList.add('hidden');

    resultModal.classList.remove('hidden');
  }

  function renderAnswers(container, answersData) {
    container.innerHTML = "";
    const parts = answersData.parts || [];
    if (parts.length === 0) {
      container.innerHTML = `<div class="text-center py-4 text-gray-400 text-xs">No hay respuestas cargadas para este bloque.</div>`;
      return;
    }

    parts.forEach(part => {
      let partHtml = `
        <div class="bg-blue-50/30 p-4 rounded-xl border border-blue-100/50 space-y-3">
          <h5 class="text-xs font-bold text-blue-700 border-b border-blue-100/50 pb-1.5"><i class="fa-solid fa-folder-open mr-1"></i> ${part.title}</h5>
          <div class="space-y-3 divide-y divide-blue-50/50">
      `;

      part.questions.forEach((q, idx) => {
        const hasCorrect = q.type !== 'short';
        const isCorrect = hasCorrect && (q.userAnswer === q.correct);

        let badge = "";
        if (hasCorrect) {
          badge = isCorrect
            ? `<span class="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100"><i class="fa-solid fa-check"></i> Correcto</span>`
            : `<span class="text-[9px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-100"><i class="fa-solid fa-xmark"></i> Incorrecto</span>`;
        } else {
          badge = `<span class="text-[9px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">Abierta</span>`;
        }

        partHtml += `
          <div class="pt-2 space-y-1">
            <div class="flex justify-between items-start gap-4">
              <span class="text-xs font-bold text-gray-700">${idx + 1}. ${q.text}</span>
              ${badge}
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div class="bg-blue-50/20 p-2 rounded-lg border border-blue-100/20">
                <strong class="text-[8px] text-gray-400 block uppercase">Respuesta del Aspirante</strong>
                <span class="font-medium text-blue-900">${q.userAnswer || '<em class="text-gray-300">Sin responder</em>'}</span>
              </div>
              ${hasCorrect ? `
                <div class="bg-emerald-50/10 p-2 rounded-lg border border-emerald-100/10">
                  <strong class="text-[8px] text-gray-400 block uppercase">Clave Esperada</strong>
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

  // Cerrar Modal
  const closeModal = () => resultModal.classList.add('hidden');
  modalCloseBtn.addEventListener('click', closeModal);
  modalCloseBottomBtn.addEventListener('click', closeModal);

  modalTabPsyBtn.addEventListener('click', () => {
    modalTabPsyBtn.className = "pb-2 px-4 border-b-2 border-blue-500 text-blue-600 font-bold text-sm";
    modalTabTechBtn.className = "pb-2 px-4 border-b-2 border-transparent text-gray-500 font-bold text-sm hover:text-blue-600";
    modalAnswersPsy.classList.remove('hidden');
    modalAnswersTech.classList.add('hidden');
  });

  modalTabTechBtn.addEventListener('click', () => {
    modalTabTechBtn.className = "pb-2 px-4 border-b-2 border-blue-500 text-blue-600 font-bold text-sm";
    modalTabPsyBtn.className = "pb-2 px-4 border-b-2 border-transparent text-gray-500 font-bold text-sm hover:text-blue-600";
    modalAnswersTech.classList.remove('hidden');
    modalAnswersPsy.classList.add('hidden');
  });

  modalPrintBtn.addEventListener('click', () => {
    window.print();
  });

  resultsSearch.addEventListener('input', renderResults);
  filterVacancy.addEventListener('change', renderResults);
  refreshResultsBtn.addEventListener('click', loadResults);

  // Inicializar
  await loadResults();
});
