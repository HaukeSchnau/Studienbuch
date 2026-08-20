import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button.tsx";

/**
 * Stories live beside the component they document. `components/ui` is the canonical library:
 * shadcn-generated, regenerable with `vp dlx shadcn@latest add <name>`, and configured by
 * `components.json`.
 */
const meta = {
  title: "UI/Button",
  component: Button,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { children: "Speichern" } };
export const Secondary: Story = { args: { variant: "secondary", children: "Abbrechen" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Löschen" } };
export const Outline: Story = { args: { variant: "outline", children: "Kurs wählen" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Mehr anzeigen" } };
export const Disabled: Story = { args: { disabled: true, children: "Speichern" } };
