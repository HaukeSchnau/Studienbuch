import 'package:class_companion/hooks/use_store.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

class SingleConfirmationStatusView extends HookWidget {
  final bool confirmed;
  final String text;

  const SingleConfirmationStatusView(
      {super.key, required this.confirmed, required this.text});

  @override
  Widget build(BuildContext context) {
    final store = useStore();
    final color = confirmed ? store.theme.primaryText : store.theme.error;

    return Row(
      children: [
        Icon(confirmed ? Icons.verified_rounded : Icons.close_rounded,
            color: color),
        const SizedBox(width: 4),
        Text(text, style: TextStyle(color: color)),
      ],
    );
  }
}

enum ConfirmationStatusOrder {
  parentTeacher,
  teacherParent,
}

class ConfirmationStatusView extends StatelessWidget {
  final bool confirmedByParent;
  final bool confirmedByTeacher;
  final bool isOfAge;
  final ConfirmationStatusOrder order;
  final String confirmedText;

  const ConfirmationStatusView(
      {super.key,
      required this.confirmedByParent,
      required this.confirmedByTeacher,
      required this.isOfAge,
      required this.order,
      this.confirmedText = "Bestätigt"});

  @override
  Widget build(BuildContext context) {
    if (confirmedByParent && confirmedByTeacher) {
      return SingleConfirmationStatusView(confirmed: true, text: confirmedText);
    }

    if (isOfAge) {
      return SingleConfirmationStatusView(
          confirmed: confirmedByTeacher, text: "Lehrer");
    }

    if (order == ConfirmationStatusOrder.parentTeacher) {
      return Row(
        children: [
          SingleConfirmationStatusView(
              confirmed: confirmedByParent, text: "Eltern"),
          const SizedBox(width: 16),
          SingleConfirmationStatusView(
              confirmed: confirmedByTeacher, text: "Lehrer"),
        ],
      );
    } else {
      return Row(
        children: [
          SingleConfirmationStatusView(
              confirmed: confirmedByTeacher, text: "Lehrer"),
          const SizedBox(width: 16),
          SingleConfirmationStatusView(
              confirmed: confirmedByParent, text: "Eltern"),
        ],
      );
    }
  }
}
