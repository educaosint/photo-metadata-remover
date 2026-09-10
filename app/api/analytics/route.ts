const ALLOWED_EVENTS = new Set(["visit", "clean_photo", "download_zip", "install_pwa"]);

export async function POST(request: Request) {
  try {
    const { event } = (await request.json()) as { event?: string };
    if (!event || !ALLOWED_EVENTS.has(event)) return new Response(null, { status: 204 });
    const endpoint = process.env.ANALYTICS_ENDPOINT;
    if (endpoint) {
      await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ day: new Date().toISOString().slice(0, 10), event }),
      });
    }
  } catch {
    // Analytics must never interrupt local photo processing.
  }
  return new Response(null, { status: 204 });
}
