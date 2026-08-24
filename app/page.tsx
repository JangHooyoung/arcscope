"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Block = { number: number; timestamp: number; transactionCount: number; gasUsed: number; gasLimit: number; hash: string; parentHash: string; miner: string; size: number; baseFeePerGasWei: string };
type Transaction = { hash: string; blockNumber: number; timestamp: number; from: string; to: string | null; valueWei: string; gas: number; gasPriceWei: string; type: string };
type NetworkData = { network: string; chainId: number; latestBlock: number; gasPriceWei: string; blocks: Block[]; transactions: Transaction[]; fetchedAt: string; rpcLatencyMs: number; sampleSize: number };

const EXPLORER = "https://testnet.arcscan.app";
const shortHash = (hash?: string | null, start = 7, end = 5) => hash ? `${hash.slice(0, start)}…${hash.slice(-end)}` : "—";
const formatNumber = (value: number, digits = 1) => value.toLocaleString(undefined, { maximumFractionDigits: digits });

function age(timestamp: number, now = Date.now()) {
  const seconds = Math.max(0, Math.floor(now / 1000 - timestamp));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function gwei(wei: string) {
  const value = Number(wei) / 1e9;
  return Number.isFinite(value) ? `${value < 0.01 ? value.toFixed(4) : value.toFixed(2)} Gwei` : "—";
}

function usdcFromWei(wei: string, max = 6) {
  const value = Number(wei) / 1e18;
  return Number.isFinite(value) ? `${value.toLocaleString(undefined, { maximumFractionDigits: max })} USDC` : "—";
}

export default function Home() {
  const [data, setData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [tab, setTab] = useState<"blocks" | "transactions">("blocks");
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const response = await fetch("/api/rpc", { cache: "no-store" });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || "Could not load network data");
      setData(next); setError(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load network data"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    void load();
    const refreshTimer = window.setInterval(() => void load(), 15_000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => { window.clearInterval(refreshTimer); window.clearInterval(clockTimer); };
  }, [load]);

  const stats = useMemo(() => {
    if (!data?.blocks.length) return null;
    const totalTransactions = data.blocks.reduce((sum, block) => sum + block.transactionCount, 0);
    const gasUtilization = data.blocks.reduce((sum, block) => sum + (block.gasLimit ? block.gasUsed / block.gasLimit : 0), 0) / data.blocks.length * 100;
    const intervals = data.blocks.slice(0, -1).map((block, index) => Math.max(0, block.timestamp - data.blocks[index + 1].timestamp));
    const blockTime = intervals.length ? intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length : 0;
    const transferFeeWei = (BigInt(data.gasPriceWei) * BigInt(21_000)).toString();
    return { totalTransactions, gasUtilization, blockTime, transferFeeWei };
  }, [data]);

  return <main>
    <header className="topbar"><div className="shell topbarInner">
      <a className="brand" href="#overview" aria-label="ArcScope home"><span className="brandGlyph">AS</span><span>ArcScope</span></a>
      <nav className="desktopNav" aria-label="Primary"><a href="#overview">Overview</a><a href="#activity">Activity</a><a href="#resources">Resources</a></nav>
      <div className="topActions"><span className={`networkPill ${error ? "isError" : ""}`}><i />{error ? "Degraded" : data ? "Operational" : "Connecting"}</span><a className="iconButton" href={EXPLORER} target="_blank" rel="noreferrer">Explorer <span>↗</span></a></div>
    </div></header>

    <section className="shell hero" id="overview">
      <div className="heroCopy"><p className="kicker"><span>ARC TESTNET</span><i />LIVE NETWORK INTELLIGENCE</p><h1>The signal behind<br />every <em>block.</em></h1><p className="heroIntro">A focused view into Arc’s live network—blocks, transaction flow, gas demand, and the infrastructure powering stablecoin finance.</p></div>
      <div className="headBlock"><div className="headBlockTop"><span>NETWORK HEAD</span><span className="liveDot"><i />LIVE</span></div><strong>{data ? `#${formatNumber(data.latestBlock, 0)}` : "#—"}</strong><div className="headBlockMeta"><span>{data?.blocks[0] ? age(data.blocks[0].timestamp, now) : "Awaiting block"}</span><span>{data ? `${data.rpcLatencyMs} ms RPC` : "Connecting"}</span></div><div className="signalBars" aria-hidden="true">{[28,45,35,70,52,88,62,100,76,92,65,83,58,74,48,60].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div>
    </section>

    <section className="shell metricGrid" aria-label="Live network metrics">
      <Metric label="Gas price" value={data ? gwei(data.gasPriceWei) : "—"} note={stats ? `≈ ${usdcFromWei(stats.transferFeeWei)} / transfer` : "Native gas paid in USDC"} loading={loading} />
      <Metric label="Block cadence" value={stats ? `${stats.blockTime.toFixed(2)} sec` : "—"} note={`Across ${data?.sampleSize || 0} latest blocks`} loading={loading} />
      <Metric label="Transactions" value={stats ? formatNumber(stats.totalTransactions, 0) : "—"} note="In the current sample" loading={loading} />
      <Metric label="Gas utilization" value={stats ? `${stats.gasUtilization.toFixed(1)}%` : "—"} note="Average block capacity" loading={loading} accent />
    </section>

    {error && <section className="shell errorBanner" role="alert"><div><span>RPC CONNECTION DEGRADED</span><strong>Live updates are temporarily unavailable.</strong><p>{error}. Previously loaded data is preserved where available.</p></div><button onClick={() => void load(true)} disabled={refreshing}>{refreshing ? "Retrying…" : "Retry connection"}</button></section>}

    <section className="shell activity" id="activity"><div className="sectionHeading"><div><p className="kicker">NETWORK ACTIVITY</p><h2>Inside the latest ledger.</h2></div><div className="activityActions"><div className="tabs" role="tablist"><button role="tab" aria-selected={tab === "blocks"} onClick={() => setTab("blocks")}>Blocks</button><button role="tab" aria-selected={tab === "transactions"} onClick={() => setTab("transactions")}>Transactions</button></div><button className="refreshButton" onClick={() => void load(true)} disabled={refreshing}><span className={refreshing ? "spin" : ""}>↻</span>{refreshing ? "Refreshing" : "Refresh"}</button></div></div>
      <div className="dataPanel">{tab === "blocks" ? <BlockTable blocks={data?.blocks} loading={loading} now={now} onSelect={setSelectedBlock} /> : <TransactionTable transactions={data?.transactions} loading={loading} now={now} />}<div className="panelFooter"><span>Live from <b>rpc.testnet.arc.network</b></span><span>Auto-refresh · 15 sec</span></div></div>
    </section>

    <section className="shell insightGrid">
      <div className="insightCard chartCard"><div className="cardHeading"><div><p className="kicker">TRANSACTION FLOW</p><h3>Activity by block</h3></div><span>Last {data?.sampleSize || 12} blocks</span></div><div className="barChart">{(data?.blocks.slice().reverse() || Array.from({ length: 12 }, () => null)).map((block, index) => { const max = Math.max(...(data?.blocks.map((item) => item.transactionCount) || [1]), 1); const height = block ? Math.max(4, block.transactionCount / max * 100) : 12 + index * 4; return <div key={block?.number || index}><i style={{ height: `${height}%` }} /><span>{block ? String(block.number).slice(-3) : "—"}</span></div>; })}</div><div className="chartLegend"><span><i />Transactions</span><strong>{stats ? `${formatNumber(stats.totalTransactions / (data?.sampleSize || 1), 1)} avg / block` : "Awaiting data"}</strong></div></div>
      <div className="insightCard feeCard"><p className="kicker">STABLE FEE DESIGN</p><h3>Gas, denominated<br />in dollars.</h3><p>Arc uses USDC as its native gas asset—making network costs familiar and predictable without requiring a separate volatile token.</p><div className="feeReadout"><span>Estimated simple transfer</span><strong>{stats ? usdcFromWei(stats.transferFeeWei) : "— USDC"}</strong><small>21,000 gas × current gas price</small></div><a href="https://docs.arc.io/arc/references/gas-and-fees" target="_blank" rel="noreferrer">Read about Arc fees <span>↗</span></a></div>
    </section>

    <section className="shell resources" id="resources"><div className="sectionHeading"><div><p className="kicker">BUILDER RESOURCES</p><h2>Go from signal to build.</h2></div><p>Verified starting points for exploring, funding, and building on Arc Testnet.</p></div><div className="resourceGrid">
      <Resource index="01" title="Arc Explorer" copy="Inspect blocks, transactions, addresses, and contracts." href={EXPLORER} action="Open explorer" />
      <Resource index="02" title="Testnet Faucet" copy="Fund a wallet with testnet USDC for gas and transfers." href="https://faucet.circle.com" action="Get testnet USDC" />
      <Resource index="03" title="Developer Docs" copy="Connect, deploy, and learn Arc’s network architecture." href="https://docs.arc.io" action="Read the docs" />
      <Resource index="04" title="Arc Node" copy="Explore the open-source node and run infrastructure." href="https://github.com/circlefin/arc-node" action="View on GitHub" />
    </div></section>

    <section className="shell makerNote"><span>AN INDEPENDENT COMMUNITY PROJECT</span><p>Designed by a designer exploring <em>AI-assisted development and Web3.</em> ArcScope uses live public Testnet data and is not affiliated with or endorsed by Circle.</p></section>
    <footer className="shell footer"><a className="brand" href="#overview"><span className="brandGlyph">AS</span><span>ArcScope</span></a><span>Live data · Arc Testnet · Chain ID {data?.chainId || "5042002"}</span><span>© 2026 · Open source</span></footer>
    {selectedBlock && <BlockDrawer block={selectedBlock} now={now} onClose={() => setSelectedBlock(null)} />}
  </main>;
}

function Metric({ label, value, note, loading, accent = false }: { label: string; value: string; note: string; loading: boolean; accent?: boolean }) { return <article className={`metric ${accent ? "accent" : ""}`}><div><span>{label}</span><i>↗</i></div><strong className={loading ? "valueLoading" : ""}>{value}</strong><small>{note}</small></article>; }

function BlockTable({ blocks, loading, now, onSelect }: { blocks?: Block[]; loading: boolean; now: number; onSelect: (block: Block) => void }) {
  return <div className="dataTable blockRows" role="table"><div className="tableHeader" role="row"><span>Block</span><span>Age</span><span>Transactions</span><span>Gas used</span><span>Size</span><span>Hash</span></div>{loading && !blocks ? <SkeletonRows /> : blocks?.length ? blocks.map((block) => { const utilization = block.gasLimit ? block.gasUsed / block.gasLimit * 100 : 0; return <button className="tableRow" role="row" key={block.number} onClick={() => onSelect(block)}><span><b className="blockIcon">□</b><strong>#{formatNumber(block.number, 0)}</strong></span><span>{age(block.timestamp, now)}</span><span>{formatNumber(block.transactionCount, 0)}</span><span><i className="capacity"><i style={{ width: `${Math.min(100, utilization)}%` }} /></i><small>{utilization.toFixed(1)}%</small></span><span>{formatNumber(block.size / 1024, 1)} KB</span><span className="mono">{shortHash(block.hash)}</span></button>; }) : <EmptyState title="No recent blocks" copy="The RPC returned an empty block sample." />}</div>;
}

function TransactionTable({ transactions, loading, now }: { transactions?: Transaction[]; loading: boolean; now: number }) {
  return <div className="dataTable transactionRows" role="table"><div className="tableHeader" role="row"><span>Transaction</span><span>Age</span><span>Type</span><span>From → To</span><span>Value</span></div>{loading && !transactions ? <SkeletonRows /> : transactions?.length ? transactions.map((tx) => <a className="tableRow" role="row" key={tx.hash} href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer"><span className="mono txHash">{shortHash(tx.hash, 9, 6)}</span><span>{age(tx.timestamp, now)}</span><span><i className={`typeDot ${tx.type === "Transfer" ? "transfer" : ""}`} />{tx.type}</span><span className="mono addresses">{shortHash(tx.from)} <b>→</b> {shortHash(tx.to)}</span><span>{usdcFromWei(tx.valueWei, 4)}</span></a>) : <EmptyState title="No transactions in sample" copy="The latest sampled blocks contain no transactions yet." />}</div>;
}

function Resource({ index, title, copy, href, action }: { index: string; title: string; copy: string; href: string; action: string }) { return <a className="resource" href={href} target="_blank" rel="noreferrer"><span>{index}</span><div><h3>{title}</h3><p>{copy}</p><b>{action} <i>↗</i></b></div></a>; }
function SkeletonRows() { return <>{Array.from({ length: 6 }, (_, index) => <div className="tableRow skeleton" key={index}><span /><span /><span /><span /><span /><span /></div>)}</>; }
function EmptyState({ title, copy }: { title: string; copy: string }) { return <div className="emptyState"><i>∅</i><strong>{title}</strong><p>{copy}</p></div>; }

function BlockDrawer({ block, now, onClose }: { block: Block; now: number; onClose: () => void }) {
  const utilization = block.gasLimit ? block.gasUsed / block.gasLimit * 100 : 0;
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("keydown", handler); document.body.classList.add("drawerOpen"); return () => { document.removeEventListener("keydown", handler); document.body.classList.remove("drawerOpen"); }; }, [onClose]);
  return <div className="drawerLayer" role="dialog" aria-modal="true" aria-labelledby="block-title"><button className="drawerBackdrop" onClick={onClose} aria-label="Close block details" /><aside className="drawer"><div className="drawerHeader"><div><p className="kicker">BLOCK DETAILS</p><h2 id="block-title">#{formatNumber(block.number, 0)}</h2></div><button onClick={onClose} aria-label="Close">×</button></div><div className="drawerStatus"><span><i />Finalized</span><span>{age(block.timestamp, now)}</span></div><dl><div><dt>Timestamp</dt><dd>{new Date(block.timestamp * 1000).toLocaleString()}</dd></div><div><dt>Transactions</dt><dd>{formatNumber(block.transactionCount, 0)}</dd></div><div><dt>Gas used</dt><dd>{formatNumber(block.gasUsed, 0)} <small>({utilization.toFixed(2)}%)</small></dd></div><div><dt>Gas limit</dt><dd>{formatNumber(block.gasLimit, 0)}</dd></div><div><dt>Base fee</dt><dd>{gwei(block.baseFeePerGasWei)}</dd></div><div><dt>Block size</dt><dd>{formatNumber(block.size / 1024, 2)} KB</dd></div><div className="wide"><dt>Block hash</dt><dd className="mono">{block.hash}</dd></div><div className="wide"><dt>Parent hash</dt><dd className="mono">{block.parentHash}</dd></div><div className="wide"><dt>Fee recipient</dt><dd className="mono">{block.miner}</dd></div></dl><a className="drawerLink" href={`${EXPLORER}/block/${block.number}`} target="_blank" rel="noreferrer">View full block on Arc Explorer <span>↗</span></a></aside></div>;
}
