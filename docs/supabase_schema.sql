-- Esquema de Base de Datos para el Sistema de Recursos Humanos
-- Puedes ejecutar esto directamente en el editor SQL de tu panel de Supabase.

-- Habilitar extensión para UUIDs si no está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla de Exámenes (CRUD por el administrador)
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_psychometric BOOLEAN DEFAULT false,
  parts JSONB DEFAULT '[]'::jsonb, -- Estructura de secciones y preguntas
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Candidatos Activos (Habilitados para hacer examen en el día)
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  assigned_exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  assigned_exam_name TEXT,
  status TEXT DEFAULT 'pending', -- 'pending' (activo) o 'completed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Resultados de Exámenes y Perfiles Guardados
CREATE TABLE IF NOT EXISTS results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_name TEXT NOT NULL,
  candidate_email TEXT,
  candidate_phone TEXT,
  candidate_info JSONB DEFAULT '{}'::jsonb, -- Formulario de datos personales
  position TEXT, -- Vacante/Puesto
  psychometric_answers JSONB DEFAULT '{}'::jsonb, -- Respuestas del examen psicométrico
  technical_answers JSONB DEFAULT '{}'::jsonb, -- Respuestas del examen técnico/profesión
  assigned_exam_name TEXT,
  score NUMERIC DEFAULT 0, -- Puntaje obtenido en examen técnico
  max_score NUMERIC DEFAULT 0, -- Puntaje máximo posible en examen técnico
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insertar examen psicométrico por defecto si no existe
-- (En la aplicación manejaremos un fallback para crear este examen automáticamente si no existe)
