import 'package:class_mate/components/tutorial/tutorial_provider.dart';
import 'package:class_mate/pages/week_page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:tutorial_coach_mark/tutorial_coach_mark.dart';

enum WeekTutorialKeys { weekSwitcher, editButton, someCourseTime }

class MyTargetContent extends StatelessWidget {
  final Widget child;
  final double? top;
  final double? bottom;
  final double? left;
  final double? right;

  const MyTargetContent(
      {super.key,
      required this.child,
      this.top,
      this.bottom,
      this.left,
      this.right});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 0,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            top: top,
            bottom: bottom,
            left: left,
            right: right,
            child: child,
          ),
        ],
      ),
    );
  }
}

class WeekPageTutorial extends HookWidget {
  const WeekPageTutorial({super.key});

  List<TargetFocus> _createTargets(
      TutorialKeys<WeekTutorialKeys> tutorialKeys) {
    return [
      TargetFocus(
          identify: WeekTutorialKeys.weekSwitcher,
          keyTarget: tutorialKeys[WeekTutorialKeys.weekSwitcher],
          contents: [
            TargetContent(
                align: ContentAlign.right,
                child: const MyTargetContent(
                  top: -60,
                  left: 20,
                  right: 0,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        "Wechsle zwischen den Wochen!",
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            fontSize: 20.0),
                      ),
                      SizedBox(height: 10.0),
                      Text(
                        "Du kannst zwischen den Wochen hin und her wechseln, indem du auf die Pfeile klickst.",
                        style: TextStyle(color: Colors.white),
                      )
                    ],
                  ),
                ))
          ]),
      TargetFocus(
          identify: WeekTutorialKeys.editButton,
          keyTarget: tutorialKeys[WeekTutorialKeys.editButton],
          contents: [
            TargetContent(
                align: ContentAlign.left,
                child: const MyTargetContent(
                  top: -50,
                  left: 0,
                  right: 20,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        "Korrigiere deinen Stundenplan!",
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            fontSize: 20.0),
                      ),
                      SizedBox(height: 10.0),
                      Text(
                        "Falls du einen Fehler in deinem Stundenplan entdeckst, kannst du ihn hier direkt selbst korrigieren.",
                        style: TextStyle(color: Colors.white),
                      )
                    ],
                  ),
                ))
          ]),
      TargetFocus(
          identify: WeekTutorialKeys.someCourseTime,
          keyTarget: tutorialKeys[WeekTutorialKeys.someCourseTime],
          contents: [
            TargetContent(
                align: ContentAlign.bottom,
                child: const MyTargetContent(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        "Hier siehst du deine Kurse!",
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            fontSize: 20.0),
                      ),
                      SizedBox(height: 10.0),
                      Text(
                        "Deine Kurse werden hier angezeigt. Wenn du auf einen Kurs klickst, bekommst du deine Kursdetails wie z.B. Noten, Hausaufgaben und mehr.",
                        style: TextStyle(color: Colors.white),
                      )
                    ],
                  ),
                ))
          ]),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return TutorialProvider<WeekTutorialKeys>(
      targetFocusBuilder: _createTargets,
      initialTutorialKeys: {
        WeekTutorialKeys.editButton: GlobalKey(),
        WeekTutorialKeys.weekSwitcher: GlobalKey(),
        WeekTutorialKeys.someCourseTime: GlobalKey(),
      },
      child: const WeekPage(),
    );
  }
}
