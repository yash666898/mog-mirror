# Mog Mirror

A consent-first Gemma 4 demo for giving constructive feedback on visible photo presentation. It deliberately does **not** score attractiveness or decide whether someone “mogs.” Instead, it identifies practical, image-visible cues—such as lighting, framing, expression, grooming/presentation, and facial-feature visibility—and suggests a better next shot.

## Run locally

1. Install Node.js 20+.
2. In this folder, run `npm install`.
3. Copy `.env.example` to `.env` and add your Gemini API key.
4. Set `GEMMA_MODEL` to the exact Gemma 4 model ID exposed by your Gemini API account.
5. Run `npm run dev`, then open `http://localhost:3000`.

## Hackathon pitch

**Mog Mirror** turns a vague request—“How can I look stronger in photos?”—into friendly, usable visual coaching. Gemma’s multimodal input reads the submitted image and returns structured, safety-bounded advice that the interface renders as feature notes and a next-shot recommendation.

## Demo script (45 seconds)

1. “People often ask for an attractiveness score, but scores are vague and can be harmful.”
2. “Mog Mirror only accepts photos you own or have consent to use.”
3. Upload a clear selfie and show the Gemma-generated observations.
4. “Instead of declaring a winner, it gives an actionable second take: move toward a window, raise the camera slightly, and simplify the background.”
5. “The model output is schema-constrained and prompted not to infer sensitive traits or rank people.”

## Submission notes

- Gemma is used through the Gemini API in `server.js` with image input and JSON-schema output.
- No image is written to disk; the upload is held in memory for the single API request.
- Before publishing, confirm the current Gemma 4 model identifier in your Google AI project and update `.env`.
