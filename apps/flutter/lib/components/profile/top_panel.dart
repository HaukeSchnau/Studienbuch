import 'package:class_companion/components/action_sheet.dart';
import 'package:class_companion/components/profile/cool_dots.dart';
import 'package:class_companion/hooks/use_store.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:class_companion/components/profile/smol_card.dart';
import 'package:go_router/go_router.dart';

class ProfileTopPanel extends HookWidget {
  const ProfileTopPanel({super.key});

  @override
  Widget build(BuildContext context) {
    final store = useStore();
    final user = store.currentUser;
    const schwerpunkt = "sprachlich";

    var actions = <MyAction>[
      MyAction(
          label: "Über die App",
          icon: Icons.info_rounded,
          handler: () => context.push("/about")),
    ];
    // TODO: Re-add these actions
    // actions.insertAll(0, [
    //   MyAction(
    //       label: "Prüfungsfächer wechseln",
    //       icon: Icons.school_rounded,
    //       handler: () => Navigator.push(
    //           context,
    //           MaterialPageRoute(
    //             builder: (context) =>
    //                 ProfileSetupPage(onSubmit: () => loadProfileFile()),
    //           ))),
    //   MyAction(
    //       label: "Kurse neu wählen",
    //       icon: Icons.class__rounded,
    //       handler: () => Navigator.push(
    //           context,
    //           MaterialPageRoute(
    //             builder: (context) => const SetupPage(),
    //           ))),
    // ]);
    if (kDebugMode) {
      actions.add(MyAction(
        label: "App zurücksetzen",
        icon: Icons.restore_rounded,
        handler: () => context.go("/setup"),
      ));
    }

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
          color: store.theme.primary,
          borderRadius:
              const BorderRadius.vertical(bottom: Radius.circular(40))),
      child: SafeArea(
        child: Stack(
          children: [
            const Positioned(
                left: 20,
                top: 20,
                child:
                    SizedBox(width: 100, child: CoolDots(rows: 9, cols: 10))),
            const Positioned(
                right: 20,
                bottom: 20 + smolCardHeight / 2,
                child: SizedBox(width: 70, child: CoolDots(rows: 6, cols: 7))),
            Align(
                alignment: Alignment.topRight,
                child: Padding(
                  padding: const EdgeInsets.only(right: 16.0, top: 8.0),
                  child: Material(
                      color: Colors.transparent,
                      child: IconButton(
                          icon: const Icon(Icons.settings,
                              color: Color.fromRGBO(255, 255, 255, 1)),
                          onPressed: () => showModalBottomSheet(
                              context: context,
                              backgroundColor: Colors.transparent,
                              builder: (context) =>
                                  ActionSheet(actions: actions)))),
                )),
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Column(
                  children: [
                    Container(
                      decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(99999999),
                          color: store.theme.secondary),
                      padding: const EdgeInsets.all(24.0),
                      child: Text(
                        user.initials,
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 28),
                      ),
                    ),
                    const Padding(padding: EdgeInsets.only(top: 16.0)),
                    Text(
                      "${user.firstName}s Profil",
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 24),
                    ),
                    const Padding(padding: EdgeInsets.only(top: 8.0)),
                    const Text(
                      "${schwerpunkt}er\nSchwerpunkt",
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          color: Color.fromRGBO(255, 255, 255, .85),
                          fontSize: 16),
                    ),
                    const Padding(
                        padding: EdgeInsets.only(top: smolCardHeight / 2)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
