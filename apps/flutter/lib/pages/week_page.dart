import 'package:class_mate/business_domain/time/weeks.dart';
import 'package:class_mate/components/schedule/schedule_grid.dart';
import 'package:class_mate/components/schedule/schedule_weekdays_view.dart';
import 'package:class_mate/hooks/use_agenda.dart';
import 'package:class_mate/static/colors.dart';
import 'package:class_mate/util/date_util.dart';
import 'package:flutter/material.dart' hide TimeOfDay;
import 'package:flutter_hooks/flutter_hooks.dart';

class WeekPage extends HookWidget {
  const WeekPage({super.key});

  @override
  Widget build(BuildContext context) {
    final defaultDate = DateTime.now(); // store.agenda.date;
    final weekDef = useState(WeekDef(defaultDate.year, defaultDate.weekNumber));

    final editMode = useState(false);

    final weekdays = getDaysInWeek(weekDef.value);
    final weeklyAgenda =
        useWeeklyAgenda(weekDef.value, ignoreWeeks: editMode.value);
    final isThisYear = weekDef.value.year == DateTime.now().year;

    final weekRow = Row(
      children: [
        IconButton(
          icon: const Icon(Icons.chevron_left_rounded),
          onPressed: () {
            if (weekDef.value.weekNumber == 1) {
              weekDef.value = WeekDef(weekDef.value.year - 1, 52);
            } else {
              weekDef.value =
                  WeekDef(weekDef.value.year, weekDef.value.weekNumber - 1);
            }
          },
          color: theme.primaryText,
          iconSize: 20,
        ),
        Text(
            isThisYear
                ? "KW ${weekDef.value.weekNumber}"
                : "KW ${weekDef.value.weekNumber} (${weekDef.value.year})",
            style:
                TextStyle(height: 1, color: theme.primaryText, fontSize: 16)),
        IconButton(
          icon: const Icon(Icons.chevron_right_rounded),
          onPressed: () {
            if (weekDef.value.weekNumber == 52) {
              weekDef.value = WeekDef(weekDef.value.year + 1, 1);
            } else {
              weekDef.value =
                  WeekDef(weekDef.value.year, weekDef.value.weekNumber + 1);
            }
          },
          color: theme.primaryText,
          iconSize: 20,
        ),
      ],
    );

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Container(
          decoration: BoxDecoration(
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                spreadRadius: 0,
                blurRadius: 16,
                offset: const Offset(0, 4), // changes position of shadow
              ),
            ],
            color: theme.primary,
          ),
          child: SafeArea(
            child: Column(
              children: [
                const SizedBox(height: 8),
                const Text("Meine Woche",
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 20)),
                const SizedBox(height: 8),
                Weekdays(days: editMode.value ? null : weekdays),
                const SizedBox(height: 12),
              ],
            ),
          )),
      if (weeklyAgenda == null)
        const Expanded(child: Center(child: CircularProgressIndicator()))
      else
        Expanded(
            child: WeekGrid(
          weeklyAgenda: weeklyAgenda,
          editMode: editMode.value,
        )),
      Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              spreadRadius: 0,
              blurRadius: 16,
              offset: const Offset(0, -4), // changes position of shadow
            ),
          ],
          color: Colors.white,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            children: [
              if (!editMode.value) weekRow,
              const Spacer(),
              TextButton(
                onPressed: () => editMode.value = !editMode.value,
                child: Text(editMode.value ? "Speichern" : "Bearbeiten",
                    style: TextStyle(
                        color: theme.primary,
                        fontWeight: FontWeight.bold,
                        fontSize: 16)),
              ),
            ],
          ),
        ),
      ),
    ]);
  }
}
