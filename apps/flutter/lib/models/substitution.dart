import 'package:class_companion/models/agenda_entry.dart';

enum SubstitutionType {
  cancelled,
  replaced,
}

class Substitution {
  SubstitutionType type;
  AgendaEntry agendaEntry;

  Substitution({
    required this.type,
    required this.agendaEntry,
  });

  Map<String, dynamic> toJson() {
    return {
      'type': type.toString(),
      'agendaEntry': agendaEntry.toJson(),
    };
  }

  Substitution.fromJson(Map<String, dynamic> json)
      : this(
          type: SubstitutionType.values.firstWhere(
            (e) => e.toString() == json["type"],
          ),
          agendaEntry: AgendaEntry.fromJson(json["agendaEntry"]),
        );
}
