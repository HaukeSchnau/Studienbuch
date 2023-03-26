const _years = [
  "richard",
  "frieda",
  "bernhard",
  "hermine",
  "udo",
  "lisel",
  "hans",
  "clara",
  "otto",
  "paula",
  "heinrich",
];

int nameToYear(String name) {
  var jahrgangIndex = _years
      .indexWhere((element) => element.toLowerCase() == name.toLowerCase());
  return jahrgangIndex == -1 ? -1 : jahrgangIndex + 5;
}

String yearToName(int year) {
  return _years[year - 5];
}
