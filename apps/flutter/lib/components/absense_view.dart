import 'package:class_companion/components/bottom_sheet_container.dart';
import 'package:class_companion/components/register_absence_form.dart';
import 'package:class_companion/components/util/card.dart';
import 'package:class_companion/hooks/use_store.dart';
import 'package:flutter/material.dart';
import 'package:flutter_mobx/flutter_mobx.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_svg/svg.dart';
import 'package:go_router/go_router.dart';

class AbsenceView extends HookWidget {
  const AbsenceView({super.key});

  @override
  Widget build(BuildContext context) {
    final store = useStore();

    final copyWidget = Observer(
      builder: (_) {
        final absences = store.absences;
        final unexcusedAbsences = store.unexcusedAbsences;
        if (absences.isEmpty) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Text("Du hast noch keine Fehlzeiten eingetragen.",
                  style: TextStyle(
                      fontSize: 16, color: Color.fromRGBO(0, 0, 0, .8))),
              SizedBox(height: 8),
              Text(
                  "Wirst du heute/morgen fehlen? Trage es dir direkt hier ein!",
                  style: TextStyle(
                      fontSize: 16, color: Color.fromRGBO(0, 0, 0, .8))),
            ],
          );
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
          return Row(
            children: [
              SvgPicture.asset(
                "assets/icons/warning.svg",
                width: 32,
              ),
              const SizedBox(width: 32),
              Expanded(
                child: Text.rich(TextSpan(
                  children: [
                    const TextSpan(
                      text: "Du hast noch ",
                      style: TextStyle(
                          fontSize: 16, color: Color.fromRGBO(0, 0, 0, .8)),
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
                )),
              ),
            ],
          );
        }
      },
    );

    return MyCard(
        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text("Fehlzeiten",
                    style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: store.theme.primaryText)),
                IconButton(
                    onPressed: () => showSheet(
                        context, (ctx) => RegisterAbsenceForm(store: store)),
                    icon: Icon(Icons.add,
                        color: store.theme.primaryText, size: 32))
              ],
            ),
            const SizedBox(height: 8),
            copyWidget,
            const SizedBox(height: 16),
            Observer(
                builder: (_) => store.unexcusedAbsences.isEmpty
                    ? const SizedBox.shrink()
                    : Align(
                        alignment: Alignment.bottomRight,
                        child: ElevatedButton(
                            onPressed: () => context.push("/absences"),
                            child: const Text("Alle ansehen",
                                style: TextStyle(color: Colors.white))),
                      )),
          ],
        ));
  }
}
