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

typedef Semester = int;
Semester sampleSemester = 2023 << 1 | 1;

String formatSemester(Semester semester) {
  final year = semester >> 1;
  final isWinter = semester & 1 == 1;
  if (isWinter) {
    return "$year/${year + 1} Winter";
  } else {
    return "${year - 1}/$year Sommer";
  }
}

Semester getCurrentSemester() {
  final now = DateTime.now();
  int year = now.year;
  bool isWinter = now.month > 7 || now.month < 2;
  if (now.month < 2) {
    year--;
  }
  return year << 1 | (isWinter ? 1 : 0);
}
