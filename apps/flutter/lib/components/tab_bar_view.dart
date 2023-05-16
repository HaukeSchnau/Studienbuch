import 'package:class_mate/static/colors.dart';
import 'package:contained_tab_bar_view/contained_tab_bar_view.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class TabPage {
  const TabPage({required this.title, required this.widget});

  final String title;
  final Widget widget;
}

class MyTabBarView extends HookWidget {
  final List<TabPage> pages;
  final int initialIndex;

  const MyTabBarView({super.key, required this.pages, this.initialIndex = 0});

  @override
  Widget build(BuildContext context) {
    return ContainedTabBarView(
      tabs: pages
          .map((page) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8.0),
                child: Text(
                  page.title,
                  overflow: TextOverflow.visible,
                ),
              ))
          .toList(),
      initialIndex: initialIndex,
      tabBarProperties: TabBarProperties(
          margin: const EdgeInsets.only(left: 24, right: 24),
          labelPadding: const EdgeInsets.symmetric(vertical: (40.0 - 13) / 2),
          height: 40,
          background: Container(
            decoration: BoxDecoration(
                color: theme.secondaryDesaturated,
                borderRadius: BorderRadius.circular(12.0)),
          ),
          labelStyle:
              const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
          indicator: ContainerTabIndicator(
            height: 40,
            radius: BorderRadius.circular(12.0),
            color: theme.primary,
          ),
          labelColor: Colors.white,
          unselectedLabelColor: Colors.black),
      views: pages.map((page) => page.widget).toList(),
    );
  }
}
