import {
  Address,
  CellMessage,
  CommonMessageInfo,
  InternalMessage,
  SendMode,
  toNano,
  TupleSlice,
  WalletContract,
} from "ton";
import {
  buildRegistryDataCell,
  Queries,
  Verifier,
} from "../packages/contracts/registry-contract/RegistryData";
import BN from "bn.js";
import { randomKeyPair } from "../packages/utils/randomKeyPair";
import { createHash } from "crypto";

// return the init Cell of the contract storage (according to load_data() contract method)
export function initData() {
  return buildRegistryDataCell(
    {
      verifiers: new Map<BN, Verifier>(),
    },
    0
  );
}

// return the op that should be sent to the contract on deployment, can be "null" to send an empty message
export function initMessage() {
  return null;
}

function sha256BN(name: string) {
  return new BN(createHash("sha256").update(name).digest());
}

function ip2num(ip: string) {
  let d = ip.split(".");
  return ((+d[0] * 256 + +d[1]) * 256 + +d[2]) * 256 + +d[3];
}

// optional end-to-end sanity test for the actual on-chain contract to see it is actually working on-chain
export async function postDeployTest(
  walletContract: WalletContract,
  secretKey: Buffer,
  contractAddress: Address
) {
  const call = await walletContract.client.callGetMethod(
    contractAddress,
    "get_verifiers_num"
  );
  let ts = new TupleSlice(call.stack);
  console.log(`   # Getter 'get_verifiers_num' = ${ts.readNumber()}`);

  const pubKey = [
    148, 69, 177, 132, 85, 101, 80, 233, 160, 155, 14, 151, 13, 47, 168, 10,
    213, 126, 6, 117, 246, 135, 231, 230, 73, 52, 59, 79, 177, 235, 35, 114,
  ];

  const seqno = await walletContract.getSeqNo();
  const transfer = walletContract.createTransfer({
    secretKey: secretKey,
    seqno: seqno,
    sendMode: SendMode.PAY_GAS_SEPARATLY + SendMode.IGNORE_ERRORS,
    order: new InternalMessage({
      to: contractAddress,
      value: toNano(1),
      bounce: true,
      body: new CommonMessageInfo({
        //  body: new CellMessage(Queries.removeVerifier({
        //     id: new BN(717),
        //   }))
        body: new CellMessage(
          Queries.updateVerifier({
            id: sha256BN("orbs.com"),
            quorum: 1,
            endpoints: new Map<BN, number>([[new BN(pubKey), 1]]),
            name: "orbs.com",
            marketingUrl: "https://orbs.com",
          })
        ),
      }),
    }),
  });
  await walletContract.client.sendExternalMessage(walletContract, transfer);

  console.log(`   # Message sent`);
}
