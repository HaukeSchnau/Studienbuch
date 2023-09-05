@Deprecated("Use SQLite instead")
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:class_mate/database/database.dart';
import 'package:class_mate/error_catcher.dart';
import 'package:class_mate/models/agenda.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/setup_store.dart';
import 'package:class_mate/models/substitution.dart';
import 'package:class_mate/models/user.dart';
import 'package:class_mate/openapi.dart';
import 'package:class_mate/util/date_util.dart';
import 'package:drift/drift.dart';
import 'package:encrypt/encrypt.dart';
import 'package:mobx/mobx.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sentry/sentry_io.dart';

part 'store.g.dart';

@Deprecated("Use SQLite instead")
class GlobalStore = _GlobalStore with _$GlobalStore;

@Deprecated("Use SQLite instead")
abstract class _GlobalStore with Store {
  final UserStore user;

  @observable
  String licenseKey;

  @observable
  DateTime licenseKeyActivatedAt;

  @observable
  Agenda agenda = Agenda(start: DateTime.now(), courses: []);

  @observable
  List<Agenda> weeklyAgenda = [];

  bool shouldSave = true;

  _GlobalStore({
    required this.user,
    required this.licenseKey,
    required this.licenseKeyActivatedAt,
  });

  Future<void> init() async {
    createSemesterCoursesQuery().watch().listen((results) {
      final courses = results.map((e) => e.readTable(db.courses)).toList();
      _updateSubstitutedAgenda(courses);
      _updateWeeklyAgenda(courses);
    });
  }

  @computed
  bool get isLicenseKeyValid {
    // TODO better logic for license key validation
    final now = DateTime.now();
    final diff = now.difference(licenseKeyActivatedAt);
    return diff.inDays < 365;
  }

  //// AGENDA ////

  @action
  Future<void> _updateSubstitutedAgenda(List<Course> courses) async {
    final agenda = Agenda(
      start: DateTime.now(),
      courses: courses,
    );

    final date = agenda.date.add(agenda.date.timeZoneOffset).toUtc();
    final substitutions = await apiInstance
        .querySubstitutionsGet(date: date)
        .catchError((e, stacktrace) {
      this.agenda = agenda;
      throw UserException("Vertretungen konnten nicht geladen werden", e);
    });

    if (substitutions == null) {
      this.agenda = agenda;
      return;
    }

    for (final sub in substitutions) {
      final lessonStart = sub.lessonStart;
      final index = lessonStart ~/ 2;

      if (index >= agenda.entries.length) {
        continue;
      }

      final agendaEntry = agenda.entries[index];

      if (agendaEntry.course?.id == sub.courseId) {
        agendaEntry.substitution = Substitution(
          type: typeMap[sub.type]!,
        );
      }
    }

    this.agenda = agenda;
  }

  @action
  void _updateWeeklyAgenda(List<Course> courses) {
    final start = agenda.date.startOfWeek;

    final days = <DateTime>[];
    for (var i = 0; i < 5; i++) {
      days.add(start.add(Duration(days: i)));
    }

    weeklyAgenda = days
        .map((e) => Agenda(start: e, courses: courses, autoAdjust: false))
        .toList();
  }

  //// PERSISTENCE ////

  // ignore: unused_element
  _GlobalStore.fromJson(Map<String, dynamic> json)
      : this(
          user: UserStore.fromJson(json["currentUser"]),
          licenseKey: json["licenseKey"],
          licenseKeyActivatedAt: DateTime.parse(json["licenseKeyActivatedAt"]),
        );

  Future<void> save() async {
    await Sentry.captureMessage("Converting JSON store to SQLite");

    await saveUserData(
        year: Year(
          id: user.year.id,
          startYear: user.year.startYear,
          graduationYear: user.year.graduationYear,
          name: user.year.name,
        ),
        licenseKey: licenseKey,
        licenseKeyActivatedAt: licenseKeyActivatedAt,
        name: user.name,
        isOfAge: user.isOfAge);
  }

  Future<void> retire() async {
    await Sentry.captureMessage("Retiring old JSON store");
    final storeFilePath = await getStoreFilePath();
    final storeFile = File(storeFilePath);
    if (await storeFile.exists()) {
      await storeFile.rename("${storeFilePath}_retired");
    }
  }
}

@Deprecated("Use SQLite instead")
String decrypt(Uint8List encryptedBytes) {
  final key = Key.fromUtf8("y\$B&E)H@McQfTjWn");
  final iv = IV.fromLength(16);
  final encrypter = Encrypter(AES(key));
  final encrypted = Encrypted(encryptedBytes);
  return encrypter.decrypt(encrypted, iv: iv);
}

@Deprecated("Use SQLite instead")
Future<GlobalStore?> loadStore() async {
  final storeFilePath = await getStoreFilePath();
  final storeFile = File(storeFilePath);
  if (await storeFile.exists()) {
    try {
      final jsonContent = decrypt(await storeFile.readAsBytes());
      return GlobalStore.fromJson(jsonDecode(jsonContent));
    } catch (e, stacktrace) {
      await Sentry.captureException(e,
          stackTrace: stacktrace,
          hint: Hint.withAttachment(IoSentryAttachment.fromFile(storeFile)));
      return null;
    }
  } else {
    return null;
  }
}

@Deprecated("Use SQLite instead")
Future<String> getStoreFilePath() async {
  final directory = await getApplicationDocumentsDirectory();
  return "${directory.path}/data";
}
