import 'package:flutter/material.dart';

class ActionSheet extends StatelessWidget {
  final List<MyAction> actions;

  const ActionSheet({super.key, required this.actions});

  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.hardEdge,
      padding: const EdgeInsets.only(top: 16),
      decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(50))),
      child: SafeArea(
        child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: actions
                .map((action) => ActionSheetItem(action: action))
                .toList()),
      ),
    );
  }
}

class ActionSheetItem extends StatelessWidget {
  final MyAction action;

  const ActionSheetItem({super.key, required this.action});

  @override
  Widget build(BuildContext context) {
    return Material(
        color: Colors.transparent,
        child: InkWell(
            onTap: () {
              Navigator.pop(context);
              action.handler();
            },
            child: Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 32.0, vertical: 24.0),
              child: Row(
                children: [
                  Icon(action.icon, color: const Color.fromRGBO(0, 0, 0, .7)),
                  const Padding(padding: EdgeInsets.only(left: 16.0)),
                  Text(action.label ?? "",
                      style:
                          const TextStyle(color: Colors.black, fontSize: 16)),
                ],
              ),
            )));
  }
}

class MyAction {
  String? label;
  VoidCallback handler;
  IconData? icon;
  bool isActive;

  MyAction(
      {this.label, required this.handler, this.icon, this.isActive = false});
}
