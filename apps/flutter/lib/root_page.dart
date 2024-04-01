import 'dart:async';

import 'package:class_mate/features/courses/copy_courses_from_previous_semester.dart';
import 'package:class_mate/features/schedule/week_page_tutorial.dart';
import 'package:class_mate/infrastructure/util/ui_util.dart';
import 'package:class_mate/home_page.dart';
import 'package:class_mate/features/profile/profile_page.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/semester.dart';
import 'package:class_mate/presentation/components/simple_scaffold.dart';
import 'package:class_mate/presentation/components/logo.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class Page {
  final Widget widget;
  final IconData icon;
  final String name;

  const Page({required this.widget, required this.icon, required this.name});
}

const pages = [
  Page(name: "Übersicht", icon: Icons.home_rounded, widget: HomePage()),
  Page(
      name: "Meine Woche",
      icon: Icons.calendar_today_rounded,
      widget: WeekPageTutorial()),
  Page(
    name: "Mein Profil",
    icon: Icons.person_rounded,
    widget: ProfilePage(),
  ),
];

class RootPage extends HookWidget {
  const RootPage({super.key});

  @override
  Widget build(BuildContext context) {
    final courses = useCourses(semesterId: getCurrentSemesterId());

    final noCoursesChosenYet = courses != null && courses.isEmpty;
    useEffect(() {
      if (noCoursesChosenYet) {
        final timer = Timer(const Duration(seconds: 1), () {
          copyCoursesFromPreviousSemester(getCurrentSemesterId());
        });

        return timer.cancel;
      }
      return null;
    }, [noCoursesChosenYet]);

    final isLarge = useIsLarge();
    final pageController = usePageController();
    final currentPageIndex = useState(0);

    final body = PageView(
      physics: const NeverScrollableScrollPhysics(),
      controller: pageController,
      onPageChanged: (index) => currentPageIndex.value = index,
      children: pages.map((page) => page.widget).toList(),
    );

    if (isLarge) {
      final navigationRail = NavigationRail(
        selectedIndex: currentPageIndex.value,
        onDestinationSelected: pageController.jumpToPage,
        // labelType: NavigationRailLabelType.all,
        leading: const Padding(
          padding: EdgeInsets.all(32.0),
          child: Logo(),
        ),
        extended: true,
        backgroundColor: Colors.white,
        elevation: 8,
        destinations: pages
            .map((page) => NavigationRailDestination(
                icon: Icon(page.icon), label: Text(page.name)))
            .toList(),
      );

      return SimpleScaffold(
        body: Row(
          children: [navigationRail, Expanded(child: body)],
        ),
      );
    } else {
      final bottomNavigationBar = BottomNavigationBar(
          currentIndex: currentPageIndex.value,
          onTap: pageController.jumpToPage,
          type: BottomNavigationBarType.fixed,
          items: pages
              .map((page) => BottomNavigationBarItem(
                  icon: Icon(page.icon), label: page.name))
              .toList());

      return SimpleScaffold(
        body: AnnotatedRegion<SystemUiOverlayStyle>(
            value: SystemUiOverlayStyle.light, child: body),
        bottomNavigationBar: bottomNavigationBar,
      );
    }
  }
}
