export class BetterMap<K, V> extends Map<K, V> {
  static uniqueFromValues<V extends object, VKey extends keyof V>(values: V[], key: VKey) {
    const map = new BetterMap<V[VKey], V>();

    for (const v of values) {
      map.set(v[key], v);
    }

    return map;
  }

  getWithDefault(key: K, defaultValue: V): V {
    if (!this.has(key)) {
      this.set(key, defaultValue);
    }
    // @ts-expect-error - we know it's defined above
    return super.get(key);
  }

  *map<T>(fn: (value: V, key: K, idx: number) => T): Iterable<T> {
    let idx = 0;
    for (const [key, value] of this) {
      yield fn(value, key, idx++);
    }
  }
}
