import 'package:class_companion/models/absence.dart';
import 'package:class_companion/models/agenda.dart';
import 'package:class_companion/models/class.dart';
import 'package:class_companion/models/course.dart';
import 'package:class_companion/static/years.dart';
import 'package:class_companion/util/date_util.dart';
import 'package:mobx/mobx.dart';

part 'user.g.dart';

class User = _UserBase with _$User;

abstract class _UserBase with Store {
  @observable
  String name;

  @observable
  ObservableMap<Semester, List<Course>> _courses;

  @observable
  ObservableMap<Semester, Class> classes;

  @observable
  ObservableList<Absence> absences;

  @observable
  bool isOfAge;

  _UserBase({
    required this.name,
    required Map<Semester, List<Course>> courses,
    required Map<Semester, Class> classes,
    required this.absences,
    required this.isOfAge,
  })  : assert(classes.isNotEmpty),
        _courses = courses.asObservable(),
        classes = classes.asObservable();

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

  @computed
  ObservableList<Absence> get unexcusedAbsences =>
      absences.where((element) => !element.isExcused).toList().asObservable();

  @computed
  ObservableMap<DateTime, List<Absence>> get unexcusedAbsencesByDay {
    final map = <DateTime, List<Absence>>{};
    for (final absence in unexcusedAbsences) {
      if (map[absence.date] == null) {
        map[absence.date] = [];
      }
      map[absence.date]!.add(absence);
    }
    return map.asObservable();
  }

  @computed
  Agenda get agenda => Agenda(start: DateTime.now(), courses: courses);

  Agenda getAgendaForDay(DateTime day) =>
      Agenda(start: day, courses: courses, autoAdjust: false);

  @computed
  List<Agenda> get weeklyAgenda {
    final now = DateTime.now();
    final start = now.startOfWeek;

    final days = <DateTime>[];
    for (var i = 0; i < 5; i++) {
      days.add(start.add(Duration(days: i)));
    }

    return days
        .map((e) => Agenda(start: e, courses: courses, autoAdjust: false))
        .toList();
  }

  @computed
  List<Course> get _coursesInCurrentSemester {
    final currentSemester = getCurrentSemester();
    return _courses[currentSemester] ?? [];
  }

  @computed
  Map<int, List<Course>> get coursesInAllSemesters {
    final map = <Semester, List<Course>>{};
    for (final entry in _courses.entries) {
      final semester = entry.key;
      if (map[semester] == null) {
        map[semester] = [];
      }
      map[semester]!.addAll(entry.value);
    }
    for (final entry in classes.entries) {
      final semester = entry.key;
      if (map[semester] == null) {
        map[semester] = [];
      }
      map[semester]!.addAll(entry.value.courses);
    }
    return map;
  }

  @computed
  Class get currentClass {
    final currentSemester = getCurrentSemester();
    return classes[currentSemester] ?? classes.values.first;
  }

  @computed
  List<Course> get courses => _coursesInCurrentSemester + currentClass.courses;

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'currentClass': currentClass.toJson(),
      'courses': _courses.map((key, value) =>
          MapEntry(key.toString(), value.map((e) => e.toJson()).toList())),
      'classes':
          classes.map((key, value) => MapEntry(key.toString(), value.toJson())),
      'absences': absences.map((e) => e.toJson()).toList(),
      'isOfAge': isOfAge,
    };
  }

  _UserBase.fromJson(Map<String, dynamic> json)
      : this(
          name: json["name"],
          courses: (json["courses"] as Map<String, dynamic>)
              .map<Semester, List<Course>>((key, value) {
            final semester = int.parse(key);
            final courses =
                (value as List).map<Course>((e) => Course.fromJson(e)).toList();
            return MapEntry(semester, courses);
          }),
          classes: (json["classes"] as Map<String, dynamic>)
              .map<Semester, Class>((key, value) {
            final semester = int.parse(key);
            final class_ = Class.fromJson(value);
            return MapEntry(semester, class_);
          }),
          absences: (json["absences"] as List)
              .map<Absence>((e) => Absence.fromJson(e))
              .toList()
              .asObservable(),
          isOfAge: json["isOfAge"],
        );
}
