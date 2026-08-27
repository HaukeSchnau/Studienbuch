import { View } from "react-native";
import { PageScaffold } from "~/ui/navigation/page-scaffold";
import { Text } from "~/ui/text";
import type { GradeType } from "~/compat/mobile-v0";
import { useGrades } from "../use-grades";
import { useCourses } from "../../use-courses";
import { useProfile } from "~/features/profile";
import { GradeConfirmation, GradeConfirmationView } from "../grade-confirmation";

interface Props {
  date: Date;
  courseId: string;
  type: GradeType;
}

export const GradeScreen = ({ date, courseId, type }: Props) => {
  const { getCourse } = useCourses();
  const { getCourseGrades } = useGrades();
  const { profile: user } = useProfile();
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
    return <GradeConfirmation grade={resolvedGrade} signer="teacher" />;
  }

  if (!user.isOfAge && !grade.parentSignature) {
    return <GradeConfirmation grade={resolvedGrade} signer="parent" />;
  }

  const confirmedGrade = {
    ...resolvedGrade,
    teacherSignature: grade.teacherSignature,
  };

  return (
    <PageScaffold title="Note bestätigt" contentClassName="p-8" useDefaultPadding={false}>
      <GradeConfirmationView grade={confirmedGrade} signer="teacher" />
      {!user.isOfAge && grade.parentSignature ? (
        <>
          <View className="h-16" />
          <GradeConfirmationView grade={confirmedGrade} signer="parent" />
        </>
      ) : null}
    </PageScaffold>
  );
};
