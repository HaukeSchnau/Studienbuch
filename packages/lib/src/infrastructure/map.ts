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
export function compareMaps<K, V>(map1: Map<K, V>, map2: Map<K, V>): boolean {
  let testVal: V | undefined;
  if (map1.size !== map2.size) {
    return false;
  }
  for (const [key, val] of map1) {
    testVal = map2.get(key);

    // in cases of an undefined value, make sure the key
    // actually exists on the object so there are no false positives
    if (testVal !== val || (testVal === undefined && !map2.has(key))) {
      return false;
    }
  }
  return true;
}
