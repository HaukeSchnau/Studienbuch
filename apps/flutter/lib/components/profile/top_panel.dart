import 'package:class_mate/components/action_sheet.dart';
import 'package:class_mate/components/profile/cool_dots.dart';
import 'package:class_mate/components/profile/smol_card.dart';
import 'package:class_mate/hooks/use_user.dart';
import 'package:class_mate/models/user.dart';
import 'package:class_mate/models/year.dart';
import 'package:class_mate/static/colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:go_router/go_router.dart';

class ProfileTopPanel extends HookWidget {
  const ProfileTopPanel({super.key});

  @override
  Widget build(BuildContext context) {
    final user = useUser();
    final year = useYear();

    var actions = <MyAction>[
      MyAction(
          label: "Über die App",
          icon: Icons.info_rounded,
          handler: () => context.push("/about")),
      MyAction(
          label: "Profil & Kurse bearbeiten",
          icon: Icons.edit_rounded,
          handler: () => context.push("/editProfile"))
    ];

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
          color: theme.primary,
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
                padding: const EdgeInsets.symmetric(vertical: 48),
                child: Column(
                  children: [
                    Container(
                      decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(99999999),
                          color: theme.secondary),
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
                    Text(
                      "Jahrgang ${year.name} (${year.currentYearNum}. Klasse)",
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          color: Color.fromRGBO(255, 255, 255, .85),
                          fontSize: 16),
                    ),
                    // const Padding(
                    //     padding: EdgeInsets.only(top: smolCardHeight / 2)),
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
