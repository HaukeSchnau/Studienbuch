import 'package:class_mate/database/database.dart';
import 'package:class_mate/business_domain/user/use_user.dart';
import 'package:class_mate/features/schedule/week_page.dart';
import 'package:class_mate/presentation/components/tutorial_provider.dart';
import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:tutorial_coach_mark/tutorial_coach_mark.dart';

enum WeekTutorialKeys {
  weekSwitcher,
  editButton,
  someCourseTime,
  abSwitcher,
  courseDragHandle,
}

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
          identify: WeekTutorialKeys.abSwitcher,
          keyTarget: tutorialKeys[WeekTutorialKeys.abSwitcher],
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
                        "Ändere die A/B-Woche!",
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            fontSize: 20.0),
                      ),
                      SizedBox(height: 10.0),
                      Text(
                        "Du kannst einstellen, ob du einen Kurs nur in der A-Woche, nur in der B-Woche oder in beiden Wochen hast. Tippe dazu einfach auf den Kurs. In der Ecke des Kurses siehst du dann die aktuelle Einstellung. A-Wochen sind die ungeraden Kalenderwochen und B-Wochen sind die geraden Kalenderwochen.",
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
                        "Verschiebe deine Kurse!",
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            fontSize: 20.0),
                      ),
                      SizedBox(height: 10.0),
                      Text(
                        "Im Bearbeitungsmodus kannst du deine Kurse verschieben, indem du sie einfach an die gewünschte Stelle ziehst. Um einen Kurs zu verschieben, musst du ihn gedrückt halten und dann an die gewünschte Stelle ziehen. Wenn du ihn nach ganz links ziehst, wird er aus deinem Plan gelöscht.",
                        style: TextStyle(color: Colors.white),
                      )
                    ],
                  ),
                ))
          ]),
      TargetFocus(
          identify: WeekTutorialKeys.courseDragHandle,
          keyTarget: tutorialKeys[WeekTutorialKeys.courseDragHandle],
          contents: [
            TargetContent(
                align: ContentAlign.top,
                child: const MyTargetContent(
                  bottom: 75,
                  left: 0,
                  right: 0,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        "Ziehe Kurse in den Plan!",
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            fontSize: 20.0),
                      ),
                      SizedBox(height: 10.0),
                      Text(
                        "Hier unten siehst du deine Kurse. Du kannst sie einfach in den Plan ziehen, um sie hinzuzufügen.",
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
                        "Speichere deinen Stundenplan!",
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            fontSize: 20.0),
                      ),
                      SizedBox(height: 10.0),
                      Text(
                        "Wenn du fertig bist, kannst du deinen Stundenplan speichern. Dazu musst du einfach auf den Speichern-Button klicken.",
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
    final editMode = useState(false);
    final user = useUser();

    return TutorialProvider<WeekTutorialKeys>(
      targetFocusBuilder: _createTargets,
      showTutorial: !user.hasCompletedScheduleTutorial,
      initialTutorialKeys: {
        WeekTutorialKeys.someCourseTime: GlobalKey(),
        WeekTutorialKeys.weekSwitcher: GlobalKey(),
        WeekTutorialKeys.editButton: GlobalKey(),
        WeekTutorialKeys.abSwitcher: GlobalKey(),
        WeekTutorialKeys.courseDragHandle: GlobalKey(),
      },
      onFinish: () {
        db.update(db.users).write(const UsersCompanion(
              hasCompletedScheduleTutorial: Value(true),
            ));
        return true;
      },
      onClickTarget: (target) {
        if (target.identify == WeekTutorialKeys.editButton) {
          editMode.value = true;
        }
      },
      child: WeekPage(
          editMode: editMode.value,
          onEditModeChanged: (newValue) => editMode.value = newValue),
    );
  }
}
