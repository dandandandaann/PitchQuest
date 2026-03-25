export class MedianFilter {
  private values: number[] = [];
  private size: number;
  
  constructor(size: number = 5) {
    this.size = size;
  }

  add(value: number): number {
    this.values.push(value);
    if (this.values.length > this.size) {
      this.values.shift();
    }
    const sorted = [...this.values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
}

export class MovingAverage {
  private values: number[] = [];
  private size: number;
  
  constructor(size: number = 3) {
    this.size = size;
  }

  add(value: number): number {
    this.values.push(value);
    if (this.values.length > this.size) {
      this.values.shift();
    }
    const sum = this.values.reduce((a, b) => a + b, 0);
    return sum / this.values.length;
  }
}
