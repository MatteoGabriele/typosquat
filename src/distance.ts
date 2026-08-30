// Edit-distance primitives used to score login similarity.

/**
 * Optimal String Alignment distance (Damerau-Levenshtein restricted to
 * non-overlapping adjacent transpositions). Adjacent transposition costs 1,
 * which is what makes "dependabot" -> "dependbaot" register as a single typo.
 *
 * `max` short-circuits: returns max + 1 as soon as the bound is exceeded.
 */
export function osaDistance(
	a: string,
	b: string,
	max = Number.POSITIVE_INFINITY,
): number {
	if (a === b) return 0;
	const al = a.length;
	const bl = b.length;
	if (Math.abs(al - bl) > max) return max + 1;
	if (al === 0) return bl;
	if (bl === 0) return al;

	let prev2: number[] = new Array(bl + 1).fill(0);
	let prev: number[] = new Array(bl + 1).fill(0);
	let cur: number[] = new Array(bl + 1).fill(0);
	for (let j = 0; j <= bl; j++) prev[j] = j;

	for (let i = 1; i <= al; i++) {
		cur[0] = i;
		let rowMin = i;
		for (let j = 1; j <= bl; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			let v = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
			if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
				v = Math.min(v, prev2[j - 2] + 1);
			}
			cur[j] = v;
			if (v < rowMin) rowMin = v;
		}
		if (rowMin > max) return max + 1;
		const spare = prev2;
		prev2 = prev;
		prev = cur;
		cur = spare;
	}
	return prev[bl];
}

/**
 * True when the two strings differ only by two characters trading places,
 * adjacent or not: "dependabot" against "depenbadot". Distance alone reads
 * that as two edits, but it is one deliberate act.
 */
export function isSwap(a: string, b: string): boolean {
	if (a.length !== b.length || a === b) return false;
	const diffs: number[] = [];
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i] && diffs.push(i) > 2) return false;
	}
	if (diffs.length !== 2) return false;
	const [i, j] = diffs;
	return a[i] === b[j] && a[j] === b[i];
}
