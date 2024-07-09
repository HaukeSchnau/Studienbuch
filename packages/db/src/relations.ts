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
  class: one(Class, {
    fields: [Course.classId],
    references: [Class.id],
  }),
  teacher: one(User, {
    fields: [Course.teacherId],
    references: [User.id],
  }),
  semester: one(Semester, {
    fields: [Course.semesterId],
    references: [Semester.id],
  }),
  times: many(CourseTime),
  substitutions: many(Substitution),
  CourseSubscriptions: many(CourseSubscription),
  _students: many(_students),
  absences: many(Absence),
  grades: many(Grade),
  tasks: many(Task),
  classesToCourses: many(_ClassToCourse),
}));

export const ClassRelations = relations(Class, ({ one, many }) => ({
  courses: many(Course),
  year: one(Year, {
    fields: [Class.yearId],
    references: [Year.id],
  }),
  classesToCourses: many(_ClassToCourse),
}));

export const UserRelations = relations(User, ({ many }) => ({
  courses: many(Course),
  sessions: many(Session),
  substitutions: many(Substitution),
  rolesToUsers: many(_RoleToUser),
  licenseKeys: many(LicenseKey),
  _students: many(_students),
  absences: many(Absence),
  grades: many(Grade),
  tasks: many(Task),
  permissionOnUsers: many(PermissionOnUser),
}));

export const SemesterRelations = relations(Semester, ({ one, many }) => ({
  courses: many(Course),
  school: one(School, {
    fields: [Semester.schoolId],
    references: [School.id],
  }),
}));

export const CourseTimeRelations = relations(CourseTime, ({ one }) => ({
  course: one(Course, {
    fields: [CourseTime.courseId],
    references: [Course.id],
  }),
}));

export const SessionRelations = relations(Session, ({ one }) => ({
  user: one(User, {
    fields: [Session.userId],
    references: [User.id],
  }),
}));

export const SubstitutionRelations = relations(Substitution, ({ one }) => ({
  course: one(Course, {
    fields: [Substitution.courseId],
    references: [Course.id],
  }),
  substitute: one(User, {
    fields: [Substitution.substituteId],
    references: [User.id],
  }),
}));

export const YearRelations = relations(Year, ({ one, many }) => ({
  classes: many(Class),
  school: one(School, {
    fields: [Year.schoolId],
    references: [School.id],
  }),
}));

export const _RoleToUserRelations = relations(_RoleToUser, ({ one }) => ({
  role: one(Role, {
    fields: [_RoleToUser.role],
    references: [Role.id],
  }),
  user: one(User, {
    fields: [_RoleToUser.user],
    references: [User.id],
  }),
}));

export const RoleRelations = relations(Role, ({ many }) => ({
  _RoleToUsers: many(_RoleToUser),
  permissionOnRoles: many(PermissionOnRole),
}));

export const SchoolRelations = relations(School, ({ many }) => ({
  years: many(Year),
  semesters: many(Semester),
}));

export const CourseSubscriptionRelations = relations(
  CourseSubscription,
  ({ one }) => ({
    course: one(Course, {
      fields: [CourseSubscription.courseId],
      references: [Course.id],
    }),
  }),
);

export const LicenseKeyRelations = relations(LicenseKey, ({ one }) => ({
  user: one(User, {
    fields: [LicenseKey.activatedById],
    references: [User.id],
  }),
}));

export const _studentsRelations = relations(_students, ({ one }) => ({
  course: one(Course, {
    fields: [_students.A],
    references: [Course.id],
  }),
  user: one(User, {
    fields: [_students.B],
    references: [User.id],
  }),
}));

export const AbsenceRelations = relations(Absence, ({ one }) => ({
  course: one(Course, {
    fields: [Absence.courseId],
    references: [Course.id],
  }),
  user: one(User, {
    fields: [Absence.studentId],
    references: [User.id],
  }),
}));

export const GradeRelations = relations(Grade, ({ one }) => ({
  course: one(Course, {
    fields: [Grade.courseId],
    references: [Course.id],
  }),
  user: one(User, {
    fields: [Grade.studentId],
    references: [User.id],
  }),
}));

export const TaskRelations = relations(Task, ({ one }) => ({
  course: one(Course, {
    fields: [Task.courseId],
    references: [Course.id],
  }),
  user: one(User, {
    fields: [Task.ownerId],
    references: [User.id],
  }),
}));

export const _ClassToCourseRelations = relations(_ClassToCourse, ({ one }) => ({
  class: one(Class, {
    fields: [_ClassToCourse.class],
    references: [Class.id],
  }),
  course: one(Course, {
    fields: [_ClassToCourse.course],
    references: [Course.id],
  }),
}));

export const PermissionOnUserRelations = relations(
  PermissionOnUser,
  ({ one }) => ({
    user: one(User, {
      fields: [PermissionOnUser.userId],
      references: [User.id],
    }),
  }),
);

export const PermissionOnRoleRelations = relations(
  PermissionOnRole,
  ({ one }) => ({
    role: one(Role, {
      fields: [PermissionOnRole.roleId],
      references: [Role.id],
    }),
  }),
);
