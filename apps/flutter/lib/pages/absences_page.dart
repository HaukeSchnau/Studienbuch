import 'package:class_companion/components/absences/absence_view.dart';
import 'package:class_companion/database.dart';
import 'package:class_companion/hooks/use_query.dart';
import 'package:class_companion/models/absence.dart';
import 'package:class_companion/static/colors.dart';
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
      return unexcusedAbsencesByTeacher.map(mapAbsenceToGroup);
    }, [unexcusedAbsencesByTeacher]);

    final excusedAbsences = useQuery(() => db.select(db.absences)
      ..where((tbl) =>
          tbl.isExcusedByParent.equals(true) &
          tbl.isExcusedByTeacher.equals(true)));

    final absenceGroupsExcused = useMemoized(() {
      return excusedAbsences.map(mapAbsenceToGroup);
    }, [excusedAbsences]);

    return Scaffold(
      appBar: AppBar(
        title: const Text("Meine Fehlzeiten"),
      ),
      body: SingleChildScrollView(
          child: Padding(
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
            for (final absenceGroup in absenceGroupsByTeacher)
              Padding(
                padding: const EdgeInsets.only(bottom: 16.0),
                child: AbsenceView(absenceGroup: absenceGroup),
              ),
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
            for (final absence in absenceGroupsExcused)
              Padding(
                padding: const EdgeInsets.only(bottom: 16.0),
                child: AbsenceView(absenceGroup: absence),
              ),
          ],
        ),
      )),
    );
  }
}
