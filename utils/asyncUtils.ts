/**
 * Processes an array of items in batches, executing a promise-returning function for each item.
 * @param items The array of items to process.
 * @param processor A function that takes an item and its original index, and returns a promise.
 * @param batchSize The number of items to process concurrently in each batch.
 * @param onBatchStart Optional callback when a batch starts, providing batch index and total batches.
 * @returns A promise that resolves with an array of all results in their original order.
 */
export async function processInBatches<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  batchSize: number,
  onBatchStart?: (batchIndex: number, totalBatches: number) => void
): Promise<R[]> {
  let results: R[] = [];
  const totalBatches = Math.ceil(items.length / batchSize);
  for (let i = 0; i < items.length; i += batchSize) {
    const batchIndex = Math.floor(i / batchSize) + 1;
    if (onBatchStart) {
        onBatchStart(batchIndex, totalBatches);
    }
    const batchItems = items.slice(i, i + batchSize);
    // Pass the original index to the processor
    const batchPromises = batchItems.map((item, localIndex) => processor(item, i + localIndex));
    const batchResults = await Promise.all(batchPromises);
    results = results.concat(batchResults);
  }
  return results;
}