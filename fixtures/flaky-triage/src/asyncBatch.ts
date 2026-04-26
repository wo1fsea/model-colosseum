export async function collectInCompletionOrder<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
	const results: T[] = new Array(tasks.length);
	await Promise.all(
		tasks.map(async (task, i) => {
			results[i] = await task();
		}),
	);
	return results;
}

export function delay<T>(ms: number, value: T): Promise<T> {
	return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
