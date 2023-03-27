import 'package:intl/intl.dart';

extension NumberUtil on num {
  String formatAsGrade() {
    if (isNaN) {
      return "—";
    }

    final format = NumberFormat("0.0#");
    return format.format(
      this,
    );
  }
}
