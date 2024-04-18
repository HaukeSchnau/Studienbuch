import 'package:class_mate/infrastructure/util/list_util.dart';
import 'package:dio/dio.dart';

final _dio = Dio();

class Holiday {
  final DateTime start;
  final DateTime end;
  final String name;

  Holiday({required this.start, required this.end, required this.name});

  static Holiday? fromJson(Map<String, dynamic> json) {
    if (json['start'] == null || json['end'] == null || json['name'] == null) {
      return null;
    }

    return Holiday(
      start: DateTime.parse(json['start']),
      end: DateTime.parse(json['end']),
      name: json['name'],
    );
  }
}

Future<List<Holiday>> fetchHolidays() async {
  final response = await _dio.get(
      'https://ferien-api.de/api/v1/holidays/NI/2024',
      options: Options(headers: {'Accept': 'application/json'}));

  return List<Holiday>.from((response.data as List)
      .map((holiday) => Holiday.fromJson(holiday))
      .whereType<Holiday>());
}

String matchHolidayName(String name) {
  final n = name.toLowerCase();
  if (n.contains('winter')) {
    return 'Winterferien';
  } else if (n.contains('oster')) {
    return 'Osterferien';
  } else if (n.contains('pfingst')) {
    return 'Pfingstferien';
  } else if (n.contains('sommer')) {
    return 'Sommerferien';
  } else if (n.contains('herbst')) {
    return 'Herbstferien';
  } else if (n.contains('weihnacht')) {
    return 'Weihnachtsferien';
  } else {
    return "Ferien";
  }
}

Holiday? getHoliday(List<Holiday> holidays, DateTime date) {
  return holidays.firstWhereOrNull((holiday) {
    return (date.isAfter(holiday.start) && date.isBefore(holiday.end)) ||
        date.isAtSameMomentAs(holiday.start) ||
        date.isAtSameMomentAs(holiday.end);
  });
}
