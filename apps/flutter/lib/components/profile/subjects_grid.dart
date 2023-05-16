import 'package:class_mate/components/util/card.dart';
import 'package:class_mate/hooks/use_grades.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/semester.dart';
import 'package:class_mate/util/number_util.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_svg/flutter_svg.dart';

class SubjectsGrid extends HookWidget {
  final Semester semester;

  const SubjectsGrid({super.key, required this.semester});

  @override
  Widget build(BuildContext context) {
    final courses = useValueListenable(semester.courses);
    semester.courses.load();

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
                        child: CourseCard(
                          semester: semester,
                          course: courses[i + j],
                        ),
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

class CourseCard extends HookWidget {
  final Semester semester;
  final Course course;

  const CourseCard({super.key, required this.semester, required this.course});

  @override
  Widget build(BuildContext context) {
    final oral = useCurrentOralGrade(course);
    final written = useWrittenGrades(course);

    final isCurrentSemester = semester.id == getCurrentSemesterId();
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
          // TODO
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
            const SizedBox(
              height: 12,
            ),
            Row(
              children: [
                Expanded(
                    child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SvgPicture.asset("assets/icons/muendl.svg", height: 16),
                    const SizedBox(
                      width: 4,
                    ),
                    Text(
                      oral.mostRecentConfirmedOralGrade != null
                          ? oral.mostRecentConfirmedOralGrade!.result
                              .formatAsGradeShort()
                          : "—",
                      style: const TextStyle(fontSize: 16, height: 1),
                    ),
                  ],
                )),
                Container(
                  width: 1,
                  height: 16,
                  color: Colors.grey,
                  margin: const EdgeInsets.symmetric(horizontal: 8),
                ),
                Expanded(
                    child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SvgPicture.asset("assets/icons/schriftl.svg", height: 16),
                    const SizedBox(
                      width: 4,
                    ),
                    Text(
                      written.averageWrittenGrade.formatAsGradeShort(),
                      style: const TextStyle(fontSize: 16, height: 1),
                    ),
                  ],
                )),
              ],
            )
          ],
        ),
      ),
    );
  }
}
