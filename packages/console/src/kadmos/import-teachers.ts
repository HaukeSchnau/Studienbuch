import { ingest, SYSTEM_USER } from "@stu/api";
import { getTeachersV2 } from "@stu/external-api";
import type { SchoolId, SimpleDate } from "@stu/lib";
import { Exit } from "effect";
import { logger } from "../logger";
import type { AuthContext } from "./kadmos-utils";

const TEACHER_MAP = [
  {
    firstName: "Martin",
    lastName: "Baschta",
    salutation: "Herr",
  },
  {
    firstName: "Anja",
    lastName: "Gottspenn",
    salutation: "Frau",
  },
  {
    firstName: "Bianca",
    lastName: "Reineke",
    salutation: "Frau",
  },
  {
    firstName: "Wolfgang",
    lastName: "Temme",
    salutation: "Herr",
  },
  {
    firstName: "Anna",
    lastName: "Bäckermann",
    salutation: "Frau",
  },
  {
    firstName: "Mirco",
    lastName: "Eckstein",
    salutation: "Herr",
  },
  {
    firstName: "Jannis",
    lastName: "Hillebrand",
    salutation: "Herr",
  },
  {
    firstName: "Wolfgang",
    lastName: "Ahlrichs",
    salutation: "Herr",
  },
  {
    firstName: "Jennifer",
    lastName: "Aufderheide",
    salutation: "Frau",
  },
  {
    firstName: "Yingrui",
    lastName: "Bi",
    salutation: "Herr",
  },
  {
    firstName: "Marion",
    lastName: "Bauer-Lechner",
    salutation: "Frau",
  },
  {
    firstName: "Katrin",
    lastName: "Bembenek",
    salutation: "Frau",
  },
  {
    firstName: "Julian",
    lastName: "Below",
    salutation: "Herr",
  },
  {
    firstName: "Irma",
    lastName: "Bouwer",
    salutation: "Frau",
  },
  {
    firstName: "Thomas",
    lastName: "Buse",
    salutation: "Herr",
  },
  {
    firstName: "Marcus",
    lastName: "Claus",
    salutation: "Herr",
  },
  {
    firstName: "Eva",
    lastName: "Cloer",
    salutation: "Frau",
  },
  {
    firstName: "Sandra",
    lastName: "Cordes",
    salutation: "Frau",
  },
  {
    firstName: "Sabine",
    lastName: "Cordes-Kaya",
    salutation: "Frau",
  },
  {
    firstName: "Sonja",
    lastName: "Dahl",
    salutation: "Frau",
  },
  {
    firstName: "Melinda",
    lastName: "Dantz",
    salutation: "Frau",
  },
  {
    firstName: "Dorothee",
    lastName: "Daus-Kohlhas",
    salutation: "Frau",
  },
  {
    firstName: "Dörte",
    lastName: "Direnga",
    salutation: "Frau",
  },
  {
    firstName: "Jens",
    lastName: "Ditschke",
    salutation: "Herr",
  },
  {
    firstName: "Kathrin",
    lastName: "Dorn-Kraatz",
    salutation: "Frau",
  },
  {
    firstName: "Sebastian",
    lastName: "Drachenberg",
    salutation: "Herr",
  },
  {
    firstName: "Eren",
    lastName: "Düdükcü",
    salutation: "Herr",
  },
  {
    firstName: "Bianca",
    lastName: "Endemann",
    salutation: "Frau",
  },
  {
    firstName: "Simon",
    lastName: "Engelbertz",
    salutation: "Herr",
  },
  {
    firstName: "Claudia",
    lastName: "Enneking",
    salutation: "Frau",
  },
  {
    firstName: "Jendrik",
    lastName: "Erichsen",
    salutation: "Herr",
  },
  {
    firstName: "Ann Kathrin",
    lastName: "Fedder",
    salutation: "Frau",
  },
  {
    firstName: "Neslihan",
    lastName: "Fidan-Gündogdu",
    salutation: "Frau",
  },
  {
    firstName: "Frank",
    lastName: "Fortmann",
    salutation: "Herr",
  },
  {
    firstName: "Sabrina",
    lastName: "Franck",
    salutation: "Frau",
  },
  {
    firstName: "Kirsten",
    lastName: "Frank",
    salutation: "Frau",
  },
  {
    firstName: "Michael",
    lastName: "Gesen",
    salutation: "Herr",
  },
  {
    firstName: "Lisa",
    lastName: "Goudschaal",
    salutation: "Frau",
  },
  {
    firstName: "Sybille",
    lastName: "Graue-Marks",
    salutation: "Frau",
  },
  {
    firstName: "Felix",
    lastName: "Grütjen",
    salutation: "Herr",
  },
  {
    firstName: "Keno",
    lastName: "Hagedorn",
    salutation: "Herr",
  },
  {
    firstName: "David",
    lastName: "Hagel",
    salutation: "Herr",
  },
  {
    firstName: "Marita",
    lastName: "Hanisch",
    salutation: "Frau",
  },
  {
    firstName: "Inken",
    lastName: "Hansen",
    salutation: "Frau",
  },
  {
    firstName: "Viviane",
    lastName: "Heiber-Rehm",
    salutation: "Frau",
  },
  {
    firstName: "Jan",
    lastName: "Hennemann",
    salutation: "Herr",
  },
  {
    firstName: "Arvid",
    lastName: "Heubner",
    salutation: "Herr",
  },
  {
    firstName: "Eva",
    lastName: "Hilken",
    salutation: "Frau",
  },
  {
    firstName: "Lioba",
    lastName: "Hirsch",
    salutation: "Frau",
  },
  {
    firstName: "Corinna",
    lastName: "Höppe",
    salutation: "Frau",
  },
  {
    firstName: "Tanja",
    lastName: "Hornung",
    salutation: "Frau",
  },
  {
    firstName: "Natalia",
    lastName: "Hüsing",
    salutation: "Frau",
  },
  {
    firstName: "Nicolas",
    lastName: "Hussain",
    salutation: "Herr",
  },
  {
    firstName: "Roman",
    lastName: "Jenderny",
    salutation: "Herr",
  },
  {
    firstName: "Frauke",
    lastName: "Jacobsen",
    salutation: "Frau",
  },
  {
    firstName: "Michelle",
    lastName: "Kämpf",
    salutation: "Frau",
  },
  {
    firstName: "Alexander",
    lastName: "Kellermann",
    salutation: "Herr",
  },
  {
    firstName: "Fiona",
    lastName: "Karaman",
    salutation: "Frau",
  },
  {
    firstName: "Melinda",
    lastName: "Dantz",
    salutation: "Frau",
  },
  {
    firstName: "Alexander",
    lastName: "Klähr",
    salutation: "Herr",
  },
  {
    firstName: "Imke",
    lastName: "Klee",
    salutation: "Frau",
  },
  {
    firstName: "Kristina",
    lastName: "Kliebisch",
    salutation: "Frau",
  },
  {
    firstName: "Daniel",
    lastName: "Klotzek",
    salutation: "Herr",
  },
  {
    firstName: "Martina",
    lastName: "Klupsch",
    salutation: "Frau",
  },
  {
    firstName: "Karina",
    lastName: "Kögel-Renken",
    salutation: "Frau",
  },
  {
    firstName: "Thorsten",
    lastName: "Köpke",
    salutation: "Herr",
  },
  {
    firstName: "Wiebke",
    lastName: "Köstermann",
    salutation: "Frau",
  },
  {
    firstName: "Carsten",
    lastName: "Krause",
    salutation: "Herr",
  },
  {
    firstName: "Domenik",
    lastName: "Krause",
    salutation: "Herr",
  },
  {
    firstName: "Imke",
    lastName: "Langhorst",
    salutation: "Frau",
  },
  {
    firstName: "Sang-Ah",
    lastName: "Lee",
    salutation: "Frau",
  },
  {
    firstName: "Catharina",
    lastName: "Lütjen",
    salutation: "Frau",
  },
  {
    firstName: "Hagen",
    lastName: "Mann",
    salutation: "Herr",
  },
  {
    firstName: "Tanja",
    lastName: "Markowsky",
    salutation: "Frau",
  },
  {
    firstName: "Markus",
    lastName: "Maschke",
    salutation: "Herr",
  },
  {
    firstName: "Derek",
    lastName: "Meißner",
    salutation: "Herr",
  },
  {
    firstName: "Annett",
    lastName: "Meyer",
    salutation: "Frau",
  },
  {
    firstName: "Bernd",
    lastName: "Meyer",
    salutation: "Herr",
  },
  {
    firstName: "Arend",
    lastName: "Mittwollen",
    salutation: "Herr",
  },
  {
    firstName: "Bernd",
    lastName: "Müller",
    salutation: "Herr",
  },
  {
    firstName: "Maximilian",
    lastName: "Nielsen",
    salutation: "Herr",
  },
  {
    firstName: "David",
    lastName: "Niemann",
    salutation: "Herr",
  },
  {
    firstName: "Dorothea",
    lastName: "Niemeyer",
    salutation: "Frau",
  },
  {
    firstName: "Anne",
    lastName: "Olbertz",
    salutation: "Frau",
  },
  {
    firstName: "Tatjana",
    lastName: "Orth",
    salutation: "Frau",
  },
  {
    firstName: "Thomas",
    lastName: "Orth",
    salutation: "Herr",
  },
  {
    firstName: "Carmen",
    lastName: "Perez Acosta",
    salutation: "Frau",
  },
  {
    firstName: "Janine",
    lastName: "Post",
    salutation: "Frau",
  },
  {
    firstName: "Ivonne",
    lastName: "Rasche",
    salutation: "Frau",
  },
  {
    firstName: "Beate",
    lastName: "Reimer",
    salutation: "Frau",
  },
  {
    firstName: "Susanne",
    lastName: "Reese",
    salutation: "Frau",
  },
  {
    firstName: "Christian",
    lastName: "Richter",
    salutation: "Herr",
  },
  {
    firstName: "Dominik",
    lastName: "Rudolph",
    salutation: "Herr",
  },
  {
    firstName: "Tobias",
    lastName: "Rump",
    salutation: "Herr",
  },
  {
    firstName: "Anke",
    lastName: "Sap",
    salutation: "Frau",
  },
  {
    firstName: "Brigitte",
    lastName: "Schäfer",
    salutation: "Frau",
  },
  {
    firstName: "Melanie",
    lastName: "Schaper",
    salutation: "Frau",
  },
  {
    firstName: "Veronica",
    lastName: "Schilling",
    salutation: "Frau",
  },
  {
    firstName: "Jannika",
    lastName: "Schnepel",
    salutation: "Frau",
  },
  {
    firstName: "Martin",
    lastName: "Schröder",
    salutation: "Herr",
  },
  {
    firstName: "Dominik",
    lastName: "Schröer",
    salutation: "Herr",
  },
  {
    firstName: "Moritz",
    lastName: "Schulenberg",
    salutation: "Herr",
  },
  {
    firstName: "Lisa",
    lastName: "Schwabe",
    salutation: "Frau",
  },
  {
    firstName: "Mario",
    lastName: "Segelhorst",
    salutation: "Herr",
  },
  {
    firstName: "Thomas",
    lastName: "Seifert",
    salutation: "Herr",
  },
  {
    firstName: "Lukas",
    lastName: "Spangenberg",
    salutation: "Herr",
  },
  {
    firstName: "Frederik",
    lastName: "Tamcke",
    salutation: "Herr",
  },
  {
    firstName: "Julia",
    lastName: "Thiel",
    salutation: "Frau",
  },
  {
    firstName: "Georg",
    lastName: "Thiele",
    salutation: "Herr",
  },
  {
    firstName: "Lisa",
    lastName: "Thies",
    salutation: "Frau",
  },
  {
    firstName: "Jasper",
    lastName: "Thoms",
    salutation: "Herr",
  },
  {
    firstName: "Linda",
    lastName: "Timm",
    salutation: "Frau",
  },
  {
    firstName: "Viktor",
    lastName: "Turkaljuk",
    salutation: "Herr",
  },
  {
    firstName: "Hauke",
    lastName: "Vahlenkamp",
    salutation: "Herr",
  },
  {
    firstName: "Julia",
    lastName: "Varlemann",
    salutation: "Frau",
  },
  {
    firstName: "Gabriele",
    lastName: "Waller",
    salutation: "Frau",
  },
  {
    firstName: "Leif",
    lastName: "Walczak",
    salutation: "Herr",
  },
  {
    firstName: "Katrin",
    lastName: "Wenzel",
    salutation: "Frau",
  },
  {
    firstName: "Imke",
    lastName: "Wilkening",
    salutation: "Frau",
  },
  {
    firstName: "Lisa",
    lastName: "Winkelmann",
    salutation: "Frau",
  },
  {
    firstName: "Katja",
    lastName: "Zoll",
    salutation: "Frau",
  },
] as const;

interface Options {
  start: SimpleDate;
  end: SimpleDate;
  schoolYearId: number;
  dryRun: boolean;
  school: SchoolId;
}

export const importTeachers = async (options: Options, authContext: AuthContext) => {
  logger.info("Importing teachers...");

  const { teachers } = await getTeachersV2(options.start, options.end, options.schoolYearId, authContext);
  for (const { teacher } of teachers) {
    const lastName = teacher.longName;
    const abbrv = teacher.displayName;

    const knownTeacher = TEACHER_MAP.find((t) => t.lastName === lastName);

    if (!options.dryRun) {
      const err = await ingest(
        {
          type: "org.teacher.joined",
          data: {
            personId: crypto.randomUUID(),
            firstName: knownTeacher?.firstName ?? "",
            lastName,
            abbrv,
            salutation: knownTeacher?.salutation,
            school: options.school,
          },
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
        SYSTEM_USER,
      );

      if (Exit.isFailure(err)) {
        if (err.cause._tag === "Fail" && err.cause.error.reason === "DUPLICATE") {
          logger.info(`Teacher ${abbrv} already joined!`);
        } else {
          logger.error(`Could not ingest teacher joined event for ${abbrv}: ${err.cause.toString()}`);
        }
      } else {
        logger.info(`Teacher ${abbrv} joined!`);
      }
    } else {
      logger.info(`Teacher: ${JSON.stringify({ lastName, abbrv, knownTeacher }, null, 2)}`);
    }
  }
};
