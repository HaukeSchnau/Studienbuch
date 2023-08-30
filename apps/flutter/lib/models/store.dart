import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:class_mate/database.dart';
import 'package:class_mate/error_catcher.dart';
import 'package:class_mate/models/agenda.dart';
import 'package:class_mate/models/course.dart';
import 'package:class_mate/models/substitution.dart';
import 'package:class_mate/models/user.dart';
import 'package:class_mate/openapi.dart';
import 'package:class_mate/router.dart';
import 'package:class_mate/util/date_util.dart';
import 'package:drift/drift.dart';
import 'package:encrypt/encrypt.dart';
import 'package:mobx/mobx.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sentry/sentry_io.dart';

part 'store.g.dart';

class GlobalStore = _GlobalStore with _$GlobalStore;

abstract class _GlobalStore with Store {
  final User user;

  @observable
  String licenseKey;

  @observable
  DateTime licenseKeyActivatedAt;

  @observable
  Agenda agenda = Agenda(start: DateTime.now(), courses: []);

  @observable
  List<Agenda> weeklyAgenda = [];

  @observable
  UpdateStoreCallback? updateStore;

  bool shouldSave = true;

  _GlobalStore(
      {required this.user,
      required this.licenseKey,
      required this.licenseKeyActivatedAt,
      // ignore: unused_element
      this.updateStore}) {
    Timer.periodic(const Duration(seconds: 5), (timer) {
      save();
    });

    // React on every change
    autorun((_) {
      save();
      toJson();
    });
  }

  disableSaving() {
    shouldSave = false;
  }

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
          user: User.fromJson(json["currentUser"]),
          licenseKey: json["licenseKey"],
          licenseKeyActivatedAt: DateTime.parse(json["licenseKeyActivatedAt"]),
        );

  Map<String, dynamic> toJson() {
    return {
      "currentUser": user.toJson(),
      "licenseKey": licenseKey,
      "licenseKeyActivatedAt": licenseKeyActivatedAt.toIso8601String(),
    };
  }

  Uint8List encrypt() {
    final cleartext = jsonEncode(this);
    final key = Key.fromUtf8("y\$B&E)H@McQfTjWn");
    final iv = IV.fromLength(16);

    final encrypter = Encrypter(AES(key));
    return encrypter.encrypt(cleartext, iv: iv).bytes;
  }

  Future<void> save() async {
    if (!shouldSave) return;

    final storeFilePath = await getStoreFilePath();
    final storeFile = File(storeFilePath);

    await storeFile.writeAsBytes(encrypt());
  }
}

String decrypt(Uint8List encryptedBytes) {
  final key = Key.fromUtf8("y\$B&E)H@McQfTjWn");
  final iv = IV.fromLength(16);
  final encrypter = Encrypter(AES(key));
  final encrypted = Encrypted(encryptedBytes);
  return encrypter.decrypt(encrypted, iv: iv);
}

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

Future<String> getStoreFilePath() async {
  final directory = await getApplicationDocumentsDirectory();
  return "${directory.path}/data";
}
