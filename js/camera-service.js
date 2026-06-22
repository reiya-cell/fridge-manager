(function exposeCameraService(global) {
  let barcodeStream = null;
  let expiryStream = null;
  let barcodeTimer = null;
  let barcodeControls = null;

  function stopTracks(stream) {
    stream?.getTracks().forEach(track => track.stop());
  }

  function stopBarcode(video) {
    clearInterval(barcodeTimer);
    barcodeTimer = null;
    barcodeControls?.stop?.();
    barcodeControls = null;
    stopTracks(barcodeStream);
    barcodeStream = null;
    if (video) video.srcObject = null;
  }

  async function startBarcode(video, onDetected, loadFallbackReader) {
    if ('BarcodeDetector' in global) {
      barcodeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      video.srcObject = barcodeStream;
      await video.play();
      const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      barcodeTimer = setInterval(async () => {
        if (video.readyState < 2) return;
        try {
          const codes = await detector.detect(video);
          if (codes[0]) {
            clearInterval(barcodeTimer);
            barcodeTimer = null;
            await onDetected(codes[0].rawValue);
          }
        } catch {}
      }, 450);
      return;
    }

    const ZXingBrowser = await loadFallbackReader();
    const reader = new ZXingBrowser.BrowserMultiFormatReader();
    barcodeControls = await reader.decodeFromVideoDevice(undefined, video, result => {
      if (!result) return;
      barcodeControls?.stop();
      onDetected(result.getText());
    });
  }

  function stopExpiry(video) {
    stopTracks(expiryStream);
    expiryStream = null;
    if (video) video.srcObject = null;
  }

  async function startExpiry(video) {
    stopExpiry(video);
    expiryStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    video.srcObject = expiryStream;
    await video.play();
  }

  function isExpiryActive() {
    return Boolean(expiryStream);
  }

  function captureFrame(video, canvas) {
    if (!video.videoWidth) return Promise.resolve(null);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  }

  global.FridgeCamera = { stopBarcode, startBarcode, stopExpiry, startExpiry, isExpiryActive, captureFrame };
})(globalThis);
