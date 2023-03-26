import 'package:class_companion/models/substitution.dart';

class SubstitutionPlan {
  DateTime date;
  List<Substitution> substitutions;

  SubstitutionPlan({required DateTime date, required this.substitutions})
      : date = date.copyWith(hour: 0, minute: 0, second: 0, millisecond: 0);
}
