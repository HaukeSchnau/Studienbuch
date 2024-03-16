import generator from "generate-password";

export const generateRandomPassword = () => {
  return generator.generate({
    length: 10,
    numbers: true,
  });
};
