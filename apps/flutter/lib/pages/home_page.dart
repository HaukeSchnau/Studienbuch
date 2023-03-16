import 'package:class_companion/components/agenda/agenda_view.dart';
import 'package:class_companion/components/util/clip_shadow_path.dart';
import 'package:class_companion/components/util/clippers.dart';
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
    final agenda = store.currentUser.agenda;
    final message = agenda.entries.isEmpty
        ? "du hast ${agenda.when} keine Kurse."
        : "das steht ${agenda.when} an:";

    final mainGreeting = Text(
      "Hallo, ${store.currentUser.shortName}",
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

    final agendaWidget = AgendaView(data: agenda);

    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),
        Padding(
          padding: EdgeInsets.only(left: hPadding, right: hPadding - 8.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              mainGreeting,
              subGreeting,
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.only(right: 8.0),
                child: agendaWidget,
              )
            ],
          ),
        ),
        const SizedBox(height: 32),
        // const BottomPanels(
        //     blueChild: AufgabenOverview(), whiteChild: Klausuren())
      ],
    );

    final scrollView = SingleChildScrollView(
      child: Container(
        color: store.theme.lightBg,
        child: Stack(children: [
          ClipShadowPath(
            shadow: Shadow(
                color: store.theme.secondary, offset: const Offset(0, 6)),
            clipper: BezierClipper(),
            child: Container(
              height: 250,
              color: store.theme.primary,
            ),
          ),
          SafeArea(child: body)
        ]),
      ),
    );

    return Stack(children: [
      Column(
        children: [
          Expanded(
            child: Container(color: store.theme.primary),
          ),
          Expanded(
            child: Container(color: store.theme.lightBg),
          )
        ],
      ),
      scrollView
    ]);
  }
}
