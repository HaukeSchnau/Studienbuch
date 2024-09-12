import data from "./teachers.snapshot.json";

export const getTeachers = () => {
  return data.teachers.map((teacher) => ({
    firstName: teacher.teacher.shortName,
    lastName: teacher.teacher.longName,
    abbrv: teacher.teacher.displayName,
  }));
};
