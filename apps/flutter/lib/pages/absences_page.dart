import 'package:class_mate/components/absences/absence_view.dart';
import 'package:class_mate/database/database.dart';
import 'package:class_mate/hooks/use_query.dart';
import 'package:class_mate/models/absence.dart';
import 'package:class_mate/simple_scaffold.dart';
import 'package:class_mate/static/colors.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:tuple/tuple.dart';

class AbsencesPage extends HookWidget {
  const AbsencesPage({super.key});

  @override
  Widget build(BuildContext context) {
    final unexcusedAbsencesByTeacher = useQuery(() => db.select(db.absences)
      ..where((tbl) =>
          tbl.isExcusedByParent.equals(true) &
          tbl.isExcusedByTeacher.equals(false)));

    final unexcusedAbsencesByParent = useQuery(() => db.select(db.absences)
      ..where((tbl) => tbl.isExcusedByParent.equals(false)));

    final absenceGroupsByParent = useMemoized(() {
      final groups = <Tuple2<String, DateTime>, AbsenceGroup>{};
      if (unexcusedAbsencesByParent == null) return null;

      for (final absence in unexcusedAbsencesByParent) {
        final key = Tuple2(absence.reason, absence.date);
        if (groups.containsKey(key)) {
          groups[key]!.children.add(absence);
        } else {
          groups[key] = AbsenceGroup(
            date: absence.date,
            reason: absence.reason,
            children: [absence],
            isExcusedByParent: absence.isExcusedByParent,
            isExcusedByTeacher: absence.isExcusedByTeacher,
          );
        }
      }
      return groups.values;
    }, [unexcusedAbsencesByParent]);

    final absenceGroupsByTeacher = useMemoized(() {
      if (unexcusedAbsencesByTeacher == null) return null;
      return unexcusedAbsencesByTeacher.map(mapAbsenceToGroup);
    }, [unexcusedAbsencesByTeacher]);

    final excusedAbsences = useQuery(() => db.select(db.absences)
      ..where((tbl) =>
          tbl.isExcusedByParent.equals(true) &
          tbl.isExcusedByTeacher.equals(true)));

    if (excusedAbsences == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final absenceGroupsExcused = useMemoized(() {
      return excusedAbsences.map(mapAbsenceToGroup);
    }, [excusedAbsences]);

    return SimpleScaffold(
      scroll: true,
      appBar: AppBar(
        title: const Text("Meine Fehlzeiten"),
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32.0, vertical: 24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.warning_rounded,
                  color: theme.error,
                ),
                const SizedBox(width: 8),
                Text("unentschuldigte Fehlzeiten",
                    style: TextStyle(color: theme.error, fontSize: 16)),
              ],
            ),
            const SizedBox(height: 16),
            if (absenceGroupsByTeacher == null || absenceGroupsByParent == null)
              const Center(child: CircularProgressIndicator())
            else if (absenceGroupsByTeacher.isEmpty &&
                absenceGroupsByParent.isEmpty)
              const Align(
                alignment: Alignment.center,
                child: Text("Keine unentschuldigten Fehlzeiten gefunden",
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.black54, fontSize: 14)),
              ),
            if (absenceGroupsByTeacher != null)
              for (final absenceGroup in absenceGroupsByTeacher)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16.0),
                  child: AbsenceView(absenceGroup: absenceGroup),
                ),
            if (absenceGroupsByParent != null)
              for (final absenceGroup in absenceGroupsByParent)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16.0),
                  child: AbsenceView(absenceGroup: absenceGroup),
                ),
            const SizedBox(height: 64),
            Row(
              children: [
                Icon(
                  Icons.verified_rounded,
                  color: theme.primary,
                ),
                const SizedBox(width: 8),
                Text("entschuldigte Fehlzeiten",
                    style: TextStyle(color: theme.primary, fontSize: 16)),
              ],
            ),
            const SizedBox(height: 16),
            if (absenceGroupsExcused.isEmpty)
              const Align(
                alignment: Alignment.center,
                child: Text("Keine entschuldigten Fehlzeiten gefunden",
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.black54, fontSize: 14)),
              ),
            for (final absence in absenceGroupsExcused)
              Padding(
                padding: const EdgeInsets.only(bottom: 16.0),
                child: AbsenceView(absenceGroup: absence),
              ),
          ],
        ),
      ),
    );
  }
}
