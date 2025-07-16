import { relations } from "drizzle-orm/relations";
import {
  clazz,
  course,
  courseSubscription,
  courseTime,
  permissionOnRole,
  permissionOnUser,
  role,
  roleToUser,
  school,
  session,
  substitution,
  user,
  year,
} from "./schema";

export const yearRelations = relations(year, ({ one, many }) => ({
  school: one(school, {
    fields: [year.schoolId],
    references: [school.id],
  }),
  courses: many(course),
  classes: many(clazz),
}));

export const schoolRelations = relations(school, ({ many }) => ({
  years: many(year),
}));

export const courseSubscriptionRelations = relations(courseSubscription, ({ one }) => ({
  course: one(course, {
    fields: [courseSubscription.courseId],
    references: [course.id],
  }),
}));

export const courseRelations = relations(course, ({ one, many }) => ({
  courseSubscriptions: many(courseSubscription),
  class: one(clazz, {
    fields: [course.classId],
    references: [clazz.id],
  }),
  user: one(user, {
    fields: [course.teacherId],
    references: [user.id],
  }),
  year: one(year, {
    fields: [course.yearId],
    references: [year.id],
  }),
  courseTimes: many(courseTime),
  substitutions: many(substitution),
}));

export const roleToUserRelations = relations(roleToUser, ({ one }) => ({
  role: one(role, {
    fields: [roleToUser.a],
    references: [role.id],
  }),
  user: one(user, {
    fields: [roleToUser.b],
    references: [user.id],
  }),
}));

export const roleRelations = relations(role, ({ many }) => ({
  roleToUsers: many(roleToUser),
  permissionOnRoles: many(permissionOnRole),
}));

export const userRelations = relations(user, ({ many }) => ({
  roleToUsers: many(roleToUser),
  courses: many(course),
  sessions: many(session),
  substitutions: many(substitution),
  permissionOnUsers: many(permissionOnUser),
}));

export const clazzRelations = relations(clazz, ({ one, many }) => ({
  courses: many(course),
  year: one(year, {
    fields: [clazz.yearId],
    references: [year.id],
  }),
}));

export const courseTimeRelations = relations(courseTime, ({ one }) => ({
  course: one(course, {
    fields: [courseTime.courseId],
    references: [course.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const substitutionRelations = relations(substitution, ({ one }) => ({
  course: one(course, {
    fields: [substitution.courseId],
    references: [course.id],
  }),
  user: one(user, {
    fields: [substitution.substituteId],
    references: [user.id],
  }),
}));

export const permissionOnUserRelations = relations(permissionOnUser, ({ one }) => ({
  user: one(user, {
    fields: [permissionOnUser.userId],
    references: [user.id],
  }),
}));

export const permissionOnRoleRelations = relations(permissionOnRole, ({ one }) => ({
  role: one(role, {
    fields: [permissionOnRole.roleId],
    references: [role.id],
  }),
}));
