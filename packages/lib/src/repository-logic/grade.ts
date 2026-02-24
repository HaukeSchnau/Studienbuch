type GradeCourseTypeColumns<TCourseColumn, TTypeColumn> = {
  course: TCourseColumn;
  type: TTypeColumn;
};

type GradeCourseTypeDateColumns<TCourseColumn, TTypeColumn, TDateColumn> = GradeCourseTypeColumns<
  TCourseColumn,
  TTypeColumn
> & {
  date: TDateColumn;
};

type GradeSignatureColumns<TTeacherSignatureColumn, TParentSignatureColumn> = {
  teacherSignature: TTeacherSignatureColumn;
  parentSignature: TParentSignatureColumn;
};

export const gradeCourseTypePredicates = <TCourseColumn, TTypeColumn, TCourseValue, TTypeValue, TPredicate>(
  columns: GradeCourseTypeColumns<TCourseColumn, TTypeColumn>,
  values: {
    course: TCourseValue;
    type: TTypeValue;
  },
  eq: (column: TCourseColumn | TTypeColumn, value: TCourseValue | TTypeValue) => TPredicate,
): readonly [TPredicate, TPredicate] => [eq(columns.course, values.course), eq(columns.type, values.type)];

export const gradeCourseTypeDatePredicates = <
  TCourseColumn,
  TTypeColumn,
  TDateColumn,
  TCourseValue,
  TTypeValue,
  TDateValue,
  TPredicate,
>(
  columns: GradeCourseTypeDateColumns<TCourseColumn, TTypeColumn, TDateColumn>,
  values: {
    course: TCourseValue;
    type: TTypeValue;
    date: TDateValue;
  },
  eq: (column: TCourseColumn | TTypeColumn | TDateColumn, value: TCourseValue | TTypeValue | TDateValue) => TPredicate,
): readonly [TPredicate, TPredicate, TPredicate] => [
  eq(columns.course, values.course),
  eq(columns.type, values.type),
  eq(columns.date, values.date),
];

export const gradePendingSignaturePredicate = <TTeacherSignatureColumn, TParentSignatureColumn, TPredicate>(
  columns: GradeSignatureColumns<TTeacherSignatureColumn, TParentSignatureColumn>,
  sql: {
    isNull: (column: TTeacherSignatureColumn | TParentSignatureColumn) => TPredicate;
    or: (left: TPredicate, right: TPredicate) => TPredicate;
  },
): TPredicate => sql.or(sql.isNull(columns.teacherSignature), sql.isNull(columns.parentSignature));
