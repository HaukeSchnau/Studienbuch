import 'package:class_mate/database.dart';
import 'package:class_mate/models/semester.dart';
import 'package:mobx/mobx.dart';

part 'year.g.dart';

class Year = _YearBase with _$Year;

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

  @computed
  int get currentYearNum {
    final currentSemester = Semester(id: getCurrentSemesterId());
    var currentYear = currentSemester.year - startYear + 5;
    if (!currentSemester.isWinter) currentYear--;
    return currentYear;
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'startYear': startYear,
      'graduationYear': graduationYear,
      'name': name,
    };
  }

  // ignore: unused_element
  _YearBase.fromJson(Map<String, dynamic> json)
      : this(
          id: json["id"],
          startYear: json["startYear"],
          graduationYear: json["graduationYear"],
          name: json["name"],
        );
}
