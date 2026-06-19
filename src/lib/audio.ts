export function pcmToBase64(pcmData: Float32Array): string {
  const buffer = new ArrayBuffer(pcmData.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < pcmData.length; i++) {
    // Convert to 16-bit PCM
    const value = Math.max(-1, Math.min(1, pcmData[i]));
    view.setInt16(i * 2, value < 0 ? value * 0x8000 : value * 0x7FFF, true);
  }
  
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for(let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

let nextStartTime = 0;
export function playAudioChunk(audioCtx: AudioContext, base64Audio: string) {
  const binaryString = atob(base64Audio);
  const len = binaryString.length;
  // Decode 16-bit PCM to Float32
  const pcmLength = len / 2;
  const pcmData = new Float32Array(pcmLength);
  const view = new DataView(new ArrayBuffer(len));
  for (let i = 0; i < len; i++) {
    view.setUint8(i, binaryString.charCodeAt(i));
  }
  for (let i = 0; i < pcmLength; i++) {
    pcmData[i] = view.getInt16(i * 2, true) / 32768.0;
  }

  const audioBuffer = audioCtx.createBuffer(1, pcmData.length, 24000);
  audioBuffer.getChannelData(0).set(pcmData);

  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);

  const currentTime = audioCtx.currentTime;
  if (nextStartTime < currentTime) {
    nextStartTime = currentTime;
  }
  source.start(nextStartTime);
  nextStartTime += audioBuffer.duration;
  return source;
}

export function resetAudioPlayback() {
  nextStartTime = 0;
}
