export const dynamic = "force-dynamic";

const disabled = () =>
  new Response(JSON.stringify({ error: "Legacy API route disabled. Use /api/trpc." }), {
    status: 410,
    headers: {
      "content-type": "application/json",
    },
  });

export const GET = disabled;
export const POST = disabled;
export const PUT = disabled;
export const PATCH = disabled;
export const DELETE = disabled;
export const HEAD = disabled;
export const OPTIONS = disabled;
