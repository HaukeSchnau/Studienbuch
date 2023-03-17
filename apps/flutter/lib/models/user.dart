import 'package:class_companion/models/absence.dart';
import 'package:class_companion/models/agenda.dart';
import 'package:class_companion/models/class.dart';
import 'package:class_companion/models/course.dart';
import 'package:class_companion/util/date_util.dart';
import 'package:mobx/mobx.dart';

part 'user.g.dart';

class User = _UserBase with _$User;

abstract class _UserBase with Store {
  @observable
  String name;

  @observable
  ObservableList<Course> _courses;

  @observable
  Class currentClass;

  @observable
  ObservableList<Absence> absences;

  @observable
  bool isOfAge;

  _UserBase({
    required this.name,
    required this.currentClass,
    required ObservableList<Course> courses,
    required this.absences,
    required this.isOfAge,
  }) : _courses = courses;

  @computed
  String get firstName => name.split(" ").first;

  @computed
  String get lastName => name.split(" ").last;

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
  List<Course> get courses => _courses + currentClass.courses;

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'currentClass': currentClass.toJson(),
      'courses': _courses.map((e) => e.toJson()).toList(),
      'absences': absences.map((e) => e.toJson()).toList(),
      'isOfAge': isOfAge,
    };
  }

  _UserBase.fromJson(Map<String, dynamic> json)
      : this(
          name: json["name"],
          currentClass: Class.fromJson(json["currentClass"]),
          courses: (json["courses"] as List)
              .map<Course>((e) => Course.fromJson(e))
              .toList()
              .asObservable(),
          absences: (json["absences"] as List)
              .map<Absence>((e) => Absence.fromJson(e))
              .toList()
              .asObservable(),
          isOfAge: json["isOfAge"],
        );
}
