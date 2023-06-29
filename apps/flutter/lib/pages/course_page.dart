import 'package:class_mate/components/grades/grades_card.dart';
import 'package:class_mate/components/path_bg_page.dart';
import 'package:class_mate/components/tasks/tasks_overview.dart';
import 'package:class_mate/components/util/bottom_panels.dart';
import 'package:class_mate/database.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/semester.dart';
import 'package:class_mate/simple_scaffold.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_svg/flutter_svg.dart';

class CoursePage extends HookWidget {
  final Course course;
  final Semester semester;

  const CoursePage({super.key, required this.course, required this.semester});

  @override
  Widget build(BuildContext context) {
    final iconPath = course.icon;
    final bool isPast = semester.id < getCurrentSemesterId();

    return SimpleScaffold(
        body: PathBackgroundPage(
      child: ConstrainedBox(
        constraints:
            BoxConstraints(minHeight: MediaQuery.of(context).size.height),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Padding(
              padding: const EdgeInsets.only(
                right: 32.0,
                left: 16,
                top: 16,
                bottom: 16,
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      IconButton(
                          icon:
                              const Icon(Icons.arrow_back, color: Colors.white),
                          onPressed: () => Navigator.of(context).pop()),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 4),
                            Text(course.name,
                                style: const TextStyle(
                                    fontSize: 32,
                                    height: 1.2,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white)),
                            Text(
                              semester.name,
                              style: const TextStyle(
                                  fontSize: 14,
                                  color: Color.fromRGBO(255, 255, 255, 8),
                                  fontStyle: FontStyle.italic),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              course.teacher.longFormalName,
                              style: const TextStyle(
                                  fontSize: 18, color: Colors.white),
                            ),
                          ],
                        ),
                      ),
                      if (iconPath != null)
                        Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(24),
                              boxShadow: [
                                BoxShadow(
                                    color: Colors.black.withOpacity(0.2),
                                    blurRadius: 8,
                                    offset: const Offset(0, 4))
                              ],
                            ),
                            padding: const EdgeInsets.all(16),
                            child: SvgPicture.asset(
                              iconPath,
                              height: 64,
                            ))
                    ],
                  ),
                  const SizedBox(height: 32),
                  Padding(
                    padding: const EdgeInsets.only(left: 16.0),
                    child: GradesCard(course: course, locked: isPast),
                  ),
                ],
              ),
            ),
            if (!isPast) const SizedBox(height: 32),
            if (!isPast)
              BottomPanels(
                  blueChild: TasksOverview(
                course: course,
              ))
          ],
        ),
      ),
    ));
  }
}
