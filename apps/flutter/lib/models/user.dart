import 'package:class_companion/models/year.dart';
import 'package:mobx/mobx.dart';

part 'user.g.dart';

class User = _UserBase with _$User;

abstract class _UserBase with Store {
  @observable
  String name;

  @observable
  bool isOfAge;

  @observable
  Year year;

  _UserBase({
    required this.name,
    required this.isOfAge,
    required this.year,
  });

  @computed
  String get firstName => name.split(" ").first;

  @computed
  String get lastName => name.split(" ").last;

  @computed
  String get initials {
    final parts = name.split(" ");
    if (parts.length == 1) {
      return parts.first.substring(0, 2);
    }
    return parts.first.substring(0, 1) + parts.last.substring(0, 1);
  }

  @computed
  get shortName {
    return name.split(" ")[0].split("-")[0];
  }

  // @computed
  // List<Course> get _coursesInCurrentSemester {
  //   final currentSemester = getCurrentSemester();
  //   return _courses[currentSemester] ?? [];
  // }

  // @computed
  // Map<int, List<Course>> get coursesInAllSemesters {
  //   final map = <Semester, List<Course>>{};
  //   for (final entry in _courses.entries) {
  //     final semester = entry.key;
  //     if (map[semester] == null) {
  //       map[semester] = [];
  //     }
  //     map[semester]!.addAll(entry.value);
  //   }
  //   for (final entry in classes.entries) {
  //     final semester = entry.key;
  //     if (map[semester] == null) {
  //       map[semester] = [];
  //     }
  //     map[semester]!.addAll(entry.value.courses);
  //   }
  //   return map;
  // }

  // @computed
  // Class get currentClass {
  //   final currentSemester = getCurrentSemester();
  //   return classes[currentSemester] ?? classes.values.first;
  // }

  // @computed
  // List<Course> get courses => _coursesInCurrentSemester + currentClass.courses;

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'isOfAge': isOfAge,
      'year': year.toJson(),
    };
  }

  _UserBase.fromJson(Map<String, dynamic> json)
      : this(
          name: json["name"],
          isOfAge: json["isOfAge"],
          year: Year.fromJson(json["year"]),
        );
}
