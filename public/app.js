const $ = (s) => document.querySelector(s);
const image = $("#image"), preview = $("#preview"), form = $("#form"), submit = $("#submit");
const cameraDialog = $("#cameraDialog"), cameraFeed = $("#cameraFeed"), snapshot = $("#snapshot"), cameraError = $("#cameraError");
let stream, scanTimer, faceDetector, mirrored = false;
function setPreview(file) { if (file) { preview.src = URL.createObjectURL(file); preview.classList.add("show"); $("#dropzone").classList.add("selected"); } }
image.addEventListener("change", () => setPreview(image.files[0]));
$("#camera").addEventListener("click", async () => {
  cameraError.hidden = true; snapshot.hidden = true; cameraFeed.hidden = false; $("#capture").hidden = false; $("#retake").hidden = true; $("#usePhoto").hidden = true;
  cameraDialog.showModal();
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false }); cameraFeed.srcObject = stream; cameraFeed.onloadeddata = startLiveScan; }
  catch { cameraError.textContent = "Camera access was blocked or unavailable. Allow camera permission, then try again."; cameraError.hidden = false; }
});
function stopCamera() { clearInterval(scanTimer); stream?.getTracks().forEach(track => track.stop()); stream = undefined; cameraFeed.srcObject = null; }
async function startLiveScan() {
  try { faceDetector = "FaceDetector" in window ? new FaceDetector({ fastMode: true, maxDetectedFaces: 1 }) : null; } catch { faceDetector = null; }
  $("#liveStatus").textContent = faceDetector ? "Live face-presence check" : "Live framing check";
  clearInterval(scanTimer); scanTimer = setInterval(scanFrame, 450); scanFrame();
}
async function scanFrame() {
  if (!cameraFeed.videoWidth || cameraFeed.hidden) return;
  const w = 160, h = Math.round(w * cameraFeed.videoHeight / cameraFeed.videoWidth), canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h; const ctx = canvas.getContext("2d", { willReadFrequently: true }); ctx.drawImage(cameraFeed, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data; let sum = 0; for (let i = 0; i < px.length; i += 4) sum += .2126 * px[i] + .7152 * px[i + 1] + .0722 * px[i + 2];
  const brightness = sum / (px.length / 4); let framing = 45, detail = 45, tip = "Move into the face guide for a stronger capture.";
  if (faceDetector) try { const faces = await faceDetector.detect(cameraFeed); if (faces[0]) { const b = faces[0].boundingBox, area = b.width * b.height / (cameraFeed.videoWidth * cameraFeed.videoHeight), cx = (b.x + b.width / 2) / cameraFeed.videoWidth, cy = (b.y + b.height / 2) / cameraFeed.videoHeight; framing = Math.max(0, 100 - Math.abs(cx - .5) * 220 - Math.abs(cy - .46) * 180); detail = Math.max(10, 100 - Math.abs(area - .20) * 330); tip = area < .11 ? "Move closer: facial detail is too small." : area > .40 ? "Move back slightly: give the face more space." : framing < 70 ? "Center your face in the guide." : brightness < 65 ? "Brighten the front of your face; detail is being lost." : "Good capture position—hold still and take the photo."; } else { tip = "Face not found—look toward the camera."; } } catch {}
  const light = Math.max(10, 100 - Math.abs(brightness - 135) * .9), score = Math.round((framing * .42 + light * .28 + detail * .30) / 10);
  $("#liveScore").firstChild.nodeValue = String(Math.max(1, Math.min(10, score))); $("#liveTip").textContent = tip;
  [["framing", framing], ["light", light], ["detail", detail]].forEach(([key, value]) => document.querySelector(`[data-bar="${key}"]`).style.setProperty("--fill", `${Math.round(value)}%`));
}
$("#closeCamera").addEventListener("click", () => { stopCamera(); cameraDialog.close(); });
cameraDialog.addEventListener("close", stopCamera);
$("#mirror").addEventListener("click", () => { mirrored = !mirrored; cameraFeed.classList.toggle("mirrored", mirrored); $("#mirror").textContent = `Mirror view: ${mirrored ? "on" : "off"}`; });
$("#capture").addEventListener("click", () => {
  snapshot.width = cameraFeed.videoWidth; snapshot.height = cameraFeed.videoHeight;
  const context = snapshot.getContext("2d"); if (mirrored) { context.translate(snapshot.width, 0); context.scale(-1, 1); } context.drawImage(cameraFeed, 0, 0); cameraFeed.hidden = true; snapshot.hidden = false;
  $("#capture").hidden = true; $("#retake").hidden = false; $("#usePhoto").hidden = false;
});
$("#retake").addEventListener("click", () => { cameraFeed.hidden = false; snapshot.hidden = true; $("#capture").hidden = false; $("#retake").hidden = true; $("#usePhoto").hidden = true; });
$("#usePhoto").addEventListener("click", () => snapshot.toBlob(blob => {
  const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" }); const files = new DataTransfer(); files.items.add(file); image.files = files.files;
  setPreview(file); stopCamera(); cameraDialog.close();
}, "image/jpeg", .92));
form.addEventListener("submit", async (event) => {
  event.preventDefault(); $("#empty").classList.add("hidden"); $("#result").classList.add("hidden"); $("#loading").classList.remove("hidden"); submit.disabled = true;
  try {
    const res = await fetch("/api/analyze", { method: "POST", body: new FormData(form) });
    const data = await res.json(); if (!res.ok) throw new Error(data.error);
    const cards = (items) => (items || []).map(f => `<article><h3>${esc(f.label)}</h3><p>${esc(f.observation)}</p><b>Try:</b> ${esc(f.suggestion)}</article>`).join("");
    const limitation = cards(data.features);
    $("#result").innerHTML = `<p class="eyebrow">YOUR FACIAL READ</p><h2>${esc(data.headline)}</h2><p class="status">Visibility: ${esc(data.visibility)}</p><div class="readiness"><span>${esc(data.cameraReadiness)}/10</span><div><b>On-camera readiness</b><p>${esc(data.cameraReadinessReason)}</p></div></div><h3 class="section-title">Visible facial proportions</h3><div class="notes">${cards(data.facialProportions)}</div>${limitation ? `<h3 class="section-title">Photo limitation</h3><div class="notes">${limitation}</div>` : ""}<div class="next"><b>Next shot</b><p>${esc(data.nextShot)}</p></div><p class="fine">${esc(data.boundaries)}</p>`;
    $("#result").classList.remove("hidden");
  } catch (e) { $("#result").innerHTML = `<h2>Almost there.</h2><p>${esc(e.message)}</p>`; $("#result").classList.remove("hidden"); }
  finally { $("#loading").classList.add("hidden"); submit.disabled = false; }
});
function esc(v) { const d = document.createElement("div"); d.textContent = v ?? ""; return d.innerHTML; }
