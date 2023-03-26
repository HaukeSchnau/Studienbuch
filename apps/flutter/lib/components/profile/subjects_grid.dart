import 'package:class_companion/components/util/card.dart';
import 'package:class_companion/models/course.dart';
import 'package:class_companion/models/semester.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_svg/flutter_svg.dart';

class SubjectsGrid extends HookWidget {
  final Semester semester;

  const SubjectsGrid({super.key, required this.semester});

  @override
  Widget build(BuildContext context) {
    final isCurrentSemester = semester.id == getCurrentSemesterId();

    final courses = useValueListenable(semester.courses);
    semester.courses.load();

    Widget itemBuilder(BuildContext context, int index) {
      final course = courses[index];
      const pIndex = -1; // TODO
      // final grades = store.currentUser.grades[semester]![course.name]!; // TODO
      return MyCard(
        padding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: pIndex != -1 && pIndex < 2 ? 48 : 24,
        ),
        onTap: () async {
          if (isCurrentSemester) {
            course.navigateTo(context, semester.id);
          } else {
            // await showModalBottomSheet(
            //   context: context,
            //   isScrollControlled: true,
            //   backgroundColor: Colors.transparent,
            //   builder: (context) {
            //     return OverrideSheet(
            //         subjectAbbrv: subject.abbrv,
            //         points: grade,
            //         semester: semester);
            //   },
            // );
          }
        },
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SvgPicture.asset(
                getCourseIcon(course.name),
                height: 30,
              ),
              const Padding(padding: EdgeInsets.only(top: 4.0)),
              Text(
                course.name + (pIndex == -1 ? "" : " (P${pIndex + 1})"),
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              pIndex < 2 && pIndex != -1
                  ? const Text(
                      "doppelte Wertung",
                      style: TextStyle(
                          fontSize: 12, color: Color.fromRGBO(0, 0, 0, .7)),
                    )
                  : Container(),
              const Padding(padding: EdgeInsets.only(top: 4.0)),
              // grade.isNaN
              //     ? Container()
              //     : Text(
              //         "${grade.toStringAsFixed(0)} ${punktePluralSingular(grade)}"),
              // Text(subject.)
            ],
          ),
        ),
      );
    }

    const numColumns = 2;
    return SingleChildScrollView(
      child: Padding(
        padding:
            const EdgeInsets.only(left: 24, right: 24, bottom: 32, top: 12),
        child: Table(
          children: [
            for (var i = 0; i < courses.length; i += numColumns)
              TableRow(
                children: [
                  for (var j = 0; j < numColumns; j++)
                    if (i + j < courses.length)
                      Padding(
                        padding: EdgeInsets.only(
                          right: j == 0 ? 16 : 0,
                          left: j == 1 ? 16 : 0,
                          bottom: 32,
                        ),
                        child: itemBuilder(context, i + j),
                      )
                    else
                      Container(),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
