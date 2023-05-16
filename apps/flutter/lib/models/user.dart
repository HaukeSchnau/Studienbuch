import 'package:class_mate/models/year.dart';
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

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'isOfAge': isOfAge,
      'year': year.toJson(),
    };
  }

  // ignore: unused_element
  _UserBase.fromJson(Map<String, dynamic> json)
      : this(
          name: json["name"],
          isOfAge: json["isOfAge"],
          year: Year.fromJson(json["year"]),
        );
}
