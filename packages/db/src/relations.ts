import { relations } from "drizzle-orm/relations";

import {
  _ClassToCourse,
  _RoleToUser,
  _students,
  Absence,
  Class,
  Course,
  CourseSubscription,
  CourseTime,
  Grade,
  LicenseKey,
  PermissionOnRole,
  PermissionOnUser,
  Role,
  School,
  Semester,
  Session,
  Substitution,
  Task,
  User,
  Year,
} from "./schema";

export const CourseRelations = relations(Course, ({ one, many }) => ({
  Class: one(Class, {
    fields: [Course.classId],
    references: [Class.id],
  }),
  User: one(User, {
    fields: [Course.teacherId],
    references: [User.id],
  }),
  Semester: one(Semester, {
    fields: [Course.semesterId],
    references: [Semester.id],
  }),
  CourseTimes: many(CourseTime),
  Substitutions: many(Substitution),
  CourseSubscriptions: many(CourseSubscription),
  _students: many(_students),
  Absences: many(Absence),
  Grades: many(Grade),
  Tasks: many(Task),
  _ClassToCourses: many(_ClassToCourse),
}));

export const ClassRelations = relations(Class, ({ one, many }) => ({
  Courses: many(Course),
  Year: one(Year, {
    fields: [Class.yearId],
    references: [Year.id],
  }),
  _ClassToCourses: many(_ClassToCourse),
}));

export const UserRelations = relations(User, ({ many }) => ({
  Courses: many(Course),
  Sessions: many(Session),
  Substitutions: many(Substitution),
  _RoleToUsers: many(_RoleToUser),
  LicenseKeys: many(LicenseKey),
  _students: many(_students),
  Absences: many(Absence),
  Grades: many(Grade),
  Tasks: many(Task),
  PermissionOnUsers: many(PermissionOnUser),
}));

export const SemesterRelations = relations(Semester, ({ one, many }) => ({
  Courses: many(Course),
  School: one(School, {
    fields: [Semester.schoolId],
    references: [School.id],
  }),
}));

export const CourseTimeRelations = relations(CourseTime, ({ one }) => ({
  Course: one(Course, {
    fields: [CourseTime.courseId],
    references: [Course.id],
  }),
}));

export const SessionRelations = relations(Session, ({ one }) => ({
  User: one(User, {
    fields: [Session.userId],
    references: [User.id],
  }),
}));

export const SubstitutionRelations = relations(Substitution, ({ one }) => ({
  Course: one(Course, {
    fields: [Substitution.courseId],
    references: [Course.id],
  }),
  User: one(User, {
    fields: [Substitution.substituteId],
    references: [User.id],
  }),
}));

export const YearRelations = relations(Year, ({ one, many }) => ({
  Classes: many(Class),
  School: one(School, {
    fields: [Year.schoolId],
    references: [School.id],
  }),
}));

export const _RoleToUserRelations = relations(_RoleToUser, ({ one }) => ({
  Role: one(Role, {
    fields: [_RoleToUser.A],
    references: [Role.id],
  }),
  User: one(User, {
    fields: [_RoleToUser.B],
    references: [User.id],
  }),
}));

export const RoleRelations = relations(Role, ({ many }) => ({
  _RoleToUsers: many(_RoleToUser),
  PermissionOnRoles: many(PermissionOnRole),
}));

export const SchoolRelations = relations(School, ({ many }) => ({
  Years: many(Year),
  Semesters: many(Semester),
}));

export const CourseSubscriptionRelations = relations(
  CourseSubscription,
  ({ one }) => ({
    Course: one(Course, {
      fields: [CourseSubscription.courseId],
      references: [Course.id],
    }),
  }),
);

export const LicenseKeyRelations = relations(LicenseKey, ({ one }) => ({
  User: one(User, {
    fields: [LicenseKey.activatedById],
    references: [User.id],
  }),
}));

export const _studentsRelations = relations(_students, ({ one }) => ({
  Course: one(Course, {
    fields: [_students.A],
    references: [Course.id],
  }),
  User: one(User, {
    fields: [_students.B],
    references: [User.id],
  }),
}));

export const AbsenceRelations = relations(Absence, ({ one }) => ({
  Course: one(Course, {
    fields: [Absence.courseId],
    references: [Course.id],
  }),
  User: one(User, {
    fields: [Absence.studentId],
    references: [User.id],
  }),
}));

export const GradeRelations = relations(Grade, ({ one }) => ({
  Course: one(Course, {
    fields: [Grade.courseId],
    references: [Course.id],
  }),
  User: one(User, {
    fields: [Grade.studentId],
    references: [User.id],
  }),
}));

export const TaskRelations = relations(Task, ({ one }) => ({
  Course: one(Course, {
    fields: [Task.courseId],
    references: [Course.id],
  }),
  User: one(User, {
    fields: [Task.ownerId],
    references: [User.id],
  }),
}));

export const _ClassToCourseRelations = relations(_ClassToCourse, ({ one }) => ({
  Class: one(Class, {
    fields: [_ClassToCourse.A],
    references: [Class.id],
  }),
  Course: one(Course, {
    fields: [_ClassToCourse.B],
    references: [Course.id],
  }),
}));

export const PermissionOnUserRelations = relations(
  PermissionOnUser,
  ({ one }) => ({
    User: one(User, {
      fields: [PermissionOnUser.userId],
      references: [User.id],
    }),
  }),
);

export const PermissionOnRoleRelations = relations(
  PermissionOnRole,
  ({ one }) => ({
    Role: one(Role, {
      fields: [PermissionOnRole.roleId],
      references: [Role.id],
    }),
  }),
);
