import "dotenv/config";
import express from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(projectDirectory, "public");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, done) => done(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype))
});

app.use(express.static(publicDirectory));
app.get("/", (_req, res) => res.sendFile(path.join(publicDirectory, "index.html")));

const responseSchema = {
  type: "object",
  properties: {
    headline: { type: "string" },
    visibility: { type: "string", enum: ["clear", "limited"] },
    photoNotes: { type: "array", items: { type: "string" } },
    cameraReadiness: { type: "integer", minimum: 1, maximum: 10 },
    cameraReadinessReason: { type: "string" },
    facialProportions: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, observation: { type: "string" }, suggestion: { type: "string" } },
        required: ["label", "observation", "suggestion"]
      }
    },
    features: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          observation: { type: "string" },
          suggestion: { type: "string" }
        },
        required: ["label", "observation", "suggestion"]
      }
    },
    nextShot: { type: "string" },
    boundaries: { type: "string" }
  },
  required: ["headline", "visibility", "photoNotes", "cameraReadiness", "cameraReadinessReason", "facialProportions", "features", "nextShot", "boundaries"]
};

app.post("/api/analyze", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Upload a JPG, PNG, or WebP image." });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: "Missing GEMINI_API_KEY. Add it to .env first." });

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `You are Mog Mirror, a direct, consent-first facial-structure coach. The image is submitted by its owner or a person who has permission to use it. Focus 85% of the response on visible facial structure—not image quality. Be blunt and precise, not insulting: state what the face visibly presents, what is less defined, and the strongest realistic presentation improvement. If one human face is visible, facialProportions MUST contain exactly 4 detailed cards with these labels: “Face outline & width/length”, “Left-right balance”, “Vertical facial balance”, and “Jaw, cheek & chin visibility”. Each card must discuss a concrete apparent facial relationship: e.g. relative upper/mid/lower-face balance, outline taper versus fullness, apparent width-to-length, visible cheek projection, jawline definition, chin projection, eye/brow framing, or nose-to-face scale. Explain how camera angle, lens distance, light, hair, or expression changes that specific facial read only where relevant. Never return an empty facialProportions array when a face is present. features may contain AT MOST ONE brief card titled “Photo limitation”, and only if a photo condition materially prevents a facial observation; do not give generic lighting, angle, or expression tips there. These are image observations, not precise measurements. Do not infer identity, ethnicity, age, gender identity, health, personality, intelligence, dating desirability, or a person's value. Do not rank attractiveness, claim objective beauty, compare the person to other people, mock them, or invent flaws. Set cameraReadiness to 1–10 ONLY for how well this specific photo shows the person's presentation (lighting, framing, focus, angle, and feature visibility), not for their attractiveness. Explain it briefly in cameraReadinessReason. Treat “mog” as playful slang for photo presence; never say someone does or does not mog. Keep the tone concise and direct. Return JSON matching the supplied schema.`;
    const result = await ai.models.generateContent({
      model: process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it",
      contents: [{ role: "user", parts: [
        { text: prompt },
        { inlineData: { mimeType: req.file.mimetype, data: req.file.buffer.toString("base64") } }
      ] }],
      config: { responseMimeType: "application/json", responseSchema, temperature: 0.55 }
    });
    res.json(JSON.parse(result.text));
  } catch (error) {
    console.error(error);
    const detail = error?.message ? String(error.message).replace(/AIza[\w-]+/g, "[redacted]") : "Unknown API error";
    res.status(500).json({ error: `Analysis failed: ${detail}` });
  }
});

export default app;

// Vercel imports the Express app as a serverless function. Locally, Node starts it.
if (!process.env.VERCEL) {
  app.listen(process.env.PORT || 3000, () => console.log("Mog Mirror running at http://localhost:" + (process.env.PORT || 3000)));
}
