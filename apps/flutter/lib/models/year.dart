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

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'startYear': startYear,
      'graduationYear': graduationYear,
      'name': name,
    };
  }

  _YearBase.fromJson(Map<String, dynamic> json)
      : this(
          id: json["id"],
          startYear: json["startYear"],
          graduationYear: json["graduationYear"],
          name: json["name"],
        );
}
