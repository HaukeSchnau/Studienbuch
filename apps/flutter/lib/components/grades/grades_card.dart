import 'package:class_companion/components/util/card.dart';
import 'package:class_companion/hooks/use_store.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_svg/flutter_svg.dart';

class GradesCard extends HookWidget {
  const GradesCard({super.key});

  @override
  Widget build(BuildContext context) {
    final store = useStore();

    final heading = Text("Deine Noten",
        style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: store.theme.primaryText));

    final icon = SvgPicture.asset(
      "assets/icons/muendl.svg",
      width: 64,
    );

    const oralGradeText = Text(
      "1,8",
      style: TextStyle(fontSize: 32, height: 1, fontWeight: FontWeight.w600),
    );

    final editOralButton = IconButton(
        icon: const Icon(
          Icons.edit_rounded,
        ),
        onPressed: () {/* TODO */});

    const oralText = Text(
      "mündlich",
      style: TextStyle(
          fontSize: 16, height: 1, color: Color.fromRGBO(0, 0, 0, .6)),
    );

    const isVerified = true;
    final verifiedBadge = Row(
      children: [
        Icon(
          Icons.verified,
          color: store.theme.primaryText,
        ),
        const SizedBox(width: 6),
        Text(
          "bestätigt",
          style: TextStyle(color: store.theme.primaryText),
        )
      ],
    );

    final writtenIcon = SvgPicture.asset(
      "assets/icons/schriftl.svg",
      width: 64,
    );

    const writtenGradeText = Text(
      "2,0",
      style: TextStyle(fontSize: 32, height: 1, fontWeight: FontWeight.w600),
    );

    const writtenText = Text(
      "schriftlich",
      style: TextStyle(
          fontSize: 16, height: 1, color: Color.fromRGBO(0, 0, 0, .6)),
    );

    final addWrittenButton = IconButton(
        icon: const Icon(
          Icons.add_rounded,
        ),
        onPressed: () {/* TODO */});

    const writtenInfoText = Text(
      "Deine Note setzt sich aus diesen Ergebnissen zusammen:",
      style: TextStyle(fontSize: 14, color: Color.fromRGBO(0, 0, 0, .8)),
    );
    return MyCard(
        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            heading,
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 8.0),
                  child: icon,
                ),
                const SizedBox(width: 16),
                Expanded(
                    child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            SizedBox(height: 10),
                            oralGradeText,
                            SizedBox(height: 4),
                            oralText,
                          ],
                        ),
                        editOralButton,
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (isVerified) verifiedBadge
                  ],
                ))
              ],
            ),
            Divider(color: Colors.black.withOpacity(0.2), height: 48),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 8.0),
                  child: writtenIcon,
                ),
                const SizedBox(width: 16),
                Expanded(
                    child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            SizedBox(height: 10),
                            writtenGradeText,
                            SizedBox(height: 4),
                            writtenText,
                          ],
                        ),
                        addWrittenButton,
                      ],
                    ),
                    const SizedBox(height: 12),
                    writtenInfoText
                  ],
                ))
              ],
            ),
          ],
        ));
  }
}
