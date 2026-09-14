# LimpiaFoto — Educa OSINT

Herramienta web de código abierto para inspeccionar y eliminar metadatos de fotografías antes de compartirlas. El procesamiento ocurre localmente en el navegador: las imágenes no se cargan ni se almacenan en un servidor.

**Demo pública:** https://limpiafotoosint.site/

## Funciones

- JPG, PNG, WebP, HEIC y HEIF.
- Exploración detallada por grupo y etiqueta de EXIF, GPS, XMP, IPTC, ICC, MPF, JFIF, MakerNotes, Photoshop, PNG y WebP, cuando estén presentes y sean interpretables.
- Marcado de posibles datos sensibles y exportación local del informe completo en JSON.
- Limpieza por reconstrucción de imagen y verificación posterior.
- Procesamiento de hasta 10 fotografías de 25 MB cada una.
- Descarga individual o conjunta en ZIP.
- PWA instalable con funcionamiento básico sin conexión.
- Alertas claras al superar los límites admitidos.
- Páginas de privacidad, términos y créditos.
- Analítica opcional sin cookies ni identificadores.

## Ejecutar localmente

Requiere Node.js 20.9 o posterior.

```bash
npm install
npm run dev
```

Abre http://localhost:3000.

Para comprobar una compilación de producción:

```bash
npm run build
npm start
```

## Despliegue

Es una aplicación Next.js estándar. Puede desplegarse en cualquier plataforma compatible con Next.js. El archivo `.openai/hosting.example.json` sirve como referencia y no contiene identificadores privados.

La variable opcional `ANALYTICS_ENDPOINT` permite reenviar únicamente eventos anónimos permitidos. Las fotografías, nombres de archivo y metadatos nunca se envían. Si no se configura, la herramienta funciona normalmente sin analítica.

## Contribuir

Las mejoras y pull requests son bienvenidos. Consulta [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [LICENSE](LICENSE) y [NOTICE](NOTICE).

## Créditos

Creado para la comunidad [Educa OSINT](https://www.instagram.com/educaosint/), también en [X](https://x.com/educaosint) y [LinkedIn](https://www.linkedin.com/in/educa-osint-a6ba80431/).

Diseñado y creado por [Josias Pool](https://www.instagram.com/josiaspool/), también en [LinkedIn](https://www.linkedin.com/in/josias-pool-2832a483/).

## Licencia

Licencia MIT con atribución. Las redistribuciones deben conservar `LICENSE` y `NOTICE`.
