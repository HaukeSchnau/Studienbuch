import { copyIservUsers } from "./copyIservUsers";
import { generateLicenses } from "./generateLicenses";


export const seed = async () => {
    await generateLicenses(100);
    await copyIservUsers();
};

void seed();
