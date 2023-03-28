extension ListUtil<T> on List<T> {
  T? firstWhereOrNull(bool Function(T) test) {
    for (final element in this) {
      if (test(element)) {
        return element;
      }
    }
    return null;
  }

  List<T> sublistNegative(int start, [int? end]) {
    if (start < 0) {
      start = length + start;
    }
    if (end != null && end < 0) {
      end = length + end;
    }
    return sublist(start, end);
  }

  T? get firstOrNull => isNotEmpty ? first : null;
}
