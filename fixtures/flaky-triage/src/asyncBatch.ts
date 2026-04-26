export async function collectInCompletionOrder<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
	const results = await Promise.all(tasks.map((task) => task()));
	return results;
}

export function delay<T>(ms: number, value: T): Promise<T> {
	return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
