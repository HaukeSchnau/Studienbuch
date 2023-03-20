import 'package:assorted_layout_widgets/assorted_layout_widgets.dart';
import 'package:class_companion/components/profile/smol_card.dart';
import 'package:class_companion/components/profile/subjects_grid.dart';
import 'package:class_companion/components/profile/top_panel.dart';
import 'package:class_companion/components/tab_bar_view.dart';
import 'package:class_companion/hooks/use_store.dart';
import 'package:class_companion/static/years.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class ProfilePage extends HookWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final store = useStore();

    final coursesMap = store.currentUser.coursesInAllSemesters;

    return Scaffold(
        body: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ColumnSuper(
          innerDistance: -smolCardHeight / 2,
          children: const [
            ProfileTopPanel(),
            // cards,
          ],
        ),
        const SizedBox(height: 16),
        if (coursesMap.length > 1)
          const Padding(
            padding: EdgeInsets.only(left: 24.0),
            child: Text(
              "Semester:",
              style: TextStyle(fontSize: 14),
            ),
          ),
        Expanded(
            child: coursesMap.length > 1
                ? MyTabBarView(
                    pages: coursesMap.entries.map((entry) {
                      return TabPage(
                          title: formatSemester(entry.key),
                          widget: SubjectsGrid(
                            courses: entry.value,
                            semester: entry.key,
                          ));
                    }).toList(),
                  )
                : SubjectsGrid(
                    courses: coursesMap.values.first,
                    semester: coursesMap.keys.first))
      ],
    ));
  }
}
