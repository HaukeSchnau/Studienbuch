import data from "./teachers.snapshot.json";

// TODO: Get teachers from Kadmos instead of snapshot
export const getTeachers = () => {
  return data.teachers.map((teacher) => ({
    firstName: teacher.teacher.shortName,
    lastName: teacher.teacher.longName,
    abbrv: teacher.teacher.displayName,
  }));
};
