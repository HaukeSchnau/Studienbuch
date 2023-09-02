import 'package:class_mate/database/database.dart';
import 'package:class_mate/hooks/use_query.dart';
import 'package:class_mate/util/list_util.dart';

User? useOptionalUser() {
  return useQuery(() => db.select(db.users), [])
      ?.firstOrNull; // This kinda sucks right now because while it's loading it will return null and show the user the login screen for a split second
}

User useUser() {
  final user = useOptionalUser();
  if (user == null) {
    throw Exception("User not found");
  }
  return user;
}

Year useYear() {
  final user = useUser();
  final year = useQuery(
      () => db.select(db.years)..where((tbl) => tbl.id.equals(user.year)),
      [user.year])?.firstOrNull;
  if (year == null) {
    throw Exception("Year not found");
  }
  return year;
}
