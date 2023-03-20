import 'package:class_companion/components/util/card.dart';
import 'package:class_companion/models/course.dart';
import 'package:class_companion/static/years.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_svg/flutter_svg.dart';

class SubjectsGrid extends HookWidget {
  final List<Course> courses;
  final Semester semester;

  const SubjectsGrid(
      {super.key, required this.courses, required this.semester});

  @override
  Widget build(BuildContext context) {
    final isCurrentSemester = semester == getCurrentSemester();

    return GridView.builder(
      padding: const EdgeInsets.only(left: 24, right: 24, bottom: 32, top: 12),
      gridDelegate: ResultsGridDelegate(),
      itemCount: courses.length,
      itemBuilder: (context, index) {
        final course = courses[index];
        const pIndex = -1; // TODO
        // var results = subjectResults![subjectName];
        // var grade = calcPoints(results!, subject!);
        // var pIndex = pFaecher!.indexOf(subjectName);
        return MyCard(
          padding: const EdgeInsets.all(4.0),
          onTap: () async {
            if (isCurrentSemester) {
              // await Navigator.push(
              //     context,
              //     MaterialPageRoute(
              //       builder: (context) => SubjectGradePage(
              //         subject: subject,
              //         results: results,
              //         semester: semester,
              //       ),
              //     ));
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
            // loadProfileFile();
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
      },
    );
  }
}

class ResultsGridDelegate extends SliverGridDelegate {
  @override
  SliverGridLayout getLayout(SliverConstraints constraints) {
    return ResultsGridLayout(constraints);
  }

  @override
  bool shouldRelayout(covariant SliverGridDelegate oldDelegate) {
    return true;
  }
}

class ResultsGridLayout extends SliverGridLayout {
  final SliverConstraints constraints;
  final double spacing = 32.0;
  final double height = 120;

  const ResultsGridLayout(this.constraints);

  @override
  double computeMaxScrollOffset(int childCount) {
    if (childCount == 0) return 0;

    var crossExtent = constraints.crossAxisExtent / 2 - spacing / 2;
    var firstHeight = crossExtent;
    if (childCount < 3) {
      return firstHeight;
    }
    var mainExtent = childCount < 2 ? firstHeight : height;
    var row = childCount ~/ 2;
    var scrollOffset = childCount < 2 ? 0.0 : mainExtent * row + firstHeight;
    return scrollOffset + spacing * row;
  }

  @override
  SliverGridGeometry getGeometryForChildIndex(int index) {
    var crossExtent = constraints.crossAxisExtent / 2 - spacing / 2;
    var col = index % 2;
    var firstHeight = crossExtent;
    var mainExtent = index < 2 ? firstHeight : height;
    var row = index ~/ 2;
    var scrollOffset = index < 2 ? 0.0 : mainExtent * (row - 1) + firstHeight;
    return SliverGridGeometry(
        crossAxisExtent: crossExtent,
        crossAxisOffset: crossExtent * col + (col == 0 ? 0 : spacing),
        mainAxisExtent: mainExtent,
        scrollOffset: scrollOffset + spacing * row);
  }

  @override
  int getMaxChildIndexForScrollOffset(double scrollOffset) {
    return 999;
  }

  @override
  int getMinChildIndexForScrollOffset(double scrollOffset) {
    return 0;
  }
}
