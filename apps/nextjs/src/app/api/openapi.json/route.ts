import { openApiDocument } from "@schnau/api/src/root";

export function GET() {
  return new Response(JSON.stringify(openApiDocument), {
    headers: {
      "content-type": "application/json",
    },
  });
}
