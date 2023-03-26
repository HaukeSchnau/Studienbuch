import 'package:assorted_layout_widgets/assorted_layout_widgets.dart';
import 'package:class_companion/components/profile/smol_card.dart';
import 'package:class_companion/components/profile/subjects_grid.dart';
import 'package:class_companion/components/profile/top_panel.dart';
import 'package:class_companion/components/tab_bar_view.dart';
import 'package:class_companion/hooks/use_store.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class ProfilePage extends HookWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final store = useStore();

    final semesters = store.semesters;

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
        if (semesters.length > 1)
          const Padding(
            padding: EdgeInsets.only(left: 24.0),
            child: Text(
              "Semester:",
              style: TextStyle(fontSize: 14),
            ),
          ),
        Expanded(
            child: semesters.length > 1
                ? MyTabBarView(
                    pages: semesters.map((semester) {
                      return TabPage(
                          title: semester.name,
                          widget: SubjectsGrid(
                            semester: semester,
                          ));
                    }).toList(),
                  )
                : SubjectsGrid(semester: semesters.first))
      ],
    ));
  }
}
