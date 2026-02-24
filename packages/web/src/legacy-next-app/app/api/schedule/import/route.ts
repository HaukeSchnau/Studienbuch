import { type ImportedScheduleCourses, importScheduleFromFormData } from "@stu/lib-server";

export async function POST(request: Request) {
  const result = await importScheduleFromFormData(await request.formData());
  if (!result.ok) {
    return new Response(JSON.stringify({ message: result.message }), {
      status: result.status,
    });
  }

  const ret: PostReturn = result.courses;
  return new Response(JSON.stringify(ret), { status: 200 });
}

export type PostReturn = ImportedScheduleCourses;
