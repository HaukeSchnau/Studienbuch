import 'package:class_companion/models/course.dart';
import 'package:class_companion/models/year.dart';
import 'package:mobx/mobx.dart';
part 'class.g.dart';

class Class = _ClassBase with _$Class;

abstract class _ClassBase with Store {
  @observable
  int id;

  @observable
  Year year;

  @observable
  String identifierInYear;

  @observable
  ObservableList<Course> courses = ObservableList<Course>();

  _ClassBase({
    required this.id,
    required this.year,
    required this.identifierInYear,
    required this.courses,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'year': year.toJson(),
      'identifierInYear': identifierInYear,
      'courses': courses.map((e) => e.toJson()).toList(),
    };
  }

  _ClassBase.fromJson(Map<String, dynamic> json)
      : this(
          id: json["id"],
          year: Year.fromJson(json["year"]),
          identifierInYear: json["identifierInYear"],
          courses: (json["courses"] as List)
              .map<Course>((e) => Course.fromJson(e))
              .toList()
              .asObservable(),
        );
}
