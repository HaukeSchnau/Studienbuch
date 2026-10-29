// The fixture as text: Vite's plugin in vite.config.ts and the app's Metro transformer both load it so.
declare module "*.jsonl" {
  const text: string;
  export default text;
}
