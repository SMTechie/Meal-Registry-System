(function () {
  const video = document.getElementById("camera");
  const canvas = document.getElementById("scanCanvas");
  const result = document.getElementById("scanResult");
  const startButton = document.getElementById("startScan");
  const stopButton = document.getElementById("stopScan");
  const manualForm = document.getElementById("manualScan");
  const manualCode = document.getElementById("manualCode");
  const scanList = document.getElementById("scanList");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  let stream = null;
  let detector = null;
  let scanTimer = null;
  let lastCode = "";
  let lastSentAt = 0;

  function csrfToken() {
    return document.querySelector("[name=csrfmiddlewaretoken]").value;
  }

  function setResult(title, body, status) {
    result.className = `scan-result ${status || ""}`;
    result.querySelector("h2").textContent = title;
    result.querySelector("p").textContent = body;
  }

  function addScannedUser(payload) {
    if (payload.status !== "ACCEPTED" || !payload.user || !scanList) return;
    const empty = scanList.querySelector(".empty-state");
    if (empty) empty.remove();
    const row = document.createElement("div");
    row.className = "scan-person just-scanned";
    row.innerHTML = `<strong></strong><span></span>`;
    row.querySelector("strong").textContent = payload.user;
    row.querySelector("span").textContent = `${payload.category || "Meal"} at ${payload.scanned_at.slice(11, 16)}`;
    scanList.prepend(row);
  }

  async function sendScan(code) {
    const now = Date.now();
    if (!code || (code === lastCode && now - lastSentAt < 5000)) return;
    lastCode = code;
    lastSentAt = now;
    const data = new FormData();
    data.append("code", code);
    const response = await fetch("/scan/claim/", {
      method: "POST",
      body: data,
      headers: { "X-CSRFToken": csrfToken() },
    });
    if (response.redirected) {
      window.location = response.url;
      return;
    }
    const payload = await response.json();
    const heading = payload.status === "ACCEPTED" ? "Accepted" : "Denied";
    setResult(heading, `${payload.reason} ${payload.user || ""}`, payload.status.toLowerCase());
    addScannedUser(payload);
  }

  function decodeWithCanvas() {
    if (!video.videoWidth || !video.videoHeight || typeof jsQR !== "function") return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
    return code ? code.data : null;
  }

  async function tick() {
    if (!stream) return;
    try {
      let code = null;
      if (detector) {
        const codes = await detector.detect(video);
        if (codes.length) code = codes[0].rawValue;
      }
      code = code || decodeWithCanvas();
      if (code) await sendScan(code);
    } catch (error) {
      console.error(error);
    }
    scanTimer = window.setTimeout(tick, 300);
  }

  startButton.addEventListener("click", async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setResult("Camera unavailable", "This browser does not expose camera access. Use manual entry.", "denied");
        return;
      }
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();
      setResult("Camera active", "Point the camera at a meal ticket QR code.", "");

      if ("BarcodeDetector" in window) {
        try {
          detector = new BarcodeDetector({ formats: ["qr_code"] });
        } catch (error) {
          detector = null;
        }
      }
      tick();
    } catch (error) {
      setResult("Camera blocked", "Camera access was not opened. Check browser permissions or use manual entry.", "denied");
    }
  });

  stopButton.addEventListener("click", () => {
    if (scanTimer) window.clearTimeout(scanTimer);
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null;
    detector = null;
    video.srcObject = null;
    setResult("Stopped", "Scanner is idle.", "");
  });

  manualForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await sendScan(manualCode.value.trim());
    manualCode.value = "";
  });
})();
