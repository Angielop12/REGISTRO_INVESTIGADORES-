/**
 * CONFIGURACIÓN DEL FRONTEND
 * ===========================
 * Reemplaza BACKEND_URL con la URL de tu proyecto en Vercel
 * Ejemplo: https://gestiondoc-backend.vercel.app
 */
const CONFIG = {
  BACKEND_URL: "https://gestiondoc-backend.vercel.app",
  COLORS: [
    "#3B82F6","#10B981","#F59E0B","#EF4444",
    "#8B5CF6","#EC4899","#06B6D4","#84CC16",
    "#F97316","#14B8A6"
  ],
  // ← AGREGA ESTO con los valores de tu Excel:
 TIPOS_PRODUCTO: [
    { tipo: "Artículos de investigación con Calidad A1", puntos: 100 },
    { tipo: "Artículos de investigación con Calidad D", puntos: 5 },
    { tipo: "Libros resultado de investigación con Calidad A1", puntos: 300 },
    { tipo: "Capítulos en libro resultado de investigación con Calidad A1", puntos: 60 },
    { tipo: "Modelo de Utilidad con Calidad A1", puntos: 500 },
    { tipo: "Secreto empresarial", puntos: 100 },
    { tipo: "Innovación generada en la gestión empresarial con Calidad A1", puntos: 100 },
    { tipo: "Informe final de investigación", puntos: 16 },
    { tipo: "Proyecto de participación ciudadana", puntos: 100 },
    { tipo: "Estrategia de comunicación del conocimiento", puntos: 100 },
    { tipo: "Documento de trabajo", puntos: 100 },
    { tipo: "Boletín divulgativo de resultado de investigación", puntos: 100 },
    { tipo: "Informe de investigación", puntos: 100 },
    { tipo: "Tesis de doctorado con Calidad A", puntos: 160 },
    { tipo: "Tesis de maestría con Calidad A", puntos: 70 },
    { tipo: "Trabajos de grado de pregrado con Calidad A", puntos: 20 },
    { tipo: "Proyecto de investigación y Desarrollo", puntos: 50 },
    { tipo: "Apoyo de programas con Calidad A", puntos: 100 },
    { tipo: "Apoyo creación de cursos con Calidad C", puntos: 100 },
    { tipo: "Asesoría al programa Ondas APO", puntos: 30 }
  ]
};