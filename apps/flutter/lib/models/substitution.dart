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
}
