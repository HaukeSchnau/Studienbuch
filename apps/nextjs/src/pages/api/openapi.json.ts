import { type NextApiRequest, type NextApiResponse } from "next";

import { openApiDocument } from "@acme/api/src/root";

// Respond with our OpenAPI schema
const handler = (req: NextApiRequest, res: NextApiResponse) => {
  res.status(200).send(openApiDocument);
};

export default handler;
