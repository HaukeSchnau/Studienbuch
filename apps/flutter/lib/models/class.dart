import 'package:drift/drift.dart';

@DataClassName("Class")
class Classes extends Table {
  IntColumn get id => integer().autoIncrement()();
  TextColumn get identifierInYear => text()();
  // TODO: Add a reference to the year
}
