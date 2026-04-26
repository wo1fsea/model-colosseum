export async function collectInCompletionOrder<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
	return Promise.all(tasks.map((task) => task()));
}

export function delay<T>(ms: number, value: T): Promise<T> {
	return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
