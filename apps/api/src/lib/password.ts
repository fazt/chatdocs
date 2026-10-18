import bcrypt from "bcryptjs";

const ROUNDS = process.env.NODE_ENV === "test" ? 4 : 11;

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, ROUNDS);
export const verifyPassword = (password: string, hash: string): Promise<boolean> => bcrypt.compare(password, hash);

/** Hash ficticio: el login tarda lo mismo exista o no el email (sin enumeración por tiempos). */
const DUMMY_HASH = bcrypt.hashSync("folio-dummy-password", ROUNDS);
export const burnPasswordCheck = (password: string): Promise<boolean> => bcrypt.compare(password, DUMMY_HASH);
