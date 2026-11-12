// Encuestas del taller. Es la unica fuente de verdad: la web y la presentacion
// reciben estas preguntas desde la API.
export const ENCUESTAS = {
  carrera: {
    pregunta: '¿Qué estudiás?',
    ayuda: 'Escribí tu carrera y mirá la pantalla.',
    tipo: 'texto',
    opciones: [],
  },
  millon: {
    pregunta: '¿Cuánto espacio ocupa un millón de personas?',
    ayuda: 'A ojo, sin buscar.',
    opciones: [
      { id: 'A', texto: 'Una cancha de fútbol' },
      { id: 'B', texto: 'Una plaza' },
      { id: 'C', texto: 'Un barrio' },
      { id: 'D', texto: 'Una ciudad' },
    ],
  },
  etapa: {
    pregunta: '¿Qué etapa es la que más se saltea la gente?',
    ayuda: 'Elegí la que te parezca.',
    opciones: [
      { id: 'PREGUNTAR', texto: 'Preguntar' },
      { id: 'ESPECIFICAR', texto: 'Especificar' },
      { id: 'CONSTRUIR', texto: 'Construir' },
      { id: 'VERIFICAR', texto: 'Verificar' },
      { id: 'ENTREGAR', texto: 'Entregar' },
    ],
  },
  potencia: {
    pregunta: 'En tu futuro trabajo, la IA va a…',
    ayuda: 'Respondé lo primero que pienses.',
    opciones: [
      { id: 'A', texto: 'Reemplazarme' },
      { id: 'B', texto: 'Potenciarme' },
      { id: 'C', texto: 'Cambiarme las tareas' },
      { id: 'D', texto: 'Todavía no sé' },
    ],
  },
  densidad: {
    pregunta: '¿Cuán apretadas están las personas?',
    ayuda: 'Es el supuesto que va a usar el modelo.',
    opciones: [
      { id: '2', texto: 'Cómodas · 2 por m²' },
      { id: '4', texto: 'Como en un recital · 4 por m²' },
      { id: '5', texto: 'Muy apretadas · 5 por m²' },
    ],
  },
  pedido: {
    pregunta: '¿Con qué comparamos el resultado?',
    ayuda: 'Lo más votado se lo pedimos a la IA en vivo.',
    opciones: [
      { id: 'A', texto: 'Canchas de fútbol' },
      { id: 'B', texto: 'Plazas' },
      { id: 'C', texto: 'Manzanas de Rosario' },
      { id: 'D', texto: 'Parques de la Independencia' },
    ],
  },
  calles: {
    pregunta: '¿Contamos calles y accesos?',
    ayuda: 'Suma un 30% de superficie.',
    opciones: [
      { id: 'SI', texto: 'Sí, sumemos circulación' },
      { id: 'NO', texto: 'No, solo las personas' },
    ],
  },
};

export const LIMITES = {
  textoPregunta: 200,
  preguntasPorMinuto: 3,
  intentosPin: 5,
  ventanaPinMin: 5,
  intentosGlobales: 25,
  horasToken: 36,
  bytesApp: 400000,
  dispositivosPorIp: 45,
  textoPalabra: 32,
};
