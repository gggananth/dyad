function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function tfidfMatrix(docs: string[]) {
  const tokenized = docs.map(tokenize);
  const df = new Map<string, number>();
  for (const tokens of tokenized) {
    for (const token of new Set(tokens)) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }
  const vocab = [...df.keys()].sort();
  const n = docs.length;
  const matrix = tokenized.map((tokens) => {
    const tf = new Map<string, number>();
    for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
    return vocab.map((word) => {
      const term = tf.get(word) ?? 0;
      if (!term) return 0;
      const idf = Math.log((1 + n) / (1 + (df.get(word) ?? 0))) + 1;
      return (term / tokens.length) * idf;
    });
  });
  return matrix;
}

function dot(a: number[], b: number[]) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

function norm(a: number[]) {
  return Math.sqrt(dot(a, a));
}

function cosineDistance(a: number[], b: number[]) {
  const denom = norm(a) * norm(b);
  if (!denom) return 1;
  return 1 - dot(a, b) / denom;
}

function multiplyAtA(matrix: number[][]) {
  const m = matrix.length;
  const n = matrix[0]?.length ?? 0;
  const result = Array.from({ length: m }, () => Array(m).fill(0));
  for (let i = 0; i < m; i += 1) {
    for (let j = 0; j < m; j += 1) {
      let sum = 0;
      for (let k = 0; k < n; k += 1) sum += matrix[i][k] * matrix[j][k];
      result[i][j] = sum;
    }
  }
  return result;
}

function powerEigen(matrix: number[][], exclude: number[][]) {
  const m = matrix.length;
  let vector = Array.from({ length: m }, () => Math.random() + 0.01);
  for (let iter = 0; iter < 40; iter += 1) {
    const next = Array(m).fill(0);
    for (let i = 0; i < m; i += 1) {
      for (let j = 0; j < m; j += 1) next[i] += matrix[i][j] * vector[j];
    }
    for (const prior of exclude) {
      const projection = dot(next, prior);
      for (let i = 0; i < m; i += 1) next[i] -= projection * prior[i];
    }
    const length = norm(next) || 1;
    vector = next.map((value) => value / length);
  }
  return vector;
}

function projectLsa(matrix: number[][]) {
  const m = matrix.length;
  if (m === 0) return [];
  const gram = multiplyAtA(matrix);
  const k = Math.min(8, m);
  const components: number[][] = [];
  for (let i = 0; i < k; i += 1) {
    components.push(powerEigen(gram, components));
  }
  return matrix.map((_, row) => components.map((component) => component[row]));
}

export function detectEpiphany(drafts: string[]) {
  const cleaned = drafts.map((text) => text.trim()).filter(Boolean);
  if (cleaned.length < 3) {
    return { epiphany: false, distances: [] as number[], dropIndex: null as number | null };
  }

  const tfidf = tfidfMatrix(cleaned);
  const projected = projectLsa(tfidf);
  const finalVec = projected.at(-1)!;
  const distances = projected.map((vector) => cosineDistance(vector, finalVec));
  let dropIndex: number | null = null;
  let minDelta = 0;
  for (let i = 1; i < distances.length; i += 1) {
    const delta = distances[i] - distances[i - 1];
    if (delta < minDelta) {
      minDelta = delta;
      dropIndex = i;
    }
  }
  return {
    epiphany: minDelta < -0.08,
    distances,
    dropIndex,
  };
}
