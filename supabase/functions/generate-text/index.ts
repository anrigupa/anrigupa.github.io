// Supabase Edge Function: generate-text
// Membuat teks balapan berbahasa Indonesia dengan AI (Anthropic API).
// Secret yang dibutuhkan: ANTHROPIC_API_KEY

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const TOPICS = [
  "balap mobil", "teknologi dan internet", "alam dan hutan hujan", "laut dan pelayaran",
  "kopi dan kuliner nusantara", "olahraga dan kerja keras", "sejarah dan penjelajahan",
  "luar angkasa", "musik dan seni", "belajar dan kebiasaan baik", "kota dan transportasi",
  "pemrograman", "persahabatan", "cuaca dan musim", "buku dan membaca",
];

// Pembatasan sederhana per IP (3 detik) agar endpoint publik tidak mudah disalahgunakan.
const lastCall = new Map<string, number>();

function sanitize(raw: string): string {
  return raw
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D"]/g, "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\s+/g, " ")
    .replace(/[^A-Za-z0-9 .,!?'\-:;]/g, "")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const now = Date.now();
    if (now - (lastCall.get(ip) ?? 0) < 3000) {
      return new Response(JSON.stringify({ error: "Terlalu sering. Coba lagi sebentar." }), { status: 429, headers: corsHeaders });
    }
    lastCall.set(ip, now);

    const apiKey = Deno.env.get("COHERE_API_KEY");
    if (!apiKey) throw new Error("COHERE_API_KEY belum diatur");

    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    const prompt =
      `Tulis teks pendek berbahasa Indonesia tentang "${topic}" untuk game adu kecepatan mengetik. ` +
      `Panjang 150 sampai 220 karakter, terdiri dari 1 atau 2 kalimat yang enak dibaca. ` +
      `Gunakan hanya huruf, angka, spasi, dan tanda baca . , ! ? - ' : ; ` +
      `Tanpa baris baru, tanpa tanda kutip, tanpa judul. Balas hanya dengan teksnya. (acak: ${crypto.randomUUID().slice(0, 8)})`;

    const res = await fetch("https://api.cohere.ai/v1/generate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "command-xlarge-nightly",
        prompt,
        max_tokens: 50,
      }),
    });

    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    const text = sanitize(data?.content?.[0]?.text ?? "");

    if (text.length < 80 || text.length > 350) throw new Error("Panjang teks tidak sesuai");

    return new Response(JSON.stringify({ text }), { headers: corsHeaders });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), { status: 500, headers: corsHeaders });
  }
});
