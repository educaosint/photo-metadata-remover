# LimpiaFoto — Educa OSINT

Herramienta web abierta para inspeccionar y eliminar metadatos de fotografías antes de compartirlas. El procesamiento ocurre localmente en el navegador: las imágenes no se cargan ni se almacenan en un servidor.

## Funciones

- JPG, PNG, WebP, HEIC y HEIF.
- Lectura detallada de metadatos EXIF, GPS, XMP, IPTC y comentarios.
- Limpieza por reconstrucción de imagen y verificación posterior.
- Procesamiento de hasta 10 fotografías de 25 MB cada una.
- Descarga individual o conjunta en ZIP.
- PWA instalable con funcionamiento básico sin conexión.
- Analítica diaria agregada sin cookies ni identificadores.

## Desarrollo

```bash
npm ci
npm run dev
```

Para generar una compilación:

```bash
npm run build
```

## Privacidad

Nunca envíes fotografías, nombres de archivo o metadatos al servidor. Los eventos analíticos permitidos contienen únicamente el nombre del evento y se agregan por fecha.

## Créditos

Creado para la comunidad [Educa OSINT](https://www.instagram.com/educaosint/). Diseñado y creado por [Josias Pool](https://www.instagram.com/josiaspool/).

## Licencia

Licencia MIT con atribución. Las redistribuciones deben conservar `LICENSE` y `NOTICE`.
