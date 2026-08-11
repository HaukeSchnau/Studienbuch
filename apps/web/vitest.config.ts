import { defineProject } from "vite-plus";

export default defineProject({
  test: {
    environment: "jsdom",
    name: "@stu/web",
  },
});
