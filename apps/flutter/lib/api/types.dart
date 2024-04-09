// ignore_for_file: unnecessary_question_mark

class SyncInput  {
      final List<int> courseIds;
final List<int> classIds;
final List<int> yearIds;
final List<int> userIds;
final DateTime? lastSync;
  
      SyncInput({
        required this.courseIds,
required this.classIds,
required this.yearIds,
required this.userIds,
required this.lastSync
      });
  
      factory SyncInput.fromJson(dynamic json) {
        return SyncInput(
          courseIds: (json['courseIds'] as List<dynamic>).map<int>((e) => e).toList(),
classIds: (json['classIds'] as List<dynamic>).map<int>((e) => e).toList(),
yearIds: (json['yearIds'] as List<dynamic>).map<int>((e) => e).toList(),
userIds: (json['userIds'] as List<dynamic>).map<int>((e) => e).toList(),
lastSync: json['lastSync'] != null ? DateTime.parse(json['lastSync']) : null
        );
      }
      
      dynamic toJson() {
        return {
          'courseIds': courseIds.map((e) => e).toList(),
'classIds': classIds.map((e) => e).toList(),
'yearIds': yearIds.map((e) => e).toList(),
'userIds': userIds.map((e) => e).toList(),
'lastSync': lastSync?.toIso8601String()
        };
      }
    }
class SyncOutputUpdatedCourses  {
      final String name;
final int id;
final DateTime createdAt;
final DateTime updatedAt;
final int yearId;
final String courseId;
final String? room;
final bool isChoosable;
final int teacherId;
final int classId;
  
      SyncOutputUpdatedCourses({
        required this.name,
required this.id,
required this.createdAt,
required this.updatedAt,
required this.yearId,
required this.courseId,
required this.room,
required this.isChoosable,
required this.teacherId,
required this.classId
      });
  
      factory SyncOutputUpdatedCourses.fromJson(dynamic json) {
        return SyncOutputUpdatedCourses(
          name: json['name'],
id: json['id'],
createdAt: DateTime.parse(json['createdAt']),
updatedAt: DateTime.parse(json['updatedAt']),
yearId: json['yearId'],
courseId: json['courseId'],
room: json['room'],
isChoosable: json['isChoosable'],
teacherId: json['teacherId'],
classId: json['classId']
        );
      }
      
      dynamic toJson() {
        return {
          'name': name,
'id': id,
'createdAt': createdAt.toIso8601String(),
'updatedAt': updatedAt.toIso8601String(),
'yearId': yearId,
'courseId': courseId,
'room': room,
'isChoosable': isChoosable,
'teacherId': teacherId,
'classId': classId
        };
      }
    }
enum SyncOutputUpdatedCourseTimesWeeksEnum {
        even,
odd,
both;
  
        factory SyncOutputUpdatedCourseTimesWeeksEnum.fromJson(String json) {
        switch (json) {
          case 'EVEN': return SyncOutputUpdatedCourseTimesWeeksEnum.even;
case 'ODD': return SyncOutputUpdatedCourseTimesWeeksEnum.odd;
case 'BOTH': return SyncOutputUpdatedCourseTimesWeeksEnum.both;
          default: throw Exception('Unknown enum value: $json');
        }
      }
      }
class SyncOutputUpdatedCourseTimes  {
      final int id;
final DateTime createdAt;
final DateTime updatedAt;
final int? courseId;
final SyncOutputUpdatedCourseTimesWeeksEnum weeks;
final num weekday;
final num start;
final num duration;
  
      SyncOutputUpdatedCourseTimes({
        required this.id,
required this.createdAt,
required this.updatedAt,
required this.courseId,
required this.weeks,
required this.weekday,
required this.start,
required this.duration
      });
  
      factory SyncOutputUpdatedCourseTimes.fromJson(dynamic json) {
        return SyncOutputUpdatedCourseTimes(
          id: json['id'],
createdAt: DateTime.parse(json['createdAt']),
updatedAt: DateTime.parse(json['updatedAt']),
courseId: json['courseId'],
weeks: SyncOutputUpdatedCourseTimesWeeksEnum.fromJson(json['weeks']),
weekday: json['weekday'],
start: json['start'],
duration: json['duration']
        );
      }
      
      dynamic toJson() {
        return {
          'id': id,
'createdAt': createdAt.toIso8601String(),
'updatedAt': updatedAt.toIso8601String(),
'courseId': courseId,
'weeks': weeks.toString(),
'weekday': weekday,
'start': start,
'duration': duration
        };
      }
    }
class SyncOutputUpdatedClasses  {
      final int id;
final DateTime createdAt;
final DateTime updatedAt;
final int yearId;
final String identifierInYear;
  
      SyncOutputUpdatedClasses({
        required this.id,
required this.createdAt,
required this.updatedAt,
required this.yearId,
required this.identifierInYear
      });
  
      factory SyncOutputUpdatedClasses.fromJson(dynamic json) {
        return SyncOutputUpdatedClasses(
          id: json['id'],
createdAt: DateTime.parse(json['createdAt']),
updatedAt: DateTime.parse(json['updatedAt']),
yearId: json['yearId'],
identifierInYear: json['identifierInYear']
        );
      }
      
      dynamic toJson() {
        return {
          'id': id,
'createdAt': createdAt.toIso8601String(),
'updatedAt': updatedAt.toIso8601String(),
'yearId': yearId,
'identifierInYear': identifierInYear
        };
      }
    }
class SyncOutputUpdatedYears  {
      final String name;
final int id;
final DateTime createdAt;
final DateTime updatedAt;
final num startYear;
final num graduationYear;
final int schoolId;
  
      SyncOutputUpdatedYears({
        required this.name,
required this.id,
required this.createdAt,
required this.updatedAt,
required this.startYear,
required this.graduationYear,
required this.schoolId
      });
  
      factory SyncOutputUpdatedYears.fromJson(dynamic json) {
        return SyncOutputUpdatedYears(
          name: json['name'],
id: json['id'],
createdAt: DateTime.parse(json['createdAt']),
updatedAt: DateTime.parse(json['updatedAt']),
startYear: json['startYear'],
graduationYear: json['graduationYear'],
schoolId: json['schoolId']
        );
      }
      
      dynamic toJson() {
        return {
          'name': name,
'id': id,
'createdAt': createdAt.toIso8601String(),
'updatedAt': updatedAt.toIso8601String(),
'startYear': startYear,
'graduationYear': graduationYear,
'schoolId': schoolId
        };
      }
    }
class SyncOutputUpdatedUsers  {
      final String role;
final String name;
final int id;
final String? email;
final String? passwordHash;
final String? title;
final String? abbrv;
final DateTime createdAt;
final DateTime updatedAt;
final DateTime? emailVerified;
final String? image;
final bool isSuperUser;
  
      SyncOutputUpdatedUsers({
        required this.role,
required this.name,
required this.id,
required this.email,
required this.passwordHash,
required this.title,
required this.abbrv,
required this.createdAt,
required this.updatedAt,
required this.emailVerified,
required this.image,
required this.isSuperUser
      });
  
      factory SyncOutputUpdatedUsers.fromJson(dynamic json) {
        return SyncOutputUpdatedUsers(
          role: json['role'],
name: json['name'],
id: json['id'],
email: json['email'],
passwordHash: json['passwordHash'],
title: json['title'],
abbrv: json['abbrv'],
createdAt: DateTime.parse(json['createdAt']),
updatedAt: DateTime.parse(json['updatedAt']),
emailVerified: json['emailVerified'] != null ? DateTime.parse(json['emailVerified']) : null,
image: json['image'],
isSuperUser: json['isSuperUser']
        );
      }
      
      dynamic toJson() {
        return {
          'role': role,
'name': name,
'id': id,
'email': email,
'passwordHash': passwordHash,
'title': title,
'abbrv': abbrv,
'createdAt': createdAt.toIso8601String(),
'updatedAt': updatedAt.toIso8601String(),
'emailVerified': emailVerified?.toIso8601String(),
'image': image,
'isSuperUser': isSuperUser
        };
      }
    }
class SyncOutput  {
      final List<SyncOutputUpdatedCourses> updatedCourses;
final List<SyncOutputUpdatedCourseTimes> updatedCourseTimes;
final List<SyncOutputUpdatedClasses> updatedClasses;
final List<SyncOutputUpdatedYears> updatedYears;
final List<SyncOutputUpdatedUsers> updatedUsers;
  
      SyncOutput({
        required this.updatedCourses,
required this.updatedCourseTimes,
required this.updatedClasses,
required this.updatedYears,
required this.updatedUsers
      });
  
      factory SyncOutput.fromJson(dynamic json) {
        return SyncOutput(
          updatedCourses: (json['updatedCourses'] as List<dynamic>).map<SyncOutputUpdatedCourses>((e) => SyncOutputUpdatedCourses.fromJson(e)).toList(),
updatedCourseTimes: (json['updatedCourseTimes'] as List<dynamic>).map<SyncOutputUpdatedCourseTimes>((e) => SyncOutputUpdatedCourseTimes.fromJson(e)).toList(),
updatedClasses: (json['updatedClasses'] as List<dynamic>).map<SyncOutputUpdatedClasses>((e) => SyncOutputUpdatedClasses.fromJson(e)).toList(),
updatedYears: (json['updatedYears'] as List<dynamic>).map<SyncOutputUpdatedYears>((e) => SyncOutputUpdatedYears.fromJson(e)).toList(),
updatedUsers: (json['updatedUsers'] as List<dynamic>).map<SyncOutputUpdatedUsers>((e) => SyncOutputUpdatedUsers.fromJson(e)).toList()
        );
      }
      
      dynamic toJson() {
        return {
          'updatedCourses': updatedCourses.map((e) => e.toJson()).toList(),
'updatedCourseTimes': updatedCourseTimes.map((e) => e.toJson()).toList(),
'updatedClasses': updatedClasses.map((e) => e.toJson()).toList(),
'updatedYears': updatedYears.map((e) => e.toJson()).toList(),
'updatedUsers': updatedUsers.map((e) => e.toJson()).toList()
        };
      }
    }
class LicenseCheckInput  {
      final String licenseKey;
  
      LicenseCheckInput({
        required this.licenseKey
      });
  
      factory LicenseCheckInput.fromJson(dynamic json) {
        return LicenseCheckInput(
          licenseKey: json['licenseKey']
        );
      }
      
      dynamic toJson() {
        return {
          'licenseKey': licenseKey
        };
      }
    }
enum LicenseCheckOutputEnum {
        invalid,
expired,
activated,
valid;
  
        factory LicenseCheckOutputEnum.fromJson(String json) {
        switch (json) {
          case 'INVALID': return LicenseCheckOutputEnum.invalid;
case 'EXPIRED': return LicenseCheckOutputEnum.expired;
case 'ACTIVATED': return LicenseCheckOutputEnum.activated;
case 'VALID': return LicenseCheckOutputEnum.valid;
          default: throw Exception('Unknown enum value: $json');
        }
      }
      }
class YearsGetOutput  {
      final String name;
final int id;
final DateTime updatedAt;
final num startYear;
final num graduationYear;
final int schoolId;
  
      YearsGetOutput({
        required this.name,
required this.id,
required this.updatedAt,
required this.startYear,
required this.graduationYear,
required this.schoolId
      });
  
      factory YearsGetOutput.fromJson(dynamic json) {
        return YearsGetOutput(
          name: json['name'],
id: json['id'],
updatedAt: DateTime.parse(json['updatedAt']),
startYear: json['startYear'],
graduationYear: json['graduationYear'],
schoolId: json['schoolId']
        );
      }
      
      dynamic toJson() {
        return {
          'name': name,
'id': id,
'updatedAt': updatedAt.toIso8601String(),
'startYear': startYear,
'graduationYear': graduationYear,
'schoolId': schoolId
        };
      }
    }
class YearsListOutputSchool  {
      final int id;
final String name;
final DateTime createdAt;
final DateTime updatedAt;
  
      YearsListOutputSchool({
        required this.id,
required this.name,
required this.createdAt,
required this.updatedAt
      });
  
      factory YearsListOutputSchool.fromJson(dynamic json) {
        return YearsListOutputSchool(
          id: json['id'],
name: json['name'],
createdAt: DateTime.parse(json['createdAt']),
updatedAt: DateTime.parse(json['updatedAt'])
        );
      }
      
      dynamic toJson() {
        return {
          'id': id,
'name': name,
'createdAt': createdAt.toIso8601String(),
'updatedAt': updatedAt.toIso8601String()
        };
      }
    }
class YearsListOutput  {
      final YearsListOutputSchool school;
final int id;
final num startYear;
final num graduationYear;
final String name;
final DateTime createdAt;
final DateTime updatedAt;
final int schoolId;
  
      YearsListOutput({
        required this.school,
required this.id,
required this.startYear,
required this.graduationYear,
required this.name,
required this.createdAt,
required this.updatedAt,
required this.schoolId
      });
  
      factory YearsListOutput.fromJson(dynamic json) {
        return YearsListOutput(
          school: YearsListOutputSchool.fromJson(json['school']),
id: json['id'],
startYear: json['startYear'],
graduationYear: json['graduationYear'],
name: json['name'],
createdAt: DateTime.parse(json['createdAt']),
updatedAt: DateTime.parse(json['updatedAt']),
schoolId: json['schoolId']
        );
      }
      
      dynamic toJson() {
        return {
          'school': school.toJson(),
'id': id,
'startYear': startYear,
'graduationYear': graduationYear,
'name': name,
'createdAt': createdAt.toIso8601String(),
'updatedAt': updatedAt.toIso8601String(),
'schoolId': schoolId
        };
      }
    }
class YearsListGroupedBySchoolOutputYears  {
      final int id;
final num startYear;
final num graduationYear;
final String name;
final DateTime createdAt;
final DateTime updatedAt;
final int schoolId;
  
      YearsListGroupedBySchoolOutputYears({
        required this.id,
required this.startYear,
required this.graduationYear,
required this.name,
required this.createdAt,
required this.updatedAt,
required this.schoolId
      });
  
      factory YearsListGroupedBySchoolOutputYears.fromJson(dynamic json) {
        return YearsListGroupedBySchoolOutputYears(
          id: json['id'],
startYear: json['startYear'],
graduationYear: json['graduationYear'],
name: json['name'],
createdAt: DateTime.parse(json['createdAt']),
updatedAt: DateTime.parse(json['updatedAt']),
schoolId: json['schoolId']
        );
      }
      
      dynamic toJson() {
        return {
          'id': id,
'startYear': startYear,
'graduationYear': graduationYear,
'name': name,
'createdAt': createdAt.toIso8601String(),
'updatedAt': updatedAt.toIso8601String(),
'schoolId': schoolId
        };
      }
    }
class YearsListGroupedBySchoolOutput  {
      final List<YearsListGroupedBySchoolOutputYears> years;
final int id;
final String name;
final DateTime createdAt;
final DateTime updatedAt;
  
      YearsListGroupedBySchoolOutput({
        required this.years,
required this.id,
required this.name,
required this.createdAt,
required this.updatedAt
      });
  
      factory YearsListGroupedBySchoolOutput.fromJson(dynamic json) {
        return YearsListGroupedBySchoolOutput(
          years: (json['years'] as List<dynamic>).map<YearsListGroupedBySchoolOutputYears>((e) => YearsListGroupedBySchoolOutputYears.fromJson(e)).toList(),
id: json['id'],
name: json['name'],
createdAt: DateTime.parse(json['createdAt']),
updatedAt: DateTime.parse(json['updatedAt'])
        );
      }
      
      dynamic toJson() {
        return {
          'years': years.map((e) => e.toJson()).toList(),
'id': id,
'name': name,
'createdAt': createdAt.toIso8601String(),
'updatedAt': updatedAt.toIso8601String()
        };
      }
    }
class YearsAddInput  {
      final String name;
final num startYear;
final num graduationYear;
final int schoolId;
  
      YearsAddInput({
        required this.name,
required this.startYear,
required this.graduationYear,
required this.schoolId
      });
  
      factory YearsAddInput.fromJson(dynamic json) {
        return YearsAddInput(
          name: json['name'],
startYear: json['startYear'],
graduationYear: json['graduationYear'],
schoolId: json['schoolId']
        );
      }
      
      dynamic toJson() {
        return {
          'name': name,
'startYear': startYear,
'graduationYear': graduationYear,
'schoolId': schoolId
        };
      }
    }
class YearsUpdateInput  {
      final String name;
final int id;
final num startYear;
final num graduationYear;
final int schoolId;
  
      YearsUpdateInput({
        required this.name,
required this.id,
required this.startYear,
required this.graduationYear,
required this.schoolId
      });
  
      factory YearsUpdateInput.fromJson(dynamic json) {
        return YearsUpdateInput(
          name: json['name'],
id: json['id'],
startYear: json['startYear'],
graduationYear: json['graduationYear'],
schoolId: json['schoolId']
        );
      }
      
      dynamic toJson() {
        return {
          'name': name,
'id': id,
'startYear': startYear,
'graduationYear': graduationYear,
'schoolId': schoolId
        };
      }
    }
class ClassesListInput  {
      final int yearId;
  
      ClassesListInput({
        required this.yearId
      });
  
      factory ClassesListInput.fromJson(dynamic json) {
        return ClassesListInput(
          yearId: json['yearId']
        );
      }
      
      dynamic toJson() {
        return {
          'yearId': yearId
        };
      }
    }
class ClassesListOutputCourses  {
      final String name;
final int id;
final DateTime createdAt;
final DateTime updatedAt;
final int yearId;
final String courseId;
final String? room;
final bool isChoosable;
final int teacherId;
final int classId;
final SyncOutputUpdatedUsers teacher;
final List<SyncOutputUpdatedCourseTimes> times;
  
      ClassesListOutputCourses({
        required this.name,
required this.id,
required this.createdAt,
required this.updatedAt,
required this.yearId,
required this.courseId,
required this.room,
required this.isChoosable,
required this.teacherId,
required this.classId,
required this.teacher,
required this.times
      });
  
      factory ClassesListOutputCourses.fromJson(dynamic json) {
        return ClassesListOutputCourses(
          name: json['name'],
id: json['id'],
createdAt: DateTime.parse(json['createdAt']),
updatedAt: DateTime.parse(json['updatedAt']),
yearId: json['yearId'],
courseId: json['courseId'],
room: json['room'],
isChoosable: json['isChoosable'],
teacherId: json['teacherId'],
classId: json['classId'],
teacher: SyncOutputUpdatedUsers.fromJson(json['teacher']),
times: (json['times'] as List<dynamic>).map<SyncOutputUpdatedCourseTimes>((e) => SyncOutputUpdatedCourseTimes.fromJson(e)).toList()
        );
      }
      
      dynamic toJson() {
        return {
          'name': name,
'id': id,
'createdAt': createdAt.toIso8601String(),
'updatedAt': updatedAt.toIso8601String(),
'yearId': yearId,
'courseId': courseId,
'room': room,
'isChoosable': isChoosable,
'teacherId': teacherId,
'classId': classId,
'teacher': teacher.toJson(),
'times': times.map((e) => e.toJson()).toList()
        };
      }
    }
class ClassesListOutput  {
      final int id;
final DateTime createdAt;
final DateTime updatedAt;
final List<ClassesListOutputCourses> courses;
final int yearId;
final String identifierInYear;
  
      ClassesListOutput({
        required this.id,
required this.createdAt,
required this.updatedAt,
required this.courses,
required this.yearId,
required this.identifierInYear
      });
  
      factory ClassesListOutput.fromJson(dynamic json) {
        return ClassesListOutput(
          id: json['id'],
createdAt: DateTime.parse(json['createdAt']),
updatedAt: DateTime.parse(json['updatedAt']),
courses: (json['courses'] as List<dynamic>).map<ClassesListOutputCourses>((e) => ClassesListOutputCourses.fromJson(e)).toList(),
yearId: json['yearId'],
identifierInYear: json['identifierInYear']
        );
      }
      
      dynamic toJson() {
        return {
          'id': id,
'createdAt': createdAt.toIso8601String(),
'updatedAt': updatedAt.toIso8601String(),
'courses': courses.map((e) => e.toJson()).toList(),
'yearId': yearId,
'identifierInYear': identifierInYear
        };
      }
    }
class CoursesListOutputTeacher  {
      final String name;
final int id;
final String? title;
  
      CoursesListOutputTeacher({
        required this.name,
required this.id,
required this.title
      });
  
      factory CoursesListOutputTeacher.fromJson(dynamic json) {
        return CoursesListOutputTeacher(
          name: json['name'],
id: json['id'],
title: json['title']
        );
      }
      
      dynamic toJson() {
        return {
          'name': name,
'id': id,
'title': title
        };
      }
    }
class CoursesListOutput  {
      final String name;
final int id;
final DateTime updatedAt;
final int yearId;
final String courseId;
final String? room;
final bool isChoosable;
final int teacherId;
final int classId;
final CoursesListOutputTeacher teacher;
final List<SyncOutputUpdatedCourseTimes> times;
  
      CoursesListOutput({
        required this.name,
required this.id,
required this.updatedAt,
required this.yearId,
required this.courseId,
required this.room,
required this.isChoosable,
required this.teacherId,
required this.classId,
required this.teacher,
required this.times
      });
  
      factory CoursesListOutput.fromJson(dynamic json) {
        return CoursesListOutput(
          name: json['name'],
id: json['id'],
updatedAt: DateTime.parse(json['updatedAt']),
yearId: json['yearId'],
courseId: json['courseId'],
room: json['room'],
isChoosable: json['isChoosable'],
teacherId: json['teacherId'],
classId: json['classId'],
teacher: CoursesListOutputTeacher.fromJson(json['teacher']),
times: (json['times'] as List<dynamic>).map<SyncOutputUpdatedCourseTimes>((e) => SyncOutputUpdatedCourseTimes.fromJson(e)).toList()
        );
      }
      
      dynamic toJson() {
        return {
          'name': name,
'id': id,
'updatedAt': updatedAt.toIso8601String(),
'yearId': yearId,
'courseId': courseId,
'room': room,
'isChoosable': isChoosable,
'teacherId': teacherId,
'classId': classId,
'teacher': teacher.toJson(),
'times': times.map((e) => e.toJson()).toList()
        };
      }
    }
class CoursesAddCoursesInputCoursesTimes  {
      final SyncOutputUpdatedCourseTimesWeeksEnum weeks;
final num weekday;
final num start;
final num duration;
  
      CoursesAddCoursesInputCoursesTimes({
        required this.weeks,
required this.weekday,
required this.start,
required this.duration
      });
  
      factory CoursesAddCoursesInputCoursesTimes.fromJson(dynamic json) {
        return CoursesAddCoursesInputCoursesTimes(
          weeks: SyncOutputUpdatedCourseTimesWeeksEnum.fromJson(json['weeks']),
weekday: json['weekday'],
start: json['start'],
duration: json['duration']
        );
      }
      
      dynamic toJson() {
        return {
          'weeks': weeks.toString(),
'weekday': weekday,
'start': start,
'duration': duration
        };
      }
    }
class CoursesAddCoursesInputCourses  {
      final bool isChoosable;
final String teacher;
final List<CoursesAddCoursesInputCoursesTimes> times;
final String normalizedCourseId;
final String guessedSubject;
final String? room;
  
      CoursesAddCoursesInputCourses({
        required this.isChoosable,
required this.teacher,
required this.times,
required this.normalizedCourseId,
required this.guessedSubject,
required this.room
      });
  
      factory CoursesAddCoursesInputCourses.fromJson(dynamic json) {
        return CoursesAddCoursesInputCourses(
          isChoosable: json['isChoosable'],
teacher: json['teacher'],
times: (json['times'] as List<dynamic>).map<CoursesAddCoursesInputCoursesTimes>((e) => CoursesAddCoursesInputCoursesTimes.fromJson(e)).toList(),
normalizedCourseId: json['normalizedCourseId'],
guessedSubject: json['guessedSubject'],
room: json['room']
        );
      }
      
      dynamic toJson() {
        return {
          'isChoosable': isChoosable,
'teacher': teacher,
'times': times.map((e) => e.toJson()).toList(),
'normalizedCourseId': normalizedCourseId,
'guessedSubject': guessedSubject,
'room': room
        };
      }
    }
class CoursesAddCoursesInput  {
      final List<CoursesAddCoursesInputCourses> courses;
final int yearId;
final int classId;
  
      CoursesAddCoursesInput({
        required this.courses,
required this.yearId,
required this.classId
      });
  
      factory CoursesAddCoursesInput.fromJson(dynamic json) {
        return CoursesAddCoursesInput(
          courses: (json['courses'] as List<dynamic>).map<CoursesAddCoursesInputCourses>((e) => CoursesAddCoursesInputCourses.fromJson(e)).toList(),
yearId: json['yearId'],
classId: json['classId']
        );
      }
      
      dynamic toJson() {
        return {
          'courses': courses.map((e) => e.toJson()).toList(),
'yearId': yearId,
'classId': classId
        };
      }
    }
class SubstitutionsGetInput  {
      final DateTime? date;
  
      SubstitutionsGetInput({
        required this.date
      });
  
      factory SubstitutionsGetInput.fromJson(dynamic json) {
        return SubstitutionsGetInput(
          date: json['date'] != null ? DateTime.parse(json['date']) : null
        );
      }
      
      dynamic toJson() {
        return {
          'date': date?.toIso8601String()
        };
      }
    }
enum SubstitutionsGetOutputTypeEnum {
        freisetzung,
vertretung,
betreuung,
entfall,
trotzAbsenz;
  
        factory SubstitutionsGetOutputTypeEnum.fromJson(String json) {
        switch (json) {
          case 'FREISETZUNG': return SubstitutionsGetOutputTypeEnum.freisetzung;
case 'VERTRETUNG': return SubstitutionsGetOutputTypeEnum.vertretung;
case 'BETREUUNG': return SubstitutionsGetOutputTypeEnum.betreuung;
case 'ENTFALL': return SubstitutionsGetOutputTypeEnum.entfall;
case 'TROTZ_ABSENZ': return SubstitutionsGetOutputTypeEnum.trotzAbsenz;
          default: throw Exception('Unknown enum value: $json');
        }
      }
      }
class SubstitutionsGetOutput  {
      final SubstitutionsGetOutputTypeEnum? type;
final DateTime date;
final SyncOutputUpdatedCourses course;
final int id;
final DateTime createdAt;
final DateTime updatedAt;
final int courseId;
final String? room;
final num lessonStart;
final num lessonEnd;
final int? substituteId;
  
      SubstitutionsGetOutput({
        required this.type,
required this.date,
required this.course,
required this.id,
required this.createdAt,
required this.updatedAt,
required this.courseId,
required this.room,
required this.lessonStart,
required this.lessonEnd,
required this.substituteId
      });
  
      factory SubstitutionsGetOutput.fromJson(dynamic json) {
        return SubstitutionsGetOutput(
          type: json['type'] != null ? SubstitutionsGetOutputTypeEnum.fromJson(json['type']) : null,
date: DateTime.parse(json['date']),
course: SyncOutputUpdatedCourses.fromJson(json['course']),
id: json['id'],
createdAt: DateTime.parse(json['createdAt']),
updatedAt: DateTime.parse(json['updatedAt']),
courseId: json['courseId'],
room: json['room'],
lessonStart: json['lessonStart'],
lessonEnd: json['lessonEnd'],
substituteId: json['substituteId']
        );
      }
      
      dynamic toJson() {
        return {
          'type': type?.toString(),
'date': date.toIso8601String(),
'course': course.toJson(),
'id': id,
'createdAt': createdAt.toIso8601String(),
'updatedAt': updatedAt.toIso8601String(),
'courseId': courseId,
'room': room,
'lessonStart': lessonStart,
'lessonEnd': lessonEnd,
'substituteId': substituteId
        };
      }
    }
class SubscriptionsSubscribeInput  {
      final List<num> courses;
final String messagingToken;
  
      SubscriptionsSubscribeInput({
        required this.courses,
required this.messagingToken
      });
  
      factory SubscriptionsSubscribeInput.fromJson(dynamic json) {
        return SubscriptionsSubscribeInput(
          courses: (json['courses'] as List<dynamic>).map<num>((e) => e).toList(),
messagingToken: json['messagingToken']
        );
      }
      
      dynamic toJson() {
        return {
          'courses': courses.map((e) => e).toList(),
'messagingToken': messagingToken
        };
      }
    }
class AuthGetSessionOutputUser  {
      final int id;
final String name;
final bool isSuperUser;
  
      AuthGetSessionOutputUser({
        required this.id,
required this.name,
required this.isSuperUser
      });
  
      factory AuthGetSessionOutputUser.fromJson(dynamic json) {
        return AuthGetSessionOutputUser(
          id: json['id'],
name: json['name'],
isSuperUser: json['isSuperUser']
        );
      }
      
      dynamic toJson() {
        return {
          'id': id,
'name': name,
'isSuperUser': isSuperUser
        };
      }
    }
class AuthGetSessionOutput  {
      final AuthGetSessionOutputUser? user;
final String token;
  
      AuthGetSessionOutput({
        required this.user,
required this.token
      });
  
      factory AuthGetSessionOutput.fromJson(dynamic json) {
        return AuthGetSessionOutput(
          user: json['user'] != null ? AuthGetSessionOutputUser.fromJson(json['user']) : null,
token: json['token']
        );
      }
      
      dynamic toJson() {
        return {
          'user': user?.toJson(),
'token': token
        };
      }
    }
class UsersListOutputRoles  {
      final int id;
final String name;
final dynamic defaultScope;
  
      UsersListOutputRoles({
        required this.id,
required this.name,
required this.defaultScope
      });
  
      factory UsersListOutputRoles.fromJson(dynamic json) {
        return UsersListOutputRoles(
          id: json['id'],
name: json['name'],
defaultScope: json['defaultScope']
        );
      }
      
      dynamic toJson() {
        return {
          'id': id,
'name': name,
'defaultScope': defaultScope
        };
      }
    }
enum UsersListOutputPermissionsPermissionEnum {
        editInfoPages,
editUsers,
editCourses,
editYears,
editClasses,
editSchools,
viewLogs;
  
        factory UsersListOutputPermissionsPermissionEnum.fromJson(String json) {
        switch (json) {
          case 'EDIT_INFO_PAGES': return UsersListOutputPermissionsPermissionEnum.editInfoPages;
case 'EDIT_USERS': return UsersListOutputPermissionsPermissionEnum.editUsers;
case 'EDIT_COURSES': return UsersListOutputPermissionsPermissionEnum.editCourses;
case 'EDIT_YEARS': return UsersListOutputPermissionsPermissionEnum.editYears;
case 'EDIT_CLASSES': return UsersListOutputPermissionsPermissionEnum.editClasses;
case 'EDIT_SCHOOLS': return UsersListOutputPermissionsPermissionEnum.editSchools;
case 'VIEW_LOGS': return UsersListOutputPermissionsPermissionEnum.viewLogs;
          default: throw Exception('Unknown enum value: $json');
        }
      }
      }
class UsersListOutputPermissions  {
      final UsersListOutputPermissionsPermissionEnum permission;
final int userId;
final dynamic scope;
  
      UsersListOutputPermissions({
        required this.permission,
required this.userId,
required this.scope
      });
  
      factory UsersListOutputPermissions.fromJson(dynamic json) {
        return UsersListOutputPermissions(
          permission: UsersListOutputPermissionsPermissionEnum.fromJson(json['permission']),
userId: json['userId'],
scope: json['scope']
        );
      }
      
      dynamic toJson() {
        return {
          'permission': permission.toString(),
'userId': userId,
'scope': scope
        };
      }
    }
class UsersListOutput  {
      final bool hasPassword;
final List<UsersListOutputRoles> roles;
final List<UsersListOutputPermissions> permissions;
final int id;
final String? email;
final String name;
final String? title;
final String? abbrv;
final DateTime createdAt;
final DateTime updatedAt;
final DateTime? emailVerified;
final String? image;
final String role;
final bool isSuperUser;
  
      UsersListOutput({
        required this.hasPassword,
required this.roles,
required this.permissions,
required this.id,
required this.email,
required this.name,
required this.title,
required this.abbrv,
required this.createdAt,
required this.updatedAt,
required this.emailVerified,
required this.image,
required this.role,
required this.isSuperUser
      });
  
      factory UsersListOutput.fromJson(dynamic json) {
        return UsersListOutput(
          hasPassword: json['hasPassword'],
roles: (json['roles'] as List<dynamic>).map<UsersListOutputRoles>((e) => UsersListOutputRoles.fromJson(e)).toList(),
permissions: (json['permissions'] as List<dynamic>).map<UsersListOutputPermissions>((e) => UsersListOutputPermissions.fromJson(e)).toList(),
id: json['id'],
email: json['email'],
name: json['name'],
title: json['title'],
abbrv: json['abbrv'],
createdAt: DateTime.parse(json['createdAt']),
updatedAt: DateTime.parse(json['updatedAt']),
emailVerified: json['emailVerified'] != null ? DateTime.parse(json['emailVerified']) : null,
image: json['image'],
role: json['role'],
isSuperUser: json['isSuperUser']
        );
      }
      
      dynamic toJson() {
        return {
          'hasPassword': hasPassword,
'roles': roles.map((e) => e.toJson()).toList(),
'permissions': permissions.map((e) => e.toJson()).toList(),
'id': id,
'email': email,
'name': name,
'title': title,
'abbrv': abbrv,
'createdAt': createdAt.toIso8601String(),
'updatedAt': updatedAt.toIso8601String(),
'emailVerified': emailVerified?.toIso8601String(),
'image': image,
'role': role,
'isSuperUser': isSuperUser
        };
      }
    }
class UsersUpdateManyInput  {
      final int id;
final String? role;
final String? name;
final String? email;
final String? passwordHash;
final String? title;
final String? abbrv;
final DateTime? createdAt;
final DateTime? updatedAt;
final DateTime? emailVerified;
final String? image;
final bool? isSuperUser;
  
      UsersUpdateManyInput({
        required this.id,
required this.role,
required this.name,
required this.email,
required this.passwordHash,
required this.title,
required this.abbrv,
required this.createdAt,
required this.updatedAt,
required this.emailVerified,
required this.image,
required this.isSuperUser
      });
  
      factory UsersUpdateManyInput.fromJson(dynamic json) {
        return UsersUpdateManyInput(
          id: json['id'],
role: json['role'],
name: json['name'],
email: json['email'],
passwordHash: json['passwordHash'],
title: json['title'],
abbrv: json['abbrv'],
createdAt: json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
updatedAt: json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
emailVerified: json['emailVerified'] != null ? DateTime.parse(json['emailVerified']) : null,
image: json['image'],
isSuperUser: json['isSuperUser']
        );
      }
      
      dynamic toJson() {
        return {
          'id': id,
'role': role,
'name': name,
'email': email,
'passwordHash': passwordHash,
'title': title,
'abbrv': abbrv,
'createdAt': createdAt?.toIso8601String(),
'updatedAt': updatedAt?.toIso8601String(),
'emailVerified': emailVerified?.toIso8601String(),
'image': image,
'isSuperUser': isSuperUser
        };
      }
    }
class UsersAddInput  {
      final String name;
final String? email;
final String? password;
final String? title;
final String? abbrv;
  
      UsersAddInput({
        required this.name,
required this.email,
required this.password,
required this.title,
required this.abbrv
      });
  
      factory UsersAddInput.fromJson(dynamic json) {
        return UsersAddInput(
          name: json['name'],
email: json['email'],
password: json['password'],
title: json['title'],
abbrv: json['abbrv']
        );
      }
      
      dynamic toJson() {
        return {
          'name': name,
'email': email,
'password': password,
'title': title,
'abbrv': abbrv
        };
      }
    }
class UsersAddOutput  {
      final int id;
final String? email;
final String name;
final String? passwordHash;
final String? title;
final String? abbrv;
final DateTime createdAt;
final DateTime updatedAt;
final DateTime? emailVerified;
final String? image;
final String role;
final bool isSuperUser;
  
      UsersAddOutput({
        required this.id,
required this.email,
required this.name,
required this.passwordHash,
required this.title,
required this.abbrv,
required this.createdAt,
required this.updatedAt,
required this.emailVerified,
required this.image,
required this.role,
required this.isSuperUser
      });
  
      factory UsersAddOutput.fromJson(dynamic json) {
        return UsersAddOutput(
          id: json['id'],
email: json['email'],
name: json['name'],
passwordHash: json['passwordHash'],
title: json['title'],
abbrv: json['abbrv'],
createdAt: DateTime.parse(json['createdAt']),
updatedAt: DateTime.parse(json['updatedAt']),
emailVerified: json['emailVerified'] != null ? DateTime.parse(json['emailVerified']) : null,
image: json['image'],
role: json['role'],
isSuperUser: json['isSuperUser']
        );
      }
      
      dynamic toJson() {
        return {
          'id': id,
'email': email,
'name': name,
'passwordHash': passwordHash,
'title': title,
'abbrv': abbrv,
'createdAt': createdAt.toIso8601String(),
'updatedAt': updatedAt.toIso8601String(),
'emailVerified': emailVerified?.toIso8601String(),
'image': image,
'role': role,
'isSuperUser': isSuperUser
        };
      }
    }
class UsersUpdatePasswordInput  {
      final int id;
final String password;
  
      UsersUpdatePasswordInput({
        required this.id,
required this.password
      });
  
      factory UsersUpdatePasswordInput.fromJson(dynamic json) {
        return UsersUpdatePasswordInput(
          id: json['id'],
password: json['password']
        );
      }
      
      dynamic toJson() {
        return {
          'id': id,
'password': password
        };
      }
    }
enum UsersListScopeOptionsInputEnum {
        classes,
courses,
years,
schools;
  
        factory UsersListScopeOptionsInputEnum.fromJson(String json) {
        switch (json) {
          case 'classes': return UsersListScopeOptionsInputEnum.classes;
case 'courses': return UsersListScopeOptionsInputEnum.courses;
case 'years': return UsersListScopeOptionsInputEnum.years;
case 'schools': return UsersListScopeOptionsInputEnum.schools;
          default: throw Exception('Unknown enum value: $json');
        }
      }
      }
class UsersListScopeOptionsOutput  {
      final String name;
final int id;
  
      UsersListScopeOptionsOutput({
        required this.name,
required this.id
      });
  
      factory UsersListScopeOptionsOutput.fromJson(dynamic json) {
        return UsersListScopeOptionsOutput(
          name: json['name'],
id: json['id']
        );
      }
      
      dynamic toJson() {
        return {
          'name': name,
'id': id
        };
      }
    }
class UsersSetPermissionsInputPermissions  {
      final UsersListOutputPermissionsPermissionEnum permission;
final dynamic? scope;
  
      UsersSetPermissionsInputPermissions({
        required this.permission,
required this.scope
      });
  
      factory UsersSetPermissionsInputPermissions.fromJson(dynamic json) {
        return UsersSetPermissionsInputPermissions(
          permission: UsersListOutputPermissionsPermissionEnum.fromJson(json['permission']),
scope: json['scope']
        );
      }
      
      dynamic toJson() {
        return {
          'permission': permission.toString(),
'scope': null
        };
      }
    }
class UsersSetPermissionsInput  {
      final int userId;
final bool isSuperUser;
final List<UsersSetPermissionsInputPermissions> permissions;
  
      UsersSetPermissionsInput({
        required this.userId,
required this.isSuperUser,
required this.permissions
      });
  
      factory UsersSetPermissionsInput.fromJson(dynamic json) {
        return UsersSetPermissionsInput(
          userId: json['userId'],
isSuperUser: json['isSuperUser'],
permissions: (json['permissions'] as List<dynamic>).map<UsersSetPermissionsInputPermissions>((e) => UsersSetPermissionsInputPermissions.fromJson(e)).toList()
        );
      }
      
      dynamic toJson() {
        return {
          'userId': userId,
'isSuperUser': isSuperUser,
'permissions': permissions.map((e) => e.toJson()).toList()
        };
      }
    }