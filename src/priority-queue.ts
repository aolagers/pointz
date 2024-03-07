export class PriorityQueue<T> {
    private heap: T[];
    private comparator: (a: T, b: T) => number;

    constructor(comparator: (a: T, b: T) => number = (a: T, b: T) => (a > b ? 1 : -1)) {
        this.heap = [];
        this.comparator = comparator;
    }

    private getLeftChildIndex(parentIndex: number): number {
        return 2 * parentIndex + 1;
    }

    private getRightChildIndex(parentIndex: number): number {
        return 2 * parentIndex + 2;
    }

    private getParentIndex(childIndex: number): number {
        return Math.floor((childIndex - 1) / 2);
    }

    private swap(i: number, j: number): void {
        [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
    }

    private heapifyUp(): void {
        let index = this.heap.length - 1;
        while (
            this.getParentIndex(index) >= 0 &&
            this.comparator(this.heap[index], this.heap[this.getParentIndex(index)]) < 0
        ) {
            this.swap(index, this.getParentIndex(index));
            index = this.getParentIndex(index);
        }
    }

    private heapifyDown(): void {
        let index = 0;
        while (this.getLeftChildIndex(index) < this.heap.length) {
            let smallerChildIndex = this.getLeftChildIndex(index);
            if (
                this.getRightChildIndex(index) < this.heap.length &&
                this.comparator(this.heap[this.getRightChildIndex(index)], this.heap[smallerChildIndex]) < 0
            ) {
                smallerChildIndex = this.getRightChildIndex(index);
            }

            if (this.comparator(this.heap[index], this.heap[smallerChildIndex]) < 0) {
                break;
            } else {
                this.swap(index, smallerChildIndex);
            }

            index = smallerChildIndex;
        }
    }

    public isEmpty(): boolean {
        return this.heap.length === 0;
    }

    public peek(): T | null {
        if (this.isEmpty()) return null;
        return this.heap[0];
    }

    public push(element: T): void {
        this.heap.push(element);
        this.heapifyUp();
    }

    public pop(): T | null {
        if (this.isEmpty()) return null;
        if (this.heap.length === 1) return this.heap.pop()!;
        const item = this.heap[0];
        this.heap[0] = this.heap.pop()!;
        this.heapifyDown();
        return item;
    }
}
