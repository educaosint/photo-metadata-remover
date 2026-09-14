"use client";

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import {
  Check,
  Coffee,
  Download,
  GitFork,
  ImagePlus,
  LockKeyhole,
  MapPinOff,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

type Status = "ready" | "processing" | "clean" | "error";
type MetadataItem = { label: string; value: string };
type MetadataDetail = {
  group: string;
  tag: string;
  value: string;
  sensitive: boolean;
};
type Photo = {
  id: string;
  file: File;
  preview: string;
  cleanUrl?: string;
  cleanBlob?: Blob;
  cleanExt?: string;
  metadata: MetadataItem[];
  metadataDetails: MetadataDetail[];
  status: Status;
  error?: string;
};
const ACCEPTED = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ],
  MAX_SIZE = 25 * 1024 * 1024,
  MAX_FILES = 10;

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Creado para la comunidad @EducaOSINT.
// Diseño y creación: Josias Pool (@josiaspool).
function track(
  event: "visit" | "clean_photo" | "download_zip" | "install_pwa",
) {
  // GitHub Pages is static. Keep this hook for a future privacy-friendly
  // analytics endpoint without transmitting photos or metadata.
  void event;
}

function isHeic(file: File) {
  return (
    ["image/heic", "image/heif"].includes(file.type) ||
    /\.(heic|heif)$/i.test(file.name)
  );
}

async function convertHeic(file: File) {
  const { default: heic2any } = await import("heic2any");
  const result = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.96,
  });
  return Array.isArray(result) ? result[0] : result;
}

function inspectMetadata(buffer: ArrayBuffer, type: string) {
  const bytes = new Uint8Array(buffer),
    view = new DataView(buffer),
    found: MetadataItem[] = [];
  const ascii = new TextDecoder("latin1").decode(
    bytes.slice(0, Math.min(bytes.length, 2_000_000)),
  );
  const add = (label: string, value?: unknown) => {
    const clean = String(value ?? "")
      .replace(/\0/g, "")
      .trim();
    if (!found.some((item) => item.label === label))
      found.push({ label, value: clean || "Detectado en el archivo" });
  };
  const safe = (offset: number, size = 1) =>
    offset >= 0 && offset + size <= view.byteLength;
  let tiff = -1,
    exifBlock = false;
  if (type === "image/jpeg")
    for (let i = 2; i + 4 < bytes.length && bytes[i] === 0xff;) {
      const marker = bytes[i + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const length = (bytes[i + 2] << 8) + bytes[i + 3];
      if (marker === 0xe1) {
        exifBlock = true;
        if (String.fromCharCode(...bytes.slice(i + 4, i + 10)) === "Exif\0\0")
          tiff = i + 10;
      }
      if (marker === 0xed) add("Datos IPTC", "Bloque IPTC detectado");
      if (marker === 0xfe) {
        const value = new TextDecoder("latin1").decode(
          bytes.slice(i + 4, i + 2 + length),
        );
        add("Comentario incrustado", value.slice(0, 180));
      }
      i += 2 + Math.max(length, 2);
    }
  if (type === "image/png")
    for (let i = 8; i + 12 <= bytes.length;) {
      const length = view.getUint32(i),
        name = String.fromCharCode(...bytes.slice(i + 4, i + 8));
      if (name === "eXIf") {
        tiff = i + 8;
        exifBlock = true;
      }
      if (["tEXt", "iTXt", "zTXt"].includes(name)) {
        const value = new TextDecoder("latin1").decode(
          bytes.slice(i + 8, Math.min(i + 8 + length, bytes.length)),
        );
        add("Texto o datos incrustados", value.slice(0, 180));
      }
      i += 12 + length;
    }
  if (type === "image/webp")
    for (let i = 12; i + 8 <= bytes.length;) {
      const name = String.fromCharCode(...bytes.slice(i, i + 4)),
        length = view.getUint32(i + 4, true);
      if (name === "EXIF") {
        tiff =
          i +
          8 +
          (String.fromCharCode(...bytes.slice(i + 8, i + 14)) === "Exif\0\0"
            ? 6
            : 0);
        exifBlock = true;
      }
      i += 8 + length + (length % 2);
    }
  if (tiff >= 0 && safe(tiff, 8))
    try {
      const little = String.fromCharCode(bytes[tiff], bytes[tiff + 1]) === "II",
        u16 = (o: number) => view.getUint16(o, little),
        u32 = (o: number) => view.getUint32(o, little);
      if (u16(tiff + 2) === 42) {
        const sizes: Record<number, number> = {
          1: 1,
          2: 1,
          3: 2,
          4: 4,
          5: 8,
          7: 1,
          9: 4,
          10: 8,
        };
        const readValue = (entry: number) => {
          const kind = u16(entry + 2),
            count = u32(entry + 4),
            size = (sizes[kind] || 1) * count,
            start = size <= 4 ? entry + 8 : tiff + u32(entry + 8);
          if (!safe(start, size)) return undefined;
          if (kind === 2)
            return new TextDecoder("latin1")
              .decode(bytes.slice(start, start + count))
              .replace(/\0+$/, "");
          const values: number[] = [];
          for (let j = 0; j < count; j++) {
            const at = start + j * (sizes[kind] || 1);
            if (kind === 1 || kind === 7) values.push(bytes[at]);
            else if (kind === 3) values.push(u16(at));
            else if (kind === 4) values.push(u32(at));
            else if (kind === 5) {
              const d = u32(at + 4);
              values.push(d ? u32(at) / d : 0);
            } else if (kind === 9) values.push(view.getInt32(at, little));
            else if (kind === 10) {
              const d = view.getInt32(at + 4, little);
              values.push(d ? view.getInt32(at, little) / d : 0);
            }
          }
          return values.length === 1 ? values[0] : values;
        };
        const readIfd = (offset: number) => {
          const out = new Map<number, unknown>(),
            start = tiff + offset;
          if (!safe(start, 2)) return out;
          const count = u16(start);
          for (let n = 0; n < count; n++) {
            const entry = start + 2 + n * 12;
            if (!safe(entry, 12)) break;
            out.set(u16(entry), readValue(entry));
          }
          return out;
        };
        const root = readIfd(u32(tiff + 4)),
          exifOffset = Number(root.get(0x8769) || 0),
          gpsOffset = Number(root.get(0x8825) || 0),
          exif = exifOffset ? readIfd(exifOffset) : new Map<number, unknown>();
        const make = String(root.get(0x010f) || "").trim(),
          model = String(root.get(0x0110) || "").trim(),
          lens = String(exif.get(0xa434) || "").trim();
        if (make || model || lens)
          add(
            "Cámara o dispositivo",
            [make, model, lens && `Lente: ${lens}`].filter(Boolean).join(" · "),
          );
        const date = exif.get(0x9003) || exif.get(0x9004) || root.get(0x0132);
        if (date) add("Fecha y hora", date);
        const software = root.get(0x0131);
        if (software) add("Software de edición", software);
        const artist = root.get(0x013b) || root.get(0x8298);
        if (artist) add("Autor o propietario", artist);
        if (gpsOffset) {
          const gps = readIfd(gpsOffset),
            lat = gps.get(2),
            lon = gps.get(4),
            latRef = String(gps.get(1) || "N"),
            lonRef = String(gps.get(3) || "E");
          if (Array.isArray(lat) && Array.isArray(lon)) {
            const decimal = (v: number[]) => v[0] + v[1] / 60 + v[2] / 3600,
              latitude = decimal(lat) * (latRef === "S" ? -1 : 1),
              longitude = decimal(lon) * (lonRef === "W" ? -1 : 1);
            add(
              "Ubicación GPS",
              `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            );
          } else add("Ubicación GPS", "Coordenadas GPS presentes");
        }
      }
    } catch {
      add("Bloque EXIF", "Detectado; no se pudo interpretar completamente");
    }
  if (exifBlock) add("Bloque EXIF", "Estructura EXIF presente");
  if (/xmpmeta|http:\/\/ns\.adobe\.com\/xap/i.test(ascii)) {
    const tool =
      ascii.match(
        /(?:xmp:CreatorTool|photoshop:CreatorTool)=[\"']([^\"']+)/i,
      )?.[1] || ascii.match(/<xmp:CreatorTool[^>]*>([^<]+)/i)?.[1];
    add("Datos XMP", tool ? `Herramienta: ${tool}` : "Bloque XMP detectado");
  }
  if (!found.some((x) => x.label === "Software de edición")) {
    const software = ascii.match(
      /(?:Adobe Photoshop|Adobe Lightroom|Lightroom|Photoshop)[^\0<\"]{0,60}/i,
    )?.[0];
    if (software) add("Software de edición", software);
  }
  return found;
}

const GROUP_LABELS: Record<string, string> = {
  exif: "EXIF",
  iptc: "IPTC",
  xmp: "XMP",
  icc: "Perfil ICC",
  gps: "GPS",
  makerNotes: "Notas del fabricante",
  photoshop: "Recursos de Photoshop",
  mpf: "Formato multifoto (MPF)",
  jfif: "JFIF",
  file: "Información del archivo",
  pngFile: "Información PNG",
  pngText: "Texto PNG",
  riff: "Contenedor WebP/RIFF",
  gif: "Información GIF",
  composite: "Datos calculados",
  thumbnail: "Miniatura incrustada",
};

function readableMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.replace(/\0/g, "").trim();
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (value instanceof ArrayBuffer)
    return `[datos binarios: ${value.byteLength} bytes]`;
  if (ArrayBuffer.isView(value))
    return `[datos binarios: ${value.byteLength} bytes]`;
  if (Array.isArray(value)) {
    if (value.length > 256 && value.every((item) => typeof item === "number"))
      return `[datos numéricos/binarios: ${value.length} elementos]`;
    return value.map(readableMetadataValue).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("description" in record) {
      const description = readableMetadataValue(record.description);
      if (description) return description;
    }
    if ("computed" in record) {
      const computed = readableMetadataValue(record.computed);
      if (computed) return computed;
    }
    if ("value" in record) {
      const raw = readableMetadataValue(record.value);
      if (raw) return raw;
    }
    try {
      return (
        JSON.stringify(record, (_key, item) => {
          if (item instanceof ArrayBuffer)
            return `[datos binarios: ${item.byteLength} bytes]`;
          if (ArrayBuffer.isView(item))
            return `[datos binarios: ${item.byteLength} bytes]`;
          return item;
        }) || "[valor vacío]"
      );
    } catch {
      return "[valor estructurado no serializable]";
    }
  }
  return String(value);
}

function isSensitiveMetadata(group: string, tag: string) {
  return /gps|location|latitude|longitude|altitude|address|author|artist|owner|creator|copyright|email|phone|serial|device|camera|make|model|date|time|comment|description|keyword|subject|person/i.test(
    `${group} ${tag}`,
  );
}

async function inspectAllMetadata(
  file: File,
  buffer: ArrayBuffer,
): Promise<{ summary: MetadataItem[]; details: MetadataDetail[] }> {
  const summary = inspectMetadata(buffer, file.type);
  const details: MetadataDetail[] = [];

  try {
    const { default: ExifReader } = await import("exifreader");
    const expanded = (await ExifReader.load(buffer, {
      expanded: true,
      async: true,
    })) as Record<string, unknown>;

    const addDetail = (group: string, tag: string, raw: unknown) => {
      const value = readableMetadataValue(raw);
      if (!value) return;
      details.push({
        group: GROUP_LABELS[group] || group,
        tag,
        value,
        sensitive: isSensitiveMetadata(group, tag),
      });
    };

    const walk = (
      group: string,
      value: unknown,
      path: string[] = [],
      depth = 0,
    ) => {
      if (depth > 5 || value === null || value === undefined) return;
      if (
        typeof value !== "object" ||
        value instanceof ArrayBuffer ||
        ArrayBuffer.isView(value) ||
        Array.isArray(value)
      ) {
        addDetail(group, path.join(" › ") || group, value);
        return;
      }
      const record = value as Record<string, unknown>;
      if ("description" in record || "value" in record || "computed" in record) {
        addDetail(group, path.join(" › ") || group, record);
        return;
      }
      for (const [key, child] of Object.entries(record))
        walk(group, child, [...path, key], depth + 1);
    };

    for (const [group, data] of Object.entries(expanded)) {
      if (group === "metadataRange") continue;
      walk(group, data);
    }

    const groupCounts = new Map<string, number>();
    for (const item of details)
      groupCounts.set(item.group, (groupCounts.get(item.group) || 0) + 1);

    const groupToSummary: Record<string, string> = {
      IPTC: "Datos IPTC",
      EXIF: "Bloque EXIF",
      XMP: "Datos XMP",
      GPS: "Ubicación GPS",
      "Perfil ICC": "Perfil de color ICC",
      "Notas del fabricante": "Datos del fabricante",
      "Recursos de Photoshop": "Recursos de Photoshop",
      "Formato multifoto (MPF)": "Formato multifoto",
      JFIF: "Datos JFIF",
      "Texto PNG": "Texto o datos incrustados",
    };
    for (const [group, count] of groupCounts) {
      const label = groupToSummary[group];
      if (label && !summary.some((item) => item.label === label))
        summary.push({
          label,
          value: ["Datos JFIF", "Perfil de color ICC"].includes(label)
            ? `${count} etiquetas técnicas; sin datos personales identificables`
            : `${count} etiquetas interpretadas`,
        });
    }
  } catch {
    // The compact built-in detector remains available as a safe fallback.
  }

  const unique = new Map<string, MetadataDetail>();
  for (const item of details)
    unique.set(`${item.group}\u0000${item.tag}\u0000${item.value}`, item);

  return {
    summary,
    details: [...unique.values()].sort(
      (a, b) => a.group.localeCompare(b.group) || a.tag.localeCompare(b.tag),
    ),
  };
}

function isSensitiveSummary(item: MetadataItem) {
  return !["Datos JFIF", "Perfil de color ICC"].includes(item.label);
}

async function decodeImage(file: File) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image(),
        url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No se pudo leer la imagen"));
      };
      img.src = url;
    });
  }
}
async function cleanPhoto(file: File, quality: number) {
  const source = isHeic(file) ? await convertHeic(file) : file;
  const image = await decodeImage(
      new File([source], file.name, { type: source.type }),
    ),
    canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { alpha: file.type === "image/png" });
  if (!ctx) throw new Error("Tu navegador no permite procesar esta imagen.");
  ctx.drawImage(image, 0, 0, image.width, image.height);
  if ("close" in image && typeof image.close === "function") image.close();
  const outputType =
    file.type === "image/png"
      ? "image/png"
      : file.type === "image/webp"
        ? "image/webp"
        : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, outputType, quality),
  );
  if (!blob) throw new Error("No se pudo crear el archivo limpio.");
  if (inspectMetadata(await blob.arrayBuffer(), outputType).length)
    throw new Error("La verificación encontró metadatos residuales.");
  return blob;
}
function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Home() {
  const [photos, setPhotos] = useState<Photo[]>([]),
    [dragging, setDragging] = useState(false),
    [quality, setQuality] = useState(92),
    [notice, setNotice] = useState(""),
    [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
      null,
    );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    track("visit");
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const ready = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", ready);
    return () => window.removeEventListener("beforeinstallprompt", ready);
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") track("install_pwa");
    setInstallPrompt(null);
  }
  async function addFiles(files: File[]) {
    setNotice("");
    const room = Math.max(0, MAX_FILES - photos.length);
    const valid = files.slice(0, room).filter((file) => {
      if (!ACCEPTED.includes(file.type) && !isHeic(file)) {
        setNotice("Solo se admiten imágenes JPG, PNG, WebP, HEIC y HEIF.");
        return false;
      }
      if (file.size > MAX_SIZE) {
        setNotice("Límite superado: cada imagen debe pesar 25 MB o menos.");
        return false;
      }
      return true;
    });
    if (files.length > room)
      setNotice(
        `Límite superado: puedes procesar hasta ${MAX_FILES} fotos a la vez.`,
      );
    const items = await Promise.all(
      valid.map(async (file) => {
        const previewBlob = isHeic(file) ? await convertHeic(file) : file;
        return {
          id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          preview: URL.createObjectURL(previewBlob),
          ...(await inspectAllMetadata(file, await file.arrayBuffer()).then(
            ({ summary, details }) => ({
              metadata: summary,
              metadataDetails: details,
            }),
          )),
          status: "ready" as Status,
        };
      }),
    );
    setPhotos((current) => [...current, ...items]);
  }
  function pickFiles(e: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  }
  function drop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }
  function remove(id: string) {
    setPhotos((current) =>
      current.filter((p) => {
        if (p.id === id) {
          URL.revokeObjectURL(p.preview);
          if (p.cleanUrl) URL.revokeObjectURL(p.cleanUrl);
          return false;
        }
        return true;
      }),
    );
  }
  async function cleanAll() {
    const targets = photos.filter((p) => p.status !== "processing");
    setPhotos((current) =>
      current.map((p) => ({ ...p, status: "processing", error: undefined })),
    );
    await Promise.all(
      targets.map(async (photo) => {
        try {
          const blob = await cleanPhoto(photo.file, quality / 100),
            cleanUrl = URL.createObjectURL(blob);
          track("clean_photo");
          setPhotos((current) =>
            current.map((p) =>
              p.id === photo.id
                ? {
                    ...p,
                    cleanUrl,
                    cleanBlob: blob,
                    cleanExt: isHeic(photo.file) ? "jpg" : undefined,
                    status: "clean",
                  }
                : p,
            ),
          );
        } catch (error) {
          setPhotos((current) =>
            current.map((p) =>
              p.id === photo.id
                ? {
                    ...p,
                    status: "error",
                    error:
                      error instanceof Error
                        ? error.message
                        : "Error inesperado",
                  }
                : p,
            ),
          );
        }
      }),
    );
  }
  function download(photo: Photo) {
    if (!photo.cleanUrl) return;
    const ext =
        photo.cleanExt ||
        (photo.file.type === "image/png"
          ? "png"
          : photo.file.type === "image/webp"
            ? "webp"
            : "jpg"),
      base = photo.file.name
        .replace(/\.[^.]+$/, "")
        .replace(/(?:-sin-metadatos)+$/i, "");
    const link = document.createElement("a");
    link.href = photo.cleanUrl;
    link.download = `${base}-sin-metadatos.${ext}`;
    link.click();
  }
  function downloadMetadataReport(photo: Photo) {
    const report = {
      tool: "LimpiaFoto — Educa OSINT",
      file: {
        name: photo.file.name,
        type: photo.file.type || "desconocido",
        size: photo.file.size,
      },
      detectedTypes: photo.metadata,
      tags: photo.metadataDetails,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${photo.file.name.replace(/\.[^.]+$/, "")}-metadatos.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
    async function downloadAll() {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    photos
      .filter((photo) => photo.cleanBlob)
      .forEach((photo) => {
        const ext =
          photo.cleanExt ||
          (photo.file.type === "image/png"
            ? "png"
            : photo.file.type === "image/webp"
              ? "webp"
              : "jpg");
        zip.file(
          `${photo.file.name
            .replace(/\.[^.]+$/, "")
            .replace(/(?:-sin-metadatos)+$/i, "")}-sin-metadatos.${ext}`,
          photo.cleanBlob!,
        );
      });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = "LimpiaFoto-EducaOSINT.zip";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    track("download_zip");
  }
  function clearAll() {
    photos.forEach((p) => {
      URL.revokeObjectURL(p.preview);
      if (p.cleanUrl) URL.revokeObjectURL(p.cleanUrl);
    });
    setPhotos([]);
  }
  const cleanCount = photos.filter((p) => p.status === "clean").length,
    isWorking = photos.some((p) => p.status === "processing");
  return (
    <main className="min-h-screen">
      <header className="topbar">
        <a className="brand" href="#inicio">
          <img src="/educa-osint-logo.png" alt="Logo Educa OSINT" />
          <span>
            <strong>LimpiaFoto</strong>
            <small>por Educa OSINT</small>
          </span>
        </a>
        <nav className="topnav">
          <a href="/creditos">
            <GitFork size={16} /> Código abierto
          </a>
          {installPrompt && (
            <button onClick={installApp}>
              <Download size={16} /> Instalar app
            </button>
          )}
        </nav>
      </header>
      <section id="inicio" className="intro">
        <div className="eyebrow">
          <ShieldCheck size={16} /> Privacidad antes de publicar
        </div>
        <h1>
          Comparte la foto.
          <br />
          <em>No tus datos.</em>
        </h1>
        <p>
          Elimina ubicación, fecha, dispositivo y otros metadatos ocultos. Todo
          ocurre en tu navegador: tus fotos nunca salen de tu equipo.
        </p>
      </section>
      <section className="workspace" aria-label="Limpiador de metadatos">
        <div
          className={`dropzone ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            multiple
            onChange={pickFiles}
            hidden
          />
          <div className="upload-icon">
            <ImagePlus size={29} />
          </div>
          <h2>Arrastra tus fotos aquí</h2>
          <p>o selecciónalas desde tu dispositivo</p>
          <button className="primary" onClick={() => inputRef.current?.click()}>
            Seleccionar fotos
          </button>
          <small>JPG, PNG, WebP o HEIC · Máx. 25 MB · Hasta 10 fotos</small>
        </div>
        {notice && (
          <div className="notice" role="alert">
            <X size={16} />
            <div>
              <strong>{notice}</strong>
              {notice.startsWith("Límite") && (
                <span className="limit-help">
                  <Coffee size={15} />
                  ¿Necesitas procesar más? Escríbenos a{" "}
                  <a href="mailto:educaosint@gmail.com">
                    educaosint@gmail.com
                  </a>{" "}
                  o{" "}
                  <a href="mailto:josiaspool@gmail.com">josiaspool@gmail.com</a>{" "}
                  y apoya el proyecto regalando un café de US$10–20.
                </span>
              )}
            </div>
          </div>
        )}
        {photos.length > 0 && (
          <div className="queue">
            <div className="queue-head">
              <div>
                <span className="step">PASO 2</span>
                <h2>Revisa y limpia</h2>
              </div>
              <button className="text-button" onClick={clearAll}>
                <Trash2 size={16} /> Quitar todas
              </button>
            </div>
            <div className="photo-list">
              {photos.map((photo) => (
                <article className="photo-card" key={photo.id}>
                  <img
                    src={photo.preview}
                    alt="Vista previa de la foto seleccionada"
                  />
                  <div className="photo-info">
                    <strong>{photo.file.name}</strong>
                    <small>{formatBytes(photo.file.size)}</small>
                    {photo.status === "ready" && (
                      <>
                        <p
                          className={
                            photo.metadata.some(isSensitiveSummary)
                              ? "risk"
                              : photo.metadata.length
                                ? "safe"
                                : "neutral"
                          }
                        >
                          {photo.metadata.some(isSensitiveSummary)
                            ? `${photo.metadata.filter(isSensitiveSummary).length} tipos de metadatos sensibles detectados`
                            : photo.metadata.length
                              ? `Limpia: sin metadatos sensibles · ${photo.metadata.length} estructuras técnicas`
                              : "Sin metadatos reconocibles; se limpiará de todos modos"}
                        </p>
                        {photo.metadata.length > 0 && (
                          <div
                            className={
                              photo.metadata.some(isSensitiveSummary)
                                ? "metadata-details"
                                : "metadata-details technical-only"
                            }
                          >
                            <span>
                              {photo.metadata.some(isSensitiveSummary)
                                ? "Metadatos encontrados:"
                                : "Estructuras técnicas del archivo:"}
                            </span>
                            <dl>
                              {photo.metadata.map((item) => (
                                <div
                                  key={item.label}
                                  className={
                                    isSensitiveSummary(item)
                                      ? "summary-sensitive"
                                      : "summary-technical"
                                  }
                                >
                                  <dt>{item.label}</dt>
                                  <dd>{item.value}</dd>
                                </div>
                              ))}
                            </dl>
                            {photo.metadataDetails.length > 0 && (
                              <details className="all-metadata">
                                <summary>
                                  Ver todas las etiquetas ({photo.metadataDetails.length})
                                </summary>
                                <div className="metadata-toolbar">
                                  <span>
                                    Los valores se muestran localmente y se tratan como datos no confiables.
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => downloadMetadataReport(photo)}
                                  >
                                    <Download size={14} /> Descargar informe JSON
                                  </button>
                                </div>
                                <dl className="metadata-tag-list">
                                  {photo.metadataDetails.map((item, index) => (
                                    <div
                                      key={`${item.group}-${item.tag}-${index}`}
                                      className={item.sensitive ? "sensitive-tag" : undefined}
                                    >
                                      <dt>
                                        <span>{item.group}</span>
                                        {item.tag}
                                        {item.sensitive && <em>Posible dato sensible</em>}
                                      </dt>
                                      <dd>{item.value}</dd>
                                    </div>
                                  ))}
                                </dl>
                              </details>
                            )}
                          </div>
                        )}
                      </>
                    )}
                    {photo.status === "processing" && (
                      <p className="working">
                        <RefreshCw size={14} /> Limpiando y verificando…
                      </p>
                    )}
                    {photo.status === "clean" && (
                      <p className="safe">
                        <Check size={14} /> Verificada: sin metadatos sensibles
                        detectables
                      </p>
                    )}
                    {photo.status === "error" && (
                      <p className="risk">{photo.error}</p>
                    )}
                  </div>
                  {photo.status === "clean" ? (
                    <button
                      className="icon-button download-one"
                      onClick={() => download(photo)}
                      aria-label={`Descargar ${photo.file.name}`}
                    >
                      <Download size={20} />
                    </button>
                  ) : (
                    <button
                      className="icon-button"
                      onClick={() => remove(photo.id)}
                      aria-label={`Quitar ${photo.file.name}`}
                    >
                      <X size={19} />
                    </button>
                  )}
                </article>
              ))}
            </div>
            <label className="quality">
              Calidad de JPG/WebP: <strong>{quality}%</strong>
              <input
                type="range"
                min="75"
                max="100"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
              />
            </label>
            <button
              className="clean-button"
              onClick={cleanAll}
              disabled={isWorking}
            >
              {isWorking ? (
                <>
                  <RefreshCw className="spin" size={20} /> Limpiando…
                </>
              ) : (
                <>
                  <ShieldCheck size={20} /> Limpiar{" "}
                  {photos.length === 1 ? "foto" : `${photos.length} fotos`}
                </>
              )}
            </button>
            {cleanCount > 0 && (
              <div className="success-panel">
                <ShieldCheck size={25} />
                <div>
                  <strong>
                    {cleanCount === 1
                      ? "Tu foto está lista"
                      : `${cleanCount} fotos están listas`}
                  </strong>
                  <span>Se reconstruyó y verificó cada archivo.</span>
                </div>
                {cleanCount === 1 && (
                  <button
                    onClick={() =>
                      download(photos.find((p) => p.status === "clean")!)
                    }
                  >
                    <Download size={18} /> Descargar limpia
                  </button>
                )}
                {cleanCount > 1 && (
                  <button onClick={downloadAll}>
                    <Download size={18} /> Descargar ZIP
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </section>
      <section className="trust">
        <div>
          <LockKeyhole />
          <strong>Procesamiento local</strong>
          <span>Ninguna foto se sube ni se almacena.</span>
        </div>
        <div>
          <MapPinOff />
          <strong>Datos sensibles fuera</strong>
          <span>Elimina GPS, EXIF, XMP, IPTC y comentarios.</span>
        </div>
        <div>
          <ShieldCheck />
          <strong>Archivo verificado</strong>
          <span>Comprobamos el resultado antes de descargar.</span>
        </div>
      </section>
      <section className="explain">
        <span className="step">¿POR QUÉ IMPORTA?</span>
        <h2>Una foto puede decir más de lo que ves</h2>
        <p>
          Algunas imágenes guardan información invisible: dónde fueron tomadas,
          a qué hora, con qué teléfono y qué programa las editó. Limpiarla
          reduce la exposición accidental, aunque no elimina lo que aparece
          visualmente en la foto.
        </p>
        <div className="warning">
          <strong>Antes de compartir:</strong> revisa también rostros,
          matrículas, uniformes escolares, documentos, reflejos y ubicación
          visible en el fondo.
        </div>
      </section>
      <footer>
        <img src="/educa-osint-logo.png" alt="" />
        <p className="footer-copy">
          Una herramienta educativa de <strong>Educa OSINT</strong>
          <br />
          <span>Privacidad · Ciberseguridad · Investigación responsable</span>
          <small>
            Créditos: Diseñado y creado por{" "}
            <a
              href="https://www.instagram.com/josiaspool/"
              target="_blank"
              rel="noreferrer"
            >
              Josias Pool @josiaspool
            </a>
            .
          </small>
        </p>
        <div className="footer-links">
          <a href="/privacidad">Privacidad</a>
          <a href="/terminos">Términos</a>
          <a href="/creditos">Créditos</a>
        </div>
      </footer>
    </main>
  );
}
