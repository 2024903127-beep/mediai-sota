declare module 'fast-levenshtein' {
  const levenshtein: {
    get(a: string, b: string, opts?: { useCollator?: boolean }): number;
  };
  export = levenshtein;
}
