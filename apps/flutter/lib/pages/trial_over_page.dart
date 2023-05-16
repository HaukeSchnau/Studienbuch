import 'dart:math';

import 'package:class_mate/components/util/card.dart';
import 'package:class_mate/components/util/circle.dart';
import 'package:flutter/material.dart';
import 'package:class_mate/components/util/logo.dart';
import 'package:class_mate/static/colors.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:url_launcher/url_launcher.dart';

const TextStyle _linkStyle = TextStyle(color: Color(0xFF6A6A6A), fontSize: 16);

const trialEndText =
    'Die offizielle Testphase ist vorbei. Vielen Dank für deine Hilfe! Du kannst die App weiterhin nutzen, indem du die App im Store updadest und ab kommendem Schuljahr einen kleinen Beitrag zahlst. Weitere Informationen erhältst du bei Herr Niemann oder per Mail an den Entwickler, Hauke Schnau unter studienbuch@haukeschnau.de';

class TrialOverPage extends HookWidget {
  const TrialOverPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SizedBox(
        width: MediaQuery.of(context).size.width,
        height: MediaQuery.of(context).size.height,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Positioned(
              left: -175,
              top: 75,
              child: Circle(
                size: 300,
                color: theme.secondary,
              ),
            ),
            Positioned(
              right: -125,
              top: 300,
              child: Circle(
                size: 200,
                color: theme.primary,
              ),
            ),
            Positioned(
              left: -100,
              top: 500,
              child: Circle(
                size: 150,
                color: theme.error,
              ),
            ),
            SafeArea(
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 32.0),
                      child: Logo(),
                    ),
                    AnimatedSize(
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeInOut,
                      child: MyCard(
                          margin: const EdgeInsets.symmetric(horizontal: 32),
                          padding: const EdgeInsets.symmetric(horizontal: 24),
                          width: min(MediaQuery.of(context).size.width, 500),
                          child: Column(
                            children: [
                              Padding(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 36.0),
                                child: Column(
                                  children: [
                                    Text(
                                      "Testphase vorbei!",
                                      style: Theme.of(context)
                                          .textTheme
                                          .headlineMedium,
                                    ),
                                    const SizedBox(height: 8.0),
                                    Text(trialEndText,
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodyMedium),
                                  ],
                                ),
                              ),
                              // Padding(
                              //   padding:
                              //       const EdgeInsets.symmetric(vertical: 24.0),
                              //   child: FilledButton(
                              //     child: const Text("Store öffnen"),
                              //     onPressed: () {},
                              //   ),
                              // )
                            ],
                          )),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 32),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          GestureDetector(
                            onTap: () => launchUrl(Uri.parse(
                                "https://igs.haukeschnau.de/impressum")),
                            child: const Text(
                              "Impressum",
                              style: _linkStyle,
                            ),
                          ),
                          const Padding(
                            padding: EdgeInsets.only(top: 16),
                          ),
                          GestureDetector(
                            onTap: () => launchUrl(Uri.parse(
                                "https://igs.haukeschnau.de/datenschutz")),
                            child: const Text(
                              "Datenschutz",
                              style: _linkStyle,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            )
          ],
        ),
      ),
    );
  }
}
