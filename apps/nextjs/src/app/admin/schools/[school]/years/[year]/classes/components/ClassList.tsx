import type { Year } from "@schnau/lib";
import { formatClassName } from "@schnau/lib";

import { Card, CardHeading } from "~/components/layout/Card";
import { Grid } from "~/components/layout/Grid";
import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { api } from "~/infrastructure/trpc/react";

interface Props {
  year: Year;
}

export const ClassList = ({ year }: Props) => {
  const classes = api.classes.list.useQuery({ yearId: year.id });

  if (classes.status === "pending") {
    return <LoadingIndicator />;
  }

  if (classes.status === "error") {
    return <div>Error: {classes.error.message}</div>;
  }

  return (
    <Grid
      data={classes.data}
      renderItem={(clazz) => (
        <Card key={clazz.id}>
          <CardHeading>{formatClassName(clazz, year)}</CardHeading>
          <p>{clazz.courses.length} Kurse</p>
        </Card>
      )}
    />
  );
};
