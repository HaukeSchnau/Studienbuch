import 'package:class_companion/components/bottom_sheet_container.dart';
import 'package:class_companion/components/register_absence_form.dart';
import 'package:class_companion/components/util/card.dart';
import 'package:class_companion/hooks/use_store.dart';
import 'package:class_companion/util/date_util.dart';
import 'package:class_companion/util/list_util.dart';
import 'package:flutter/material.dart';
import 'package:flutter_mobx/flutter_mobx.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class AbsenceView extends HookWidget {
  const AbsenceView({super.key});

  @override
  Widget build(BuildContext context) {
    final store = useStore();

    final copyWidget = Observer(
      builder: (_) {
        final absences = store.currentUser.absences;
        final unexcusedAbsences = store.currentUser.unexcusedAbsences;
        if (absences.isEmpty) {
          return const Text(
              "Hier kannst du deine Fehlzeiten eintragen. Diese werden dann in deinem Stundenplan angezeigt.",
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Color.fromRGBO(0, 0, 0, .6)));
        } else if (absences.every((element) => element.isExcused)) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Text("Super! All deine Fehlzeiten sind entschuldigt!",
                  style: TextStyle(
                      fontSize: 16, color: Color.fromRGBO(0, 0, 0, .8))),
              SizedBox(height: 8),
              Text(
                  "Wirst du heute/morgen fehlen? Trage es dir direkt hier ein!",
                  style: TextStyle(
                      fontSize: 16, color: Color.fromRGBO(0, 0, 0, .8))),
            ],
          );
        } else {
          final numberOfDays =
              unexcusedAbsences.map((element) => element.date).toSet().length;
          return Text.rich(TextSpan(
            children: [
              const TextSpan(
                text: "Du hast noch ",
                style:
                    TextStyle(fontSize: 16, color: Color.fromRGBO(0, 0, 0, .8)),
              ),
              TextSpan(
                text: "${unexcusedAbsences.length}",
                style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color.fromRGBO(0, 0, 0, .8)),
              ),
              TextSpan(
                text:
                    " unentschuldigte ${unexcusedAbsences.length == 1 ? "Fehlzeit" : "Fehlzeiten"} an ",
                style: const TextStyle(
                    fontSize: 16, color: Color.fromRGBO(0, 0, 0, .8)),
              ),
              TextSpan(
                text: numberOfDays.toString(),
                style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color.fromRGBO(0, 0, 0, .8)),
              ),
              TextSpan(
                text: numberOfDays == 1 ? " Tag." : " Tagen.",
                style: const TextStyle(
                    fontSize: 16, color: Color.fromRGBO(0, 0, 0, .8)),
              ),
            ],
          ));
        }
      },
    );

    return MyCard(
        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Fehlzeiten",
                style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: store.theme.primary)),
            const SizedBox(height: 8),
            copyWidget,
            const SizedBox(height: 16),
            Observer(
                builder: (_) => store.currentUser.unexcusedAbsences.isEmpty
                    ? const SizedBox.shrink()
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text("Unentschuldigte Fehlzeiten",
                              style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: store.theme.primary)),
                          const SizedBox(height: 4),
                          ...store.currentUser.unexcusedAbsencesByDay.entries
                              .map<List<Widget>>((e) => [
                                    Text("${e.key.format()}:",
                                        style: const TextStyle(
                                            fontWeight: FontWeight.bold)),
                                    ...e.value
                                        .map((e) => Text(e.course.name))
                                        .toList(),
                                    const Divider(
                                      color: Color.fromRGBO(0, 0, 0, .2),
                                    )
                                  ])
                              .expand((element) => element)
                              .toList()
                              .sublistNegative(0, -1),
                          const SizedBox(height: 16),
                          if (store.currentUser.unexcusedAbsences.length > 1)
                            Align(
                              alignment: Alignment.bottomRight,
                              child: ElevatedButton(
                                  onPressed: () {},
                                  child: const Text("Jetzt entschuldigen",
                                      style: TextStyle(color: Colors.white))),
                            )
                        ],
                      )),
            Align(
              alignment: Alignment.bottomRight,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color.fromRGBO(0, 0, 0, .6)),
                ),
                onPressed: () {
                  showSheet(
                      context, (ctx) => RegisterAbsenceForm(store: store));
                },
                child: const Text(
                  "Fehlzeit eintragen",
                  style: TextStyle(color: Color.fromRGBO(0, 0, 0, .6)),
                ),
              ),
            ),
          ],
        ));
  }
}
