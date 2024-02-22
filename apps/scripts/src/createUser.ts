import { createUser } from "@schnau/common/src/user";

if (!process.argv[3] || !process.argv[4] || !process.argv[5]) {
  console.log("Usage: createUser <name> <email> <password>");
  process.exit(1);
}

void createUser(process.argv[3], process.argv[4], process.argv[5]);
