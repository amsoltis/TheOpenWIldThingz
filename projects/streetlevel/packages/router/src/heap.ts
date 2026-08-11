/**
 * Binary min-heap.
 *
 * The graph is ~475 stations but the search space is (station × line), and the
 * server compiles two legs per packet under a latency budget — enough that a
 * linear scan for the next node is worth avoiding.
 */
export class MinHeap<T> {
  private heap: { value: T; priority: number }[] = [];

  get size(): number {
    return this.heap.length;
  }

  push(value: T, priority: number): void {
    this.heap.push({ value, priority });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): { value: T; priority: number } | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0]!;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(start: number): void {
    let i = start;
    const node = this.heap[i]!;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent]!.priority <= node.priority) break;
      this.heap[i] = this.heap[parent]!;
      i = parent;
    }
    this.heap[i] = node;
  }

  private sinkDown(start: number): void {
    let i = start;
    const length = this.heap.length;
    const node = this.heap[i]!;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      let smallestPriority = node.priority;

      if (left < length && this.heap[left]!.priority < smallestPriority) {
        smallest = left;
        smallestPriority = this.heap[left]!.priority;
      }
      if (right < length && this.heap[right]!.priority < smallestPriority) {
        smallest = right;
        smallestPriority = this.heap[right]!.priority;
      }
      if (smallest === i) break;
      this.heap[i] = this.heap[smallest]!;
      i = smallest;
    }
    this.heap[i] = node;
  }
}
