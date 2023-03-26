import 'package:class_companion/components/absense_view.dart';
import 'package:class_companion/components/agenda/agenda_view.dart';
import 'package:class_companion/components/path_bg_page.dart';
import 'package:class_companion/hooks/use_store.dart';
import 'package:class_companion/util/ui_util.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class HomePage extends HookWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final store = useStore();

    final hPadding = useHorizontalPadding();
    final agenda = store.agenda;
    final message = agenda.entries.isEmpty
        ? "Du hast ${agenda.when} keine Kurse."
        : "Das steht ${agenda.when} an:";

    final mainGreeting = Text(
      "Moin, ${store.currentUser.shortName}!",
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
              subGreeting,
              const SizedBox(height: 16),
              AgendaView(data: agenda),
              const SizedBox(
                height: 32,
              ),
              const AbsenceView(),
            ],
          ),
        ),
        const SizedBox(height: 32),
        // const BottomPanels(
        //     blueChild: AufgabenOverview(), whiteChild: Klausuren())
      ],
    );

    return PathBackgroundPage(child: body);
  }
}
