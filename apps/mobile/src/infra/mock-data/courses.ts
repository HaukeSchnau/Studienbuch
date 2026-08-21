import type { Course, TeacherInfo } from "~/compat/mobile-v0";

const annaMeyer: TeacherInfo = { id: "t1", firstName: "Anna", lastName: "Meyer" };
const tobiasKruse: TeacherInfo = { id: "t2", firstName: "Tobias", lastName: "Kruse" };
const ninaPetersen: TeacherInfo = { id: "t3", firstName: "Nina", lastName: "Petersen" };
const larsBecker: TeacherInfo = { id: "t4", firstName: "Lars", lastName: "Becker" };

export const teachers: TeacherInfo[] = [annaMeyer, tobiasKruse, ninaPetersen, larsBecker];

export const coursesSeed: Course[] = [
  {
    id: "de-1",
    name: "Deutsch LK",
    subject: "de",
    teachers: [annaMeyer],
    semesterId: "s2",
    level: "ADVANCED",
    examSlot: "P1",
  },
  {
    id: "ma-1",
    name: "Mathematik LK",
    subject: "ma",
    teachers: [ninaPetersen],
    semesterId: "s2",
    level: "ADVANCED",
    examSlot: "P2",
  },
  {
    id: "en-1",
    name: "Englisch GK",
    subject: "en",
    teachers: [tobiasKruse],
    semesterId: "s2",
    level: "BASIC",
    examSlot: "P3",
  },
  {
    id: "ge-1",
    name: "Geschichte GK",
    subject: "ge",
    teachers: [annaMeyer],
    semesterId: "s2",
    level: "BASIC",
    examSlot: "P4",
  },
  {
    id: "ph-1",
    name: "Physik GK",
    subject: "ph",
    teachers: [larsBecker],
    semesterId: "s2",
    level: "BASIC",
    examSlot: "P5",
  },
  { id: "sp-1", name: "Sport GK", subject: "sp", teachers: [tobiasKruse], semesterId: "s2" },
  {
    id: "de-0",
    name: "Deutsch LK",
    subject: "de",
    teachers: [annaMeyer],
    semesterId: "s1",
    level: "ADVANCED",
    examSlot: "P1",
  },
  {
    id: "ma-0",
    name: "Mathematik LK",
    subject: "ma",
    teachers: [ninaPetersen],
    semesterId: "s1",
    level: "ADVANCED",
    examSlot: "P2",
  },
  {
    id: "en-0",
    name: "Englisch GK",
    subject: "en",
    teachers: [tobiasKruse],
    semesterId: "s1",
    level: "BASIC",
    examSlot: "P3",
  },
  {
    id: "ge-0",
    name: "Geschichte GK",
    subject: "ge",
    teachers: [annaMeyer],
    semesterId: "s1",
    level: "BASIC",
    examSlot: "P4",
  },
];

export const selectedCourseIdsBySemesterSeed = {
  s1: ["de-0", "ma-0", "en-0", "ge-0"],
  s2: ["de-1", "ma-1", "en-1", "ge-1", "ph-1", "sp-1"],
};
