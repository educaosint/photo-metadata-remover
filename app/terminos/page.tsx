export default function Terminos() {
  return (
    <main className="legal-page">
      <a href="/">← Volver a LimpiaFoto</a>
      <h1>Términos de uso</h1>
      <p className="legal-date">
        Última actualización: 10 de septiembre de 2026
      </p>
      <h2>Uso responsable</h2>
      <p>
        LimpiaFoto es una herramienta educativa gratuita para reducir la
        exposición accidental de metadatos. El usuario es responsable de revisar
        también la información visible dentro de cada fotografía.
      </p>
      <h2>Sin garantía absoluta</h2>
      <p>
        La herramienta reconstruye las imágenes y verifica formatos de metadatos
        conocidos, pero ningún proceso puede garantizar que una fotografía sea
        segura para todos los contextos. No sustituye una revisión profesional
        cuando exista un riesgo elevado.
      </p>
      <h2>Límites</h2>
      <p>
        La versión pública admite hasta 10 imágenes por lote y 25 MB por archivo
        para proteger el rendimiento de cada dispositivo.
      </p>
      <h2>Código abierto y atribución</h2>
      <p>
        El software se distribuye bajo licencia MIT con atribución. Las copias y
        trabajos derivados deben conservar la licencia y el archivo NOTICE con
        los créditos de Educa OSINT y Josias Pool.
      </p>
    </main>
  );
}
