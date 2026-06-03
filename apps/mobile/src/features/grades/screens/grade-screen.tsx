import { View } from "react-native";
import { PageScaffold } from "~/components/page-scaffold";
import { Text } from "~/components/text";
import type { GradeType } from "@stu/core";
import { useMockApp } from "~/mock-app/provider";
import { useRequiredAuthenticatedSession } from "~/app-shell/session/session";
import {
  ConfirmMasterGradeParent,
  MasterGradeParentConfirmationView,
} from "~/features/courses/grades/master/confirm-master-grade-parent";
import {
  ConfirmMasterGradeTeacher,
  MasterGradeTeacherConfirmationView,
} from "~/features/courses/grades/master/confirm-master-grade-teacher";
import {
  ConfirmOralGradeParent,
  OralGradeParentConfirmationView,
} from "~/features/courses/grades/oral/confirm-oral-grade-parent";
import {
  ConfirmOralGradeTeacher,
  OralGradeTeacherConfirmationView,
} from "~/features/courses/grades/oral/confirm-oral-grade-teacher";
import {
  ConfirmWrittenGradeParent,
  WrittenGradeParentConfirmationView,
} from "~/features/courses/grades/written/confirm-written-grade-parent";
import {
  ConfirmWrittenGradeTeacher,
  WrittenGradeTeacherConfirmationView,
} from "~/features/courses/grades/written/confirm-written-grade-teacher";

interface Props {
  date: Date;
  courseId: string;
  type: GradeType;
}

export const GradeScreen = ({ date, courseId, type }: Props) => {
  const { getCourseGrades, getCourse } = useMockApp();
  const { user } = useRequiredAuthenticatedSession();
  const grade = getCourseGrades(courseId).find(
    (item) => item.type === type && item.date.getTime() === date.getTime(),
  );
  const course = getCourse(courseId);

  if (!grade || !course) {
    return (
      <PageScaffold title="Note" contentClassName="p-8" useDefaultPadding={false}>
        <Text>Note nicht gefunden.</Text>
      </PageScaffold>
    );
  }

  const resolvedGrade = {
    ...grade,
    course,
  };

  if (!grade.teacherSignature) {
    switch (type) {
      case "MASTER":
        return <ConfirmMasterGradeTeacher grade={resolvedGrade} />;
      case "ORAL":
        return <ConfirmOralGradeTeacher grade={resolvedGrade} />;
      case "WRITTEN":
        return <ConfirmWrittenGradeTeacher grade={resolvedGrade} />;
    }
  }

  if (!user.isOfAge && !grade.parentSignature) {
    switch (type) {
      case "MASTER":
        return <ConfirmMasterGradeParent grade={resolvedGrade} />;
      case "ORAL":
        return <ConfirmOralGradeParent grade={resolvedGrade} />;
      case "WRITTEN":
        return <ConfirmWrittenGradeParent grade={resolvedGrade} />;
    }
  }

  const confirmedGrade = {
    ...resolvedGrade,
    teacherSignature: grade.teacherSignature!,
  };

  return (
    <PageScaffold title="Note bestätigt" contentClassName="p-8" useDefaultPadding={false}>
      {type === "MASTER" ? <MasterGradeTeacherConfirmationView grade={confirmedGrade} /> : null}
      {type === "ORAL" ? <OralGradeTeacherConfirmationView grade={confirmedGrade} /> : null}
      {type === "WRITTEN" ? <WrittenGradeTeacherConfirmationView grade={confirmedGrade} /> : null}
      {!user.isOfAge && grade.parentSignature ? (
        <>
          <View className="h-16" />
          {type === "MASTER" ? (
            <MasterGradeParentConfirmationView
              grade={{ ...confirmedGrade, parentSignature: grade.parentSignature }}
            />
          ) : null}
          {type === "ORAL" ? (
            <OralGradeParentConfirmationView
              grade={{ ...confirmedGrade, parentSignature: grade.parentSignature }}
            />
          ) : null}
          {type === "WRITTEN" ? (
            <WrittenGradeParentConfirmationView
              grade={{ ...confirmedGrade, parentSignature: grade.parentSignature }}
            />
          ) : null}
        </>
      ) : null}
    </PageScaffold>
  );
};
