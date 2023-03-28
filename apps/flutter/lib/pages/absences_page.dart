import 'package:class_companion/database.dart';
import 'package:class_companion/hooks/use_query.dart';
import 'package:class_companion/static/colors.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class AbsencesPage extends HookWidget {
  const AbsencesPage({super.key});

  @override
  Widget build(BuildContext context) {
    final unexcusedAbsences = useQuery(() => database.select(database.absences)
      ..where((tbl) =>
          tbl.isExcusedByParent.equals(false) |
          tbl.isExcusedByTeacher.equals(false)));

    final excusedAbsences = useQuery(() => database.select(database.absences)
      ..where((tbl) =>
          tbl.isExcusedByParent.equals(true) &
          tbl.isExcusedByTeacher.equals(true)));

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
            for (final absence in unexcusedAbsences) Text(absence.reason),
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
            for (final absence in excusedAbsences) Text(absence.reason),
          ],
        ),
      )),
    );
  }
}
