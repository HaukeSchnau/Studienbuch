import 'package:class_mate/database/database.dart';
import 'package:class_mate/models/year.dart';
import 'package:drift/drift.dart';
import 'package:mobx/mobx.dart';

part 'user.g.dart';

class Users extends Table {
  IntColumn get id => integer().autoIncrement()();

  TextColumn get licenseKey => text()();

  DateTimeColumn get licenseKeyActivatedAt => dateTime()();

  TextColumn get name => text()();

  BoolColumn get isOfAge => boolean()();

  IntColumn get year => integer().references(Years, #id)();

  DateTimeColumn get lastSyncedAt => dateTime().nullable()();

  DateTimeColumn get lastFullSyncedAt => dateTime().nullable()();
}

extension UserExtension on User {
  String get firstName => name.split(" ").first;

  String get lastName => name.split(" ").last;

  String get initials {
    final parts = name.split(" ");
    if (parts.length == 1) {
      return parts.first.substring(0, 2);
    }
    return parts.first.substring(0, 1) + parts.last.substring(0, 1);
  }

  get shortName {
    return name.split(" ")[0].split("-")[0];
  }
}

@Deprecated("Use SQLite instead")
class UserStore = _UserBase with _$UserStore;

@Deprecated("Use SQLite instead")
abstract class _UserBase with Store {
  @observable
  String name;

  @observable
  bool isOfAge;

  @observable
  YearStore year;

  _UserBase({
    required this.name,
    required this.isOfAge,
    required this.year,
  });

  // ignore: unused_element
  _UserBase.fromJson(Map<String, dynamic> json)
      : this(
          name: json["name"],
          isOfAge: json["isOfAge"],
          year: YearStore.fromJson(json["year"]),
        );
}
