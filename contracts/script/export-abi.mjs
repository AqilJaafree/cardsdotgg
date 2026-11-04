// Exports ABIs to shared/abi. Run after forge build: node contracts/script/export-abi.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const root = new URL("../../", import.meta.url);
mkdirSync(new URL("shared/abi/", root), { recursive: true });
const paths = {
  BattleEngine: "engine/BattleEngine.sol", TestToken: "TestToken.sol", RateOracle: "RateOracle.sol",
  DeckVault: "DeckVault.sol", DeckNFT: "DeckNFT.sol", YieldEscrow: "YieldEscrow.sol", Arena: "Arena.sol",
  WithdrawRouter: "WithdrawRouter.sol",
};
for (const name of Object.keys(paths)) {
  const file = paths[name].split("/").pop();
  const { abi } = JSON.parse(readFileSync(new URL(`contracts/out/${file}/${name}.json`, root)));
  writeFileSync(new URL(`shared/abi/${name}.json`, root), JSON.stringify(abi, null, 2) + "\n");
}
console.log("exported", Object.keys(paths).length);
