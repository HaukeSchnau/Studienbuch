import { z } from "zod";

export const defaultTheme: Theme = {
  primary: {
    default: {
      color: "#33A42B",
      on: "#ffffff",
    },
    text: "#098A00",
    des: {
      color: "#EEF5ED",
      on: "#ffffff",
    },
    pale: {
      color: "#6DB868",
      on: "#ffffff",
    },
  },
  accent: {
    default: {
      color: "#3B7FD9",
      on: "#ffffff",
    },
    sec: {
      color: "#4d75a8",
      on: "#ffffff",
    },
    des: {
      color: "#EBF0F7",
      on: "#ffffff",
    },
    pale: {
      color: "#76A6E5",
      on: "#ffffff",
    },
  },
  danger: {
    default: {
      color: "#A42B33",
      on: "#ffffff",
    },
    des: {
      color: "#ECD4D6",
      on: "#ffffff",
    },
    sec: {
      color: "#8A0000",
      on: "#ffffff",
    },
  },
  alert: {
    default: {
      color: "#DCAB3C",
      on: "#ffffff",
    },
    des: {
      color: "#F2E9D8",
      on: "#ffffff",
    },
  },
  success: {
    default: {
      color: "#33A42B",
      on: "#ffffff",
    },
    des: {
      color: "#EEF5ED",
      on: "#ffffff",
    },
    pale: {
      color: "#6DB868",
      on: "#ffffff",
    },
  },
  neutral: {
    default: {
      color: "#666666",
      on: "#ffffff",
    },
    sec: {
      color: "#e5e5e5",
      on: "#ffffff",
    },
  },
  surface: {
    default: {
      color: "#ffffff",
      on: "#000000",
    },
  },
  background: {
    default: {
      color: "#f9f9f9",
      on: "#000000",
    },
  },
};

export const themeSchema = z.object({
  primary: z.object({
    default: z.object({
      color: z.string(),
      on: z.string(),
    }),
    text: z.string(),
    des: z.object({
      color: z.string(),
      on: z.string(),
    }),
    pale: z.object({
      color: z.string(),
      on: z.string(),
    }),
  }),
  accent: z.object({
    default: z.object({
      color: z.string(),
      on: z.string(),
    }),
    sec: z.object({
      color: z.string(),
      on: z.string(),
    }),
    des: z.object({
      color: z.string(),
      on: z.string(),
    }),
    pale: z.object({
      color: z.string(),
      on: z.string(),
    }),
  }),
  danger: z.object({
    default: z.object({
      color: z.string(),
      on: z.string(),
    }),
    des: z.object({
      color: z.string(),
      on: z.string(),
    }),
    sec: z.object({
      color: z.string(),
      on: z.string(),
    }),
  }),
  alert: z.object({
    default: z.object({
      color: z.string(),
      on: z.string(),
    }),
    des: z.object({
      color: z.string(),
      on: z.string(),
    }),
  }),
  success: z.object({
    default: z.object({
      color: z.string(),
      on: z.string(),
    }),
    des: z.object({
      color: z.string(),
      on: z.string(),
    }),
    pale: z.object({
      color: z.string(),
      on: z.string(),
    }),
  }),
  neutral: z.object({
    default: z.object({
      color: z.string(),
      on: z.string(),
    }),
    sec: z.object({
      color: z.string(),
      on: z.string(),
    }),
  }),
  surface: z.object({
    default: z.object({
      color: z.string(),
      on: z.string(),
    }),
  }),
  background: z.object({
    default: z.object({
      color: z.string(),
      on: z.string(),
    }),
  }),
});

export type Theme = z.infer<typeof themeSchema>;
