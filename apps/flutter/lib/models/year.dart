import 'package:class_mate/database/database.dart';
import 'package:class_mate/models/semester.dart';
import 'package:drift/drift.dart';

class Years extends Table {
  IntColumn get id => integer().autoIncrement()();

  IntColumn get startYear => integer()();

  IntColumn get graduationYear => integer()();

  TextColumn get name => text()();
}

extension YearExt on Year {
  int get currentYearNum {
    final currentSemester = Semester(id: getCurrentSemesterId());
    var currentYear = currentSemester.year - startYear + 5;
    if (!currentSemester.isWinter) currentYear--;
    return currentYear;
  }
}
