// Configuración e Inicialización de Supabase
const SUPABASE_URL = "https://bdehwaxjhxfyzmfdnzmh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkZWh3YXhqaHhmeXptZmRuem1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NDQxODgsImV4cCI6MjA5OTEyMDE4OH0.zxpENvN_-pTzknh5baF8rY9vtyW8TST7a0U96FiS1Mk";

// Inicializar el cliente de Supabase usando la librería cargada por CDN (normalmente supabase.createClient)
let supabaseClient = null;

if (typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.error("La librería de Supabase no se cargó correctamente desde el CDN.");
}

// Función auxiliar para verificar si estamos autenticados como Admin en el localStorage
function checkAdminAuth() {
  const session = localStorage.getItem('rh_admin_session');
  if (!session) {
    window.location.href = 'login.html';
    return false;
  }
  try {
    const sessionData = JSON.parse(session);
    if (sessionData.username === 'Frank' && sessionData.isLoggedIn) {
      return true;
    }
  } catch (e) {
    // Error al parsear sesión
  }
  window.location.href = 'login.html';
  return false;
}

// Inicializar examen psicométrico por defecto si no existe en la base de datos (con fines de robustez)
const DEFAULT_PSYCHOMETRIC_EXAM = {
  name: "Examen Psicométrico Estándar",
  description: "Examen psicométrico general obligatorio para todas las vacantes.",
  is_psychometric: true,
  parts: [
    {
      title: "Sección 1: Razonamiento Lógico y Aptitudes",
      questions: [
        {
          id: "p1",
          type: "multiple",
          text: "¿Cuál es el número que sigue en la serie: 2, 4, 8, 16, ...?",
          options: ["20", "24", "32", "64"],
          correct: "32"
        },
        {
          id: "p2",
          type: "multiple",
          text: "Si todos los hombres son mortales y Sócrates es un hombre, entonces:",
          options: ["Sócrates es inmortal", "Sócrates es mortal", "Sócrates es inteligente", "Sócrates no es un hombre"],
          correct: "Sócrates es mortal"
        },
        {
          id: "p3",
          type: "boolean",
          text: "El agua hierve a 100 grados Celsius a nivel del mar.",
          options: ["Verdadero", "Falso"],
          correct: "Verdadero"
        }
      ]
    },
    {
      title: "Sección 2: Competencias Laborales y Comportamiento",
      questions: [
        {
          id: "p4",
          type: "multiple",
          text: "Cuando se presenta un problema inesperado en un proyecto, usted suele:",
          options: [
            "Esperar a recibir instrucciones de su superior.",
            "Analizar opciones de solución e implementarlas de inmediato reportando el avance.",
            "Preocuparse y buscar a quién culpar.",
            "Dejar el proyecto de lado hasta que se calme la situación."
          ]
        },
        {
          id: "p5",
          type: "short",
          text: "Describa brevemente cómo maneja usted la frustración cuando las cosas no salen como planeaba:"
        }
      ]
    }
  ]
};

// Asegurar que exista el examen psicométrico por defecto en Supabase
async function ensureDefaultPsychometricExam() {
  if (!supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient
      .from('exams')
      .select('id')
      .eq('is_psychometric', true)
      .limit(1);

    if (error) {
      console.error("Error al buscar examen psicométrico:", error);
      return null;
    }

    if (!data || data.length === 0) {
      const { data: inserted, error: insertError } = await supabaseClient
        .from('exams')
        .insert([DEFAULT_PSYCHOMETRIC_EXAM])
        .select();

      if (insertError) {
        console.error("Error al insertar examen psicométrico por defecto:", insertError);
        return null;
      }
      console.log("Examen psicométrico por defecto creado correctamente.");
      return inserted[0];
    }
    return data[0];
  } catch (err) {
    console.error("Fallo inesperado al asegurar examen psicométrico:", err);
    return null;
  }
}
