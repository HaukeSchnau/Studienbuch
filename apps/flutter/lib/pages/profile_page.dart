import 'package:assorted_layout_widgets/assorted_layout_widgets.dart';
import 'package:class_mate/components/profile/smol_card.dart';
import 'package:class_mate/components/profile/subjects_grid.dart';
import 'package:class_mate/components/profile/top_panel.dart';
import 'package:class_mate/components/tab_bar_view.dart';
import 'package:class_mate/hooks/use_store.dart';
import 'package:class_mate/models/semester.dart';
import 'package:class_mate/simple_scaffold.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class ProfilePage extends HookWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    final store = useStore();
    final semesters = getRelevantSemesters(store.user.year);

    return SimpleScaffold(
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
            padding: EdgeInsets.only(left: 24.0, bottom: 4),
            child: Text(
              "Semester:",
              style: TextStyle(fontSize: 14),
            ),
          ),
        Expanded(
            child: semesters.length > 1
                ? MyTabBarView(
                    initialIndex: semesters.length - 1,
                    pages: semesters.map((semester) {
                      return TabPage(
                          title: semester.name,
                          widget: SubjectsGrid(
                            semester: semester,
                          ));
                    }),
                  )
                : SubjectsGrid(semester: semesters.first))
      ],
    ));
  }
}
