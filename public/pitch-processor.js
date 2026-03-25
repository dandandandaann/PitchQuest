class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.bytesRead = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channel = input[0];
      for (let i = 0; i < channel.length; i++) {
        this.buffer[this.bytesRead] = channel[i];
        this.bytesRead++;

        if (this.bytesRead >= this.bufferSize) {
          this.port.postMessage(this.buffer);
          this.bytesRead = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('pitch-processor', PitchProcessor);
