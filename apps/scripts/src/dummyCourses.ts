import { prisma } from "@acme/db";

const courseNames = [
  "Deutsch",
  "Englisch",
  "Mathe",
  "Physik",
  "Chemie",
  "Biologie",
  "Informatik",
  "Geschichte",
  "Politik-Wirtschaft",
  "Musik",
  "Sport",
  "Kunst",
  "Religion",
  "Werte und Normen",
  "Französisch",
  "Latein",
  "Spanisch",
];

const getRandomTeacher = async () => {
  const teachersCount = await prisma.user.count({
    where: {
      role: "TEACHER",
    },
  });
  const skip = Math.floor(Math.random() * teachersCount);
  return await prisma.user.findFirst({
    where: {
      role: "TEACHER",
    },
    skip: skip,
  });
};

const getRandomNumber = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const times = [
  {
    hour: 8,
    minute: 0,
  },
  {
    hour: 9,
    minute: 45,
  },
  {
    hour: 11,
    minute: 30,
  },
  {
    hour: 13,
    minute: 50,
  },
  {
    hour: 15,
    minute: 15,
  },
];

const getRandomCourseTime = () => {
  const start = times[getRandomNumber(0, times.length - 1)] ?? {
    hour: 8,
    minute: 0,
  };
  return {
    weekday: getRandomNumber(1, 5),
    start: start.hour * 60 + start.minute,
    duration: 80,
  };
};

const getRandomCourseTimes = () => {
  return Array.from({ length: getRandomNumber(1, 4) }, () =>
    getRandomCourseTime(),
  );
};

const getShortName = (name: string) => {
  if (name === "Politik-Wirtschaft") return "pw";
  if (name === "Werte und Normen") return "wn";
  if (name === "Informatik") return "if";
  if (name === "Spanisch") return "sn";

  return name.slice(0, 2).toLowerCase();
};

const years = [
  {
    startYear: 2012,
    name: "Heinrich",
    numClasses: 1,
  },
  {
    startYear: 2013,
    name: "Paula",
    numClasses: 1,
  },
  {
    startYear: 2014,
    name: "Otto",
    numClasses: 1,
  },
  {
    startYear: 2015,
    name: "Clara",
    numClasses: 1,
  },
  {
    startYear: 2016,
    name: "Hans",
    numClasses: 4,
  },
  {
    startYear: 2017,
    name: "Lisel",
    numClasses: 6,
  },
  {
    startYear: 2018,
    name: "Udo",
    numClasses: 6,
  },
  {
    startYear: 2019,
    name: "Hermine",
    numClasses: 6,
  },
  {
    startYear: 2020,
    name: "Bernhard",
    numClasses: 6,
  },
  {
    startYear: 2021,
    name: "Frieda",
    numClasses: 6,
  },
  {
    startYear: 2022,
    name: "Richard",
    numClasses: 6,
  },
];

export const generateDummyCourses = async () => {
  for (const year of years) {
    const dbYear = await prisma.year.create({
      data: {
        name: year.name,
        startYear: year.startYear,
        graduationYear: year.startYear + 9,
      },
    });
    console.log(dbYear);

    for (let i = 0; i < year.numClasses; i++) {
      const cl = await prisma.class.create({
        data: {
          identifierInYear: `${i + 1}`,
          year: {
            connect: {
              id: dbYear.id,
            },
          },
        },
      });
      console.log(cl);

      if (year.numClasses === 1) {
        for (const courseName of courseNames) {
          const coursesToGenerate = getRandomNumber(1, 3);
          for (let courseNum = 1; courseNum <= coursesToGenerate; courseNum++) {
            const randomTeacher = await getRandomTeacher();
            if (!randomTeacher) {
              throw new Error("No teacher found");
            }

            const course = await prisma.course.create({
              data: {
                name: courseName,
                courseId: `${getShortName(courseName)}${courseNum}`,
                teacher: {
                  connect: {
                    id: randomTeacher.id,
                  },
                },
                times: {
                  createMany: {
                    data: getRandomCourseTimes(),
                  },
                },
                year: {
                  connect: {
                    id: dbYear.id,
                  },
                },
              },
            });
            console.log(course);
          }
        }
      } else {
        for (const courseName of courseNames) {
          const randomTeacher = await getRandomTeacher();
          if (!randomTeacher) {
            throw new Error("No teacher found");
          }

          const course = await prisma.course.create({
            data: {
              name: courseName,
              teacher: {
                connect: {
                  id: randomTeacher.id,
                },
              },
              times: {
                createMany: {
                  data: getRandomCourseTimes(),
                },
              },
              class: {
                connect: {
                  id: cl.id,
                },
              },
              year: {
                connect: {
                  id: dbYear.id,
                },
              },
            },
          });
          console.log(course);
        }
      }
    }
  }
};
