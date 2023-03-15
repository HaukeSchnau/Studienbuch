extension StringExt on String {
  String capitalizeFirstLetter() {
    if (length < 2) return toUpperCase();

    return "${this[0].toUpperCase()}${substring(1)}";
  }

  String capitalize() {
    return split(" ")
        .map((e) => e.capitalizeFirstLetter())
        .join(" ")
        .split("-")
        .map((e) => e.capitalizeFirstLetter())
        .join("-");
  }

  String limit(int length) {
    if (length < 0) return this;

    if (length >= this.length) return this;

    return substring(0, length);
  }
}

String punktePluralSingular(num count) {
  if (count.abs() == 1) return "Punkt";

  return "Punkte";
}
