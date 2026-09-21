/*
  PERSONALIZA AQUÍ TU JARDÍN
  --------------------------
  Puedes editar este archivo directamente, o usar el botón "Ajustes" dentro de la página
  (lo que guardes en Ajustes tiene prioridad y se queda solo en ese navegador).

  Para poner fotos sin usar Ajustes: copia tus imágenes a la carpeta "fotos" y
  escribe su ruta en "foto", por ejemplo: foto: "fotos/nosotros1.jpg"
  Si un recuerdo no tiene foto, se muestra una florecita en su lugar.
*/
window.FLORES_CONFIG = {
  nombre1: "Yo",            // quien regala el jardín
  nombre2: "Mi amor",       // quien lo recibe
  fecha: "2024-03-21",      // desde cuándo están juntos (AAAA-MM-DD). Déjala vacía para ocultar el contador
  musica: "music/Floricienta.mp3", // ruta a un mp3 (déjala vacía para no usar música)

  carta:
`Hoy quise sembrar un jardín entero para ti.

Elegí las flores amarillas porque me recuerdan a tu risa, a esa luz que tienes y que hace que hasta los días grises se vean dorados.

Cada flor que crece aquí es un momento contigo. Toca las que brillan: guardan nuestros recuerdos.

Gracias por quedarte, por cuidarme y por florecer conmigo. Si pudiera, te regalaría todas las primaveras.

Te quiero, hoy y siempre.`,

  recuerdos: [
    { foto: "", titulo: "El día que te conocí",     texto: "Ese día no lo sabía, pero empezaba mi historia favorita." },
    { foto: "", titulo: "Nuestra primera salida",   texto: "Los nervios, las risas y las ganas de que la noche no terminara." },
    { foto: "", titulo: "Un día cualquiera contigo", texto: "Lo ordinario se vuelve especial cuando estás tú." },
    { foto: "", titulo: "Lo que más quiero",        texto: "Verte feliz. Y ser parte de la razón." }
  ]
};
