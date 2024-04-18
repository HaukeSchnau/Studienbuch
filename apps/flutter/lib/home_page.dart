import 'package:class_mate/business_domain/user/user.dart';
import 'package:class_mate/features/absences/absense_card.dart';
import 'package:class_mate/business_domain/user/use_user.dart';
import 'package:class_mate/features/agenda/agenda_view.dart';
import 'package:class_mate/features/holidays/holidays.dart';
import 'package:class_mate/features/tasks/tasks_overview.dart';
import 'package:class_mate/infrastructure/util/ui_util.dart';
import 'package:class_mate/models/agenda_store.dart';
import 'package:class_mate/presentation/components/card.dart';
import 'package:class_mate/presentation/components/path_bg_page.dart';
import 'package:class_mate/presentation/components/bottom_panels.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_mobx/flutter_mobx.dart';

class HomePage extends HookWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final user = useUser();

    final hPadding = useHorizontalPadding();

    return Observer(builder: (ctx) {
      final agenda = agendaStore.substitutedAgenda;
      final message = agenda.entries.isEmpty
          ? "Du hast ${agenda.when} keine Kurse."
          : "Das steht ${agenda.when} an:";

      final mainGreeting = Text(
        "Moin, ${user.shortName}!",
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.bold,
          fontSize: 36,
        ),
      );

      final subGreeting = Text(
        message,
        style: const TextStyle(
            color: Color.fromRGBO(255, 255, 255, .9), fontSize: 20),
      );

      final currentHoliday =
          getHoliday(agendaStore.holidays, agendaStore.agenda.date);

      final body = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 16),
          Padding(
            padding: EdgeInsets.only(left: hPadding, right: hPadding),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                mainGreeting,
                if (currentHoliday == null) subGreeting,
                const SizedBox(height: 16),
                if (currentHoliday != null)
                  MyCard(
                      padding: const EdgeInsets.all(16),
                      child: Center(
                        child: Text(
                            "Schöne ${matchHolidayName(currentHoliday.name)}! 🎉",
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.black,
                              fontSize: 18,
                            )),
                      ))
                else if (agenda.entries.isNotEmpty)
                  AgendaView(data: agenda),
                if (agenda.entries.isNotEmpty || currentHoliday != null)
                  const SizedBox(
                    height: 32,
                  ),
                const AbsenceCard(),
              ],
            ),
          ),
          const SizedBox(height: 32),
          const BottomPanels(blueChild: TasksOverview())
        ],
      );

      return PathBackgroundPage(child: body);
    });
  }
}
