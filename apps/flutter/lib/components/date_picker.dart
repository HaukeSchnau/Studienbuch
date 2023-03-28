import 'package:class_companion/static/theme.dart';
import 'package:class_companion/util/date_util.dart';
import 'package:flutter/material.dart';

class DatePicker extends StatelessWidget {
  final String label;
  final DateTime date;
  final void Function(DateTime) onDateChanged;

  const DatePicker({
    super.key,
    required this.date,
    required this.onDateChanged,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          decoration: BoxDecoration(
            color: disabledColor,
            borderRadius: BorderRadius.circular(50),
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(50),
              onTap: () {
                showDatePicker(
                  context: context,
                  initialDate: date,
                  firstDate: DateTime(2020),
                  lastDate: DateTime(2050),
                  selectableDayPredicate: (DateTime val) =>
                      val.weekday != 6 && val.weekday != 7,
                ).then((newDate) {
                  if (newDate != null) {
                    onDateChanged(newDate.startOfDay);
                  }
                });
              },
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                child: Row(
                  children: [
                    const Icon(Icons.calendar_today,
                        color: Colors.black87, size: 20),
                    const SizedBox(width: 8),
                    Text("${date.formatRelativeDay()}, ${date.format()}",
                        style: const TextStyle(
                          color: Colors.black87,
                        )),
                  ],
                ),
              ),
            ),
          ),
        ),
        Positioned(
          top: -8,
          left: 24,
          child: Text(label,
              style: const TextStyle(
                color: Colors.black,
                fontSize: 12,
              )),
        ),
      ],
    );
  }
}
