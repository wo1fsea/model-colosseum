export function bucketByUtcDay(isoTimestamps: string[]): Record<string, number> {
	const buckets: Record<string, number> = {};
	for (const timestamp of isoTimestamps) {
		const date = new Date(timestamp);
		const key = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
		buckets[key] = (buckets[key] ?? 0) + 1;
	}
	return buckets;
}

function pad(value: number): string {
	return String(value).padStart(2, "0");
}
