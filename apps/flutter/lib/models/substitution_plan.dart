import 'package:class_companion/models/substitution.dart';

class SubstitutionPlan {
  DateTime date;
  List<Substitution> substitutions;

  SubstitutionPlan({required DateTime date, required this.substitutions})
      : date = date.copyWith(hour: 0, minute: 0, second: 0, millisecond: 0);

  Map<String, dynamic> toJson() {
    return {
      'date': date.toIso8601String(),
      'substitutions': substitutions.map((e) => e.toJson()).toList(),
    };
  }

  SubstitutionPlan.fromJson(Map<String, dynamic> json)
      : this(
          date: DateTime.parse(json["date"]),
          substitutions: (json["substitutions"] as List)
              .map<Substitution>((e) => Substitution.fromJson(e))
              .toList(),
        );
}
