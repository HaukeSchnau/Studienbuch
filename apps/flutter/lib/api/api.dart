// GENERATED FILE - DO NOT MODIFY
// ignore_for_file: always_use_package_imports

import 'package:http/http.dart' as http;
import 'dart:convert';
import './types.dart';

class ApiClient {
  final Uri baseUri;
  final http.Client client;
  late final LicenseApi license;
  late final YearsApi years;
  late final ClassesApi classes;
  late final CoursesApi courses;
  late final SubstitutionsApi substitutions;
  late final SubscriptionsApi subscriptions;
  late final AuthApi auth;
  late final SchoolsApi schools;
  late final UsersApi users;

  ApiClient({required this.baseUri, http.Client? client})
      : client = client ?? http.Client() {
    license = LicenseApi(this);
    years = YearsApi(this);
    classes = ClassesApi(this);
    courses = CoursesApi(this);
    substitutions = SubstitutionsApi(this);
    subscriptions = SubscriptionsApi(this);
    auth = AuthApi(this);
    schools = SchoolsApi(this);
    users = UsersApi(this);
  }

  Future<SyncOutput> sync(
      {required List<int> courseIds,
      required List<int> classIds,
      required List<int> yearIds,
      required List<int> userIds,
      DateTime? lastSync}) async {
    final input = SyncInput(
        courseIds: courseIds,
        classIds: classIds,
        yearIds: yearIds,
        userIds: userIds,
        lastSync: lastSync);

    final payload = {
      "json": input.toJson(),
      "meta": {
        "values": {
          "lastSync": ["Date"]
        }
      },
    };
    final uri = Uri.https(
        "studienbuch.app", "api/trpc/sync", {"input": jsonEncode(payload)});
    final response = await client.get(uri, headers: {
      'x-trpc-source': 'mobile-app',
    });

    if (response.statusCode != 200) {
      throw Exception('Failed to get sync: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return SyncOutput.fromJson(json['result']['data']['json']);
  }

  void dispose() {
    client.close();
  }
}

abstract class BaseApi {
  final ApiClient _client;

  BaseApi(this._client);

  http.Client get client => _client.client;

  Uri get baseUri => _client.baseUri;
}

class LicenseApi extends BaseApi {
  LicenseApi(super.client);

  Future<LicenseCheckOutputEnum> check({required String licenseKey}) async {
    final input = LicenseCheckInput(licenseKey: licenseKey);

    final payload = {
      "json": input.toJson(),
    };
    final uri = Uri.https("studienbuch.app", "api/trpc/license.check",
        {"input": jsonEncode(payload)});
    final response = await client.get(uri, headers: {
      'x-trpc-source': 'mobile-app',
    });

    if (response.statusCode != 200) {
      throw Exception('Failed to get license.check: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return LicenseCheckOutputEnum.fromJson(json['result']['data']['json']);
  }

  Future<void> activate({required String licenseKey}) async {
    final input = LicenseCheckInput(licenseKey: licenseKey);

    final uri = Uri.https("studienbuch.app", "api/trpc/license.activate");
    final payload = {
      "json": input.toJson(),
    };

    final response = await client.post(uri,
        headers: <String, String>{
          'Content-Type': 'application/json; charset=UTF-8',
          'x-trpc-source': 'mobile-app',
        },
        body: jsonEncode(payload));

    if (response.statusCode != 200) {
      throw Exception('Failed to get license.activate: ${response.body}');
    }
  }
}

class YearsApi extends BaseApi {
  YearsApi(super.client);

  Future<List<YearsGetOutput>> get() async {
    final uri = Uri.https("studienbuch.app", "api/trpc/years.get");
    final response = await client.get(uri, headers: {
      'x-trpc-source': 'mobile-app',
    });

    if (response.statusCode != 200) {
      throw Exception('Failed to get years.get: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return (json['result']['data']['json'] as List<dynamic>)
        .map<YearsGetOutput>((e) => YearsGetOutput.fromJson(e))
        .toList();
  }

  Future<List<YearsListOutput>> list({num? school}) async {
    final input = YearsListInput(school: school);

    final payload = {
      "json": input.toJson(),
    };
    final uri = Uri.https("studienbuch.app", "api/trpc/years.list",
        {"input": jsonEncode(payload)});
    final response = await client.get(uri, headers: {
      'x-trpc-source': 'mobile-app',
    });

    if (response.statusCode != 200) {
      throw Exception('Failed to get years.list: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return (json['result']['data']['json'] as List<dynamic>)
        .map<YearsListOutput>((e) => YearsListOutput.fromJson(e))
        .toList();
  }

  Future<List<YearsListGroupedBySchoolOutput>> listGroupedBySchool() async {
    final uri =
        Uri.https("studienbuch.app", "api/trpc/years.listGroupedBySchool");
    final response = await client.get(uri, headers: {
      'x-trpc-source': 'mobile-app',
    });

    if (response.statusCode != 200) {
      throw Exception(
          'Failed to get years.listGroupedBySchool: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return (json['result']['data']['json'] as List<dynamic>)
        .map<YearsListGroupedBySchoolOutput>(
            (e) => YearsListGroupedBySchoolOutput.fromJson(e))
        .toList();
  }

  Future<YearsListGroupedBySchoolOutputYears> getOne(num input) async {
    final payload = {
      "json": input,
    };
    final uri = Uri.https("studienbuch.app", "api/trpc/years.getOne",
        {"input": jsonEncode(payload)});
    final response = await client.get(uri, headers: {
      'x-trpc-source': 'mobile-app',
    });

    if (response.statusCode != 200) {
      throw Exception('Failed to get years.getOne: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return YearsListGroupedBySchoolOutputYears.fromJson(
        json['result']['data']['json']);
  }

  Future<YearsListGroupedBySchoolOutputYears> add(
      {required String name,
      required num startYear,
      required num graduationYear,
      required int schoolId}) async {
    final input = YearsAddInput(
        name: name,
        startYear: startYear,
        graduationYear: graduationYear,
        schoolId: schoolId);

    final uri = Uri.https("studienbuch.app", "api/trpc/years.add");
    final payload = {
      "json": input.toJson(),
    };

    final response = await client.post(uri,
        headers: <String, String>{
          'Content-Type': 'application/json; charset=UTF-8',
          'x-trpc-source': 'mobile-app',
        },
        body: jsonEncode(payload));

    if (response.statusCode != 200) {
      throw Exception('Failed to get years.add: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return YearsListGroupedBySchoolOutputYears.fromJson(
        json['result']['data']['json']);
  }

  Future<YearsListGroupedBySchoolOutputYears> update(
      {required String name,
      required int id,
      required num startYear,
      required num graduationYear,
      required int schoolId}) async {
    final input = YearsUpdateInput(
        name: name,
        id: id,
        startYear: startYear,
        graduationYear: graduationYear,
        schoolId: schoolId);

    final uri = Uri.https("studienbuch.app", "api/trpc/years.update");
    final payload = {
      "json": input.toJson(),
    };

    final response = await client.post(uri,
        headers: <String, String>{
          'Content-Type': 'application/json; charset=UTF-8',
          'x-trpc-source': 'mobile-app',
        },
        body: jsonEncode(payload));

    if (response.statusCode != 200) {
      throw Exception('Failed to get years.update: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return YearsListGroupedBySchoolOutputYears.fromJson(
        json['result']['data']['json']);
  }
}

class ClassesApi extends BaseApi {
  ClassesApi(super.client);

  Future<List<ClassesListOutput>> list({required int yearId}) async {
    final input = ClassesListInput(yearId: yearId);

    final payload = {
      "json": input.toJson(),
    };
    final uri = Uri.https("studienbuch.app", "api/trpc/classes.list",
        {"input": jsonEncode(payload)});
    final response = await client.get(uri, headers: {
      'x-trpc-source': 'mobile-app',
    });

    if (response.statusCode != 200) {
      throw Exception('Failed to get classes.list: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return (json['result']['data']['json'] as List<dynamic>)
        .map<ClassesListOutput>((e) => ClassesListOutput.fromJson(e))
        .toList();
  }
}

class CoursesApi extends BaseApi {
  CoursesApi(super.client);

  Future<List<CoursesListOutput>> list({required int yearId}) async {
    final input = ClassesListInput(yearId: yearId);

    final payload = {
      "json": input.toJson(),
    };
    final uri = Uri.https("studienbuch.app", "api/trpc/courses.list",
        {"input": jsonEncode(payload)});
    final response = await client.get(uri, headers: {
      'x-trpc-source': 'mobile-app',
    });

    if (response.statusCode != 200) {
      throw Exception('Failed to get courses.list: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return (json['result']['data']['json'] as List<dynamic>)
        .map<CoursesListOutput>((e) => CoursesListOutput.fromJson(e))
        .toList();
  }

  Future<void> addCourses(
      {required List<CoursesAddCoursesInputCourses> courses,
      required int yearId,
      required int classId}) async {
    final input = CoursesAddCoursesInput(
        courses: courses, yearId: yearId, classId: classId);

    final uri = Uri.https("studienbuch.app", "api/trpc/courses.addCourses");
    final payload = {
      "json": input.toJson(),
    };

    final response = await client.post(uri,
        headers: <String, String>{
          'Content-Type': 'application/json; charset=UTF-8',
          'x-trpc-source': 'mobile-app',
        },
        body: jsonEncode(payload));

    if (response.statusCode != 200) {
      throw Exception('Failed to get courses.addCourses: ${response.body}');
    }
  }
}

class SubstitutionsApi extends BaseApi {
  SubstitutionsApi(super.client);

  Future<List<SubstitutionsGetOutput>> get({DateTime? date}) async {
    final input = SubstitutionsGetInput(date: date);

    final payload = {
      "json": input.toJson(),
      "meta": {
        "values": {
          "date": ["Date"]
        }
      },
    };
    final uri = Uri.https("studienbuch.app", "api/trpc/substitutions.get",
        {"input": jsonEncode(payload)});
    final response = await client.get(uri, headers: {
      'x-trpc-source': 'mobile-app',
    });

    if (response.statusCode != 200) {
      throw Exception('Failed to get substitutions.get: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return (json['result']['data']['json'] as List<dynamic>)
        .map<SubstitutionsGetOutput>((e) => SubstitutionsGetOutput.fromJson(e))
        .toList();
  }
}

class SubscriptionsApi extends BaseApi {
  SubscriptionsApi(super.client);

  Future<void> subscribe(
      {required List<num> courses, required String messagingToken}) async {
    final input = SubscriptionsSubscribeInput(
        courses: courses, messagingToken: messagingToken);

    final uri =
        Uri.https("studienbuch.app", "api/trpc/subscriptions.subscribe");
    final payload = {
      "json": input.toJson(),
    };

    final response = await client.post(uri,
        headers: <String, String>{
          'Content-Type': 'application/json; charset=UTF-8',
          'x-trpc-source': 'mobile-app',
        },
        body: jsonEncode(payload));

    if (response.statusCode != 200) {
      throw Exception(
          'Failed to get subscriptions.subscribe: ${response.body}');
    }
  }
}

class AuthApi extends BaseApi {
  AuthApi(super.client);

  Future<AuthGetSessionOutput?> getSession() async {
    final uri = Uri.https("studienbuch.app", "api/trpc/auth.getSession");
    final response = await client.get(uri, headers: {
      'x-trpc-source': 'mobile-app',
    });

    if (response.statusCode != 200) {
      throw Exception('Failed to get auth.getSession: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return json['result']['data']['json'] != null
        ? AuthGetSessionOutput.fromJson(json['result']['data']['json'])
        : null;
  }

  Future<AuthGetPermissionsOutput> getPermissions() async {
    final uri = Uri.https("studienbuch.app", "api/trpc/auth.getPermissions");
    final response = await client.get(uri, headers: {
      'x-trpc-source': 'mobile-app',
    });

    if (response.statusCode != 200) {
      throw Exception('Failed to get auth.getPermissions: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return AuthGetPermissionsOutput.fromJson(json['result']['data']['json']);
  }

  Future<void> logout() async {
    final uri = Uri.https("studienbuch.app", "api/trpc/auth.logout");
    final payload = {
      "json": null,
    };

    final response = await client.post(uri,
        headers: <String, String>{
          'Content-Type': 'application/json; charset=UTF-8',
          'x-trpc-source': 'mobile-app',
        },
        body: jsonEncode(payload));

    if (response.statusCode != 200) {
      throw Exception('Failed to get auth.logout: ${response.body}');
    }
  }
}

class SchoolsApi extends BaseApi {
  SchoolsApi(super.client);

  Future<List<YearsListOutputSchool>> list() async {
    final uri = Uri.https("studienbuch.app", "api/trpc/schools.list");
    final response = await client.get(uri, headers: {
      'x-trpc-source': 'mobile-app',
    });

    if (response.statusCode != 200) {
      throw Exception('Failed to get schools.list: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return (json['result']['data']['json'] as List<dynamic>)
        .map<YearsListOutputSchool>((e) => YearsListOutputSchool.fromJson(e))
        .toList();
  }

  Future<YearsListOutputSchool> setTheme(
      {required num school,
      required String image,
      required SchoolsSetThemeInputTheme theme}) async {
    final input =
        SchoolsSetThemeInput(school: school, image: image, theme: theme);

    final uri = Uri.https("studienbuch.app", "api/trpc/schools.setTheme");
    final payload = {
      "json": input.toJson(),
    };

    final response = await client.post(uri,
        headers: <String, String>{
          'Content-Type': 'application/json; charset=UTF-8',
          'x-trpc-source': 'mobile-app',
        },
        body: jsonEncode(payload));

    if (response.statusCode != 200) {
      throw Exception('Failed to get schools.setTheme: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return YearsListOutputSchool.fromJson(json['result']['data']['json']);
  }

  Future<SchoolsGetThemeOutput> getTheme(num input) async {
    final payload = {
      "json": input,
    };
    final uri = Uri.https("studienbuch.app", "api/trpc/schools.getTheme",
        {"input": jsonEncode(payload)});
    final response = await client.get(uri, headers: {
      'x-trpc-source': 'mobile-app',
    });

    if (response.statusCode != 200) {
      throw Exception('Failed to get schools.getTheme: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return SchoolsGetThemeOutput.fromJson(json['result']['data']['json']);
  }
}

class UsersApi extends BaseApi {
  UsersApi(super.client);

  Future<List<UsersListOutput>> list() async {
    final uri = Uri.https("studienbuch.app", "api/trpc/users.list");
    final response = await client.get(uri, headers: {
      'x-trpc-source': 'mobile-app',
    });

    if (response.statusCode != 200) {
      throw Exception('Failed to get users.list: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return (json['result']['data']['json'] as List<dynamic>)
        .map<UsersListOutput>((e) => UsersListOutput.fromJson(e))
        .toList();
  }

  Future<void> updateMany(List<UsersUpdateManyInput> input) async {
    final uri = Uri.https("studienbuch.app", "api/trpc/users.updateMany");
    final payload = {
      "json": input.map((e) => e.toJson()).toList(),
    };

    final response = await client.post(uri,
        headers: <String, String>{
          'Content-Type': 'application/json; charset=UTF-8',
          'x-trpc-source': 'mobile-app',
        },
        body: jsonEncode(payload));

    if (response.statusCode != 200) {
      throw Exception('Failed to get users.updateMany: ${response.body}');
    }
  }

  Future<UsersAddOutput> add(
      {required String name,
      String? email,
      String? password,
      String? title,
      String? abbrv}) async {
    final input = UsersAddInput(
        name: name,
        email: email,
        password: password,
        title: title,
        abbrv: abbrv);

    final uri = Uri.https("studienbuch.app", "api/trpc/users.add");
    final payload = {
      "json": input.toJson(),
    };

    final response = await client.post(uri,
        headers: <String, String>{
          'Content-Type': 'application/json; charset=UTF-8',
          'x-trpc-source': 'mobile-app',
        },
        body: jsonEncode(payload));

    if (response.statusCode != 200) {
      throw Exception('Failed to get users.add: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return UsersAddOutput.fromJson(json['result']['data']['json']);
  }

  Future<void> updatePassword(
      {required int id, required String password}) async {
    final input = UsersUpdatePasswordInput(id: id, password: password);

    final uri = Uri.https("studienbuch.app", "api/trpc/users.updatePassword");
    final payload = {
      "json": input.toJson(),
    };

    final response = await client.post(uri,
        headers: <String, String>{
          'Content-Type': 'application/json; charset=UTF-8',
          'x-trpc-source': 'mobile-app',
        },
        body: jsonEncode(payload));

    if (response.statusCode != 200) {
      throw Exception('Failed to get users.updatePassword: ${response.body}');
    }
  }

  Future<void> delete(num input) async {
    final uri = Uri.https("studienbuch.app", "api/trpc/users.delete");
    final payload = {
      "json": input,
    };

    final response = await client.post(uri,
        headers: <String, String>{
          'Content-Type': 'application/json; charset=UTF-8',
          'x-trpc-source': 'mobile-app',
        },
        body: jsonEncode(payload));

    if (response.statusCode != 200) {
      throw Exception('Failed to get users.delete: ${response.body}');
    }
  }

  Future<List<UsersListScopeOptionsOutput>> listScopeOptions(
      UsersListScopeOptionsInputEnum input) async {
    final payload = {
      "json": input.toString(),
    };
    final uri = Uri.https("studienbuch.app", "api/trpc/users.listScopeOptions",
        {"input": jsonEncode(payload)});
    final response = await client.get(uri, headers: {
      'x-trpc-source': 'mobile-app',
    });

    if (response.statusCode != 200) {
      throw Exception('Failed to get users.listScopeOptions: ${response.body}');
    }

    final json = jsonDecode(utf8.decode(response.bodyBytes));
    return (json['result']['data']['json'] as List<dynamic>)
        .map<UsersListScopeOptionsOutput>(
            (e) => UsersListScopeOptionsOutput.fromJson(e))
        .toList();
  }

  Future<void> setPermissions(
      {required int userId,
      required bool isSuperUser,
      required List<UsersSetPermissionsInputPermissions> permissions}) async {
    final input = UsersSetPermissionsInput(
        userId: userId, isSuperUser: isSuperUser, permissions: permissions);

    final uri = Uri.https("studienbuch.app", "api/trpc/users.setPermissions");
    final payload = {
      "json": input.toJson(),
    };

    final response = await client.post(uri,
        headers: <String, String>{
          'Content-Type': 'application/json; charset=UTF-8',
          'x-trpc-source': 'mobile-app',
        },
        body: jsonEncode(payload));

    if (response.statusCode != 200) {
      throw Exception('Failed to get users.setPermissions: ${response.body}');
    }
  }
}
