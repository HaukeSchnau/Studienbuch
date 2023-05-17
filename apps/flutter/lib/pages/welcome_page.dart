import 'dart:math';

import 'package:class_mate/components/util/card.dart';
import 'package:class_mate/components/util/circle.dart';
import 'package:class_mate/models/setup_store.dart';
import 'package:class_mate/pages/profile_setup_page.dart';
import 'package:class_mate/simple_scaffold.dart';
import 'package:flutter/material.dart';
import 'package:class_mate/components/util/logo.dart';
import 'package:class_mate/static/colors.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:url_launcher/url_launcher.dart';

const TextStyle _linkStyle = TextStyle(color: Color(0xFF6A6A6A), fontSize: 16);

class WelcomePage extends HookWidget {
  const WelcomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final store = useState(SetupStore());
    final currentPage = useState<Widget?>(null);

    useEffect(() {
      store.value.licenseKey = "KJ27-MP16-LS14-JM22";

      currentPage.value = ProfileSetupPage(
        onNext: (Widget nextPage) {
          currentPage.value = nextPage;
        },
        store: store.value,
      );
      return null;

      // TODO: Re-add after trial phase is over
      // currentPage.value = LicenseForm(
      //   onNext: (Widget nextPage) {
      //     currentPage.value = nextPage;
      //   },
      //   store: store.value,
      // );
      // return null;
    }, []);

    return SimpleScaffold(
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
                          child: currentPage.value ?? Container()),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 32),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          GestureDetector(
                            onTap: () => launchUrl(Uri.parse(
                                "https://classmate.haukeschnau.de/impressum")),
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
                                "https://classmate.haukeschnau.de/datenschutz")),
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
