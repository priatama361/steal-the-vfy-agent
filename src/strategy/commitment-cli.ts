import { commitmentHex } from "./commitment";

/** Mencetak HANYA commitment publik. Tidak pernah mencetak salt atau parameter. */
const hash = await commitmentHex();
console.log(hash);
