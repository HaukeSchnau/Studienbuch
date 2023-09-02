import 'package:class_mate/database.dart';
import 'package:class_mate/models/semester.dart';
import 'package:drift/drift.dart';
import 'package:mobx/mobx.dart';

part 'year.g.dart';

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

@Deprecated("Use SQLite instead")
class YearStore = _YearBase with _$YearStore;

abstract class _YearBase with Store {
  @observable
  int id;

  @observable
  int startYear;

  @observable
  int graduationYear;

  @observable
  String name;

  _YearBase({
    required this.id,
    required this.startYear,
    required this.graduationYear,
    required this.name,
  });

  // ignore: unused_element
  _YearBase.fromJson(Map<String, dynamic> json)
      : this(
          id: json["id"],
          startYear: json["startYear"],
          graduationYear: json["graduationYear"],
          name: json["name"],
        );
}
