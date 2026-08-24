import { NextResponse } from "next/server";

const ARC_RPC_ENDPOINTS = [
  process.env.ARC_RPC_URL,
  "https://rpc.drpc.testnet.arc.network",
  "https://rpc.blockdaemon.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.network",
  "https://rpc.testnet.arc.network",
].filter((endpoint): endpoint is string => Boolean(endpoint));
const SAMPLE_SIZE = 12;

type RpcResponse<T> = { result?: T; error?: { code: number; message: string } };
type RawTransaction = { hash: string; from: string; to: string | null; value: string; gas: string; gasPrice?: string; input: string };
type RawBlock = { number: string; timestamp: string; transactions: RawTransaction[]; gasUsed: string; gasLimit: string; hash: string; parentHash: string; miner: string; size: string; baseFeePerGas?: string };

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  let lastError: unknown;

  for (const endpoint of ARC_RPC_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: {
          "accept": "application/json",
          "content-type": "application/json",
          "user-agent": "ArcScope/1.0 (+https://arcscope.vercel.app)",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
        cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw new Error(`RPC responded with HTTP ${response.status}`);
      const payload = (await response.json()) as RpcResponse<T>;
      if (payload.error) throw new Error(payload.error.message || "Arc RPC error");
      if (payload.result === undefined) throw new Error(`No result for ${method}`);
      return payload.result;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All Arc RPC providers are unavailable");
}

const hexToNumber = (value?: string | null) => (value ? Number.parseInt(value, 16) : 0);
const hexToDecimal = (value?: string | null) => (value ? BigInt(value).toString() : "0");

export async function GET() {
  const startedAt = performance.now();
  try {
    const [chainIdHex, latestHex, gasPriceHex] = await Promise.all([
      rpc<string>("eth_chainId"), rpc<string>("eth_blockNumber"), rpc<string>("eth_gasPrice"),
    ]);
    const latestBlock = hexToNumber(latestHex);
    const blockNumbers = Array.from({ length: SAMPLE_SIZE }, (_, index) => latestBlock - index).filter((value) => value >= 0);
    const rawBlocks = await Promise.all(blockNumbers.map((value) => rpc<RawBlock | null>("eth_getBlockByNumber", [`0x${value.toString(16)}`, true])));
    const blocks = rawBlocks.filter((block): block is RawBlock => Boolean(block)).map((block) => ({
      number: hexToNumber(block.number), timestamp: hexToNumber(block.timestamp), transactionCount: block.transactions.length,
      gasUsed: hexToNumber(block.gasUsed), gasLimit: hexToNumber(block.gasLimit), hash: block.hash, parentHash: block.parentHash,
      miner: block.miner, size: hexToNumber(block.size), baseFeePerGasWei: hexToDecimal(block.baseFeePerGas),
    }));
    const transactions = rawBlocks.filter((block): block is RawBlock => Boolean(block)).flatMap((block) => block.transactions.map((tx) => ({
      hash: tx.hash, blockNumber: hexToNumber(block.number), timestamp: hexToNumber(block.timestamp), from: tx.from, to: tx.to,
      valueWei: hexToDecimal(tx.value), gas: hexToNumber(tx.gas), gasPriceWei: hexToDecimal(tx.gasPrice),
      type: tx.to === null ? "Contract creation" : tx.input === "0x" ? "Transfer" : "Contract call",
    }))).slice(0, 10);
    return NextResponse.json({ network: "Arc Testnet", chainId: hexToNumber(chainIdHex), latestBlock, gasPriceWei: hexToDecimal(gasPriceHex), blocks, transactions, fetchedAt: new Date().toISOString(), rpcLatencyMs: Math.round(performance.now() - startedAt), sampleSize: blocks.length }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.name === "AbortError" ? "Arc RPC timed out" : error.message : "Unable to reach Arc RPC";
    return NextResponse.json({ error: message, fetchedAt: new Date().toISOString() }, { status: 502 });
  }
}
