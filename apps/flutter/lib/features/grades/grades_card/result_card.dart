
import 'package:class_mate/database/database.dart';
import 'package:class_mate/features/grades/confirmation_status_view.dart';
import 'package:class_mate/features/grades/confirmation_view.dart';
import 'package:class_mate/infrastructure/util/date_util.dart';
import 'package:class_mate/infrastructure/util/number_util.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/grade_result.dart';
import 'package:class_mate/presentation/colors.dart';
import 'package:class_mate/presentation/components/card.dart';
import 'package:flutter/material.dart';

class ResultCard extends StatelessWidget {
  final GradeResult result;
  final VoidCallback? action;
  final VoidCallback? deleteAction;
  final bool userIsOfAge;
  final String type;
  final String actionText;
  final Color actionColor;
  final Course course;
  final User user;

  const ResultCard(
      {super.key,
      required this.result,
      this.action,
      this.deleteAction,
      this.userIsOfAge = false,
      this.type = "Klausur",
      this.actionText = "Jetzt bestätigen",
      required this.actionColor,
      required this.course,
      required this.user});

  @override
  Widget build(BuildContext context) {
    viewFullConfirmation() => type == "Klausur"
        ? viewWrittenGradeConfirmation(context, course, user, result)
        : viewOralGradeConfirmation(context, course, user, result);

    return MyCard(
        color: result.isConfirmed
            ? theme.primaryDesaturated
            : theme.errorDesaturated,
        borderRadius: BorderRadius.circular(24),
        shadow: false,
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
        onTap: result.isConfirmed ? viewFullConfirmation : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text(
                  result.result.formatAsGradeShort().replaceAll(".", ","),
                  style: const TextStyle(
                      fontSize: 24,
                      height: 1,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("$type vom ${result.date.format()}"),
                      ConfirmationStatusView(
                        confirmedByParent: result.isConfirmedByParent,
                        confirmedByTeacher: result.isConfirmedByTeacher,
                        isOfAge: userIsOfAge,
                        order: ConfirmationStatusOrder.teacherParent,
                      )
                    ],
                  ),
                ),
                if (deleteAction != null)
                  IconButton(
                      onPressed: deleteAction,
                      icon: const Icon(Icons.delete_outline_rounded,
                          color: Color.fromRGBO(0, 0, 0, .7)))
              ],
            ),
            const SizedBox(height: 8),
            if (action != null)
              Align(
                alignment: Alignment.centerRight,
                child: OutlinedButton(
                    onPressed: action,
                    style: OutlinedButton.styleFrom(
                        side: BorderSide(color: actionColor)),
                    child:
                        Text(actionText, style: TextStyle(color: actionColor))),
              )
          ],
        ));
  }
}
