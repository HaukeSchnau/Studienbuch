import 'dart:async';

import 'package:class_mate/database/database.dart';
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

final _user = ValueNotifier<User?>(null);
final _year = ValueNotifier<Year?>(null);

StreamSubscription? _userSubscription;
StreamSubscription? _yearSubscription;

Future<void> initYear(User user) async {
  final yearQuery = db.select(db.years)
    ..where((tbl) => tbl.id.equals(user.year));

  final newYear = await yearQuery.getSingleOrNull();
  _year.value = newYear;

  _yearSubscription?.cancel();
  _yearSubscription = yearQuery.watchSingleOrNull().listen((event) {
    _year.value = event;
  });
}

Future<void> initUser() async {
  final userQuery = db.select(db.users)..where((tbl) => tbl.id.equals(0));

  final newUser = await userQuery.getSingleOrNull();
  _user.value = newUser;

  _userSubscription?.cancel();
  _userSubscription = userQuery.watchSingleOrNull().listen((event) {
    _user.value = event;

    if (event != null) {
      initYear(event);
    }
  });

  if (newUser != null) {
    initYear(newUser);
  }
}

User? getOptionalUser() {
  return _user.value;
}

User? useOptionalUser() {
  useListenable(_user);
  return _user.value;
}

User useUser() {
  useListenable(_user);
  return _user.value!;
}

Year useYear() {
  useListenable(_year);
  return _year.value!;
}
