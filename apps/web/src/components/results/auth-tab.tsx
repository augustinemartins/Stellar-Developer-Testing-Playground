"use client";
import { KeySquare } from "lucide-react";
import type { AuthEntryInfo, InvocationNode } from "@playground/shared-types";
import type { SimulationRun } from "@playground/simulation-engine";
import { Badge, Card, CopyButton, EmptyState, Mono } from "../ui";
import { JsonInline } from "../value-view";

function Invocation({ node }: { node: InvocationNode }) {
  return (
    <li className="space-y-1">
      <div className="text-sm">
        {node.kind === "contract_fn" ? (
          <>
            <Mono className="font-semibold">{node.functionName}</Mono>
            <span className="text-muted"> on </span>
            <Mono title={node.contractId}>{node.contractId}</Mono>
          </>
        ) : node.kind === "create_contract" ? (
          <span>Create contract</span>
        ) : (
          <span className="text-muted">Unknown authorized function</span>
        )}
      </div>
      {node.args.length > 0 && (
        <ol className="space-y-0.5 pl-4 text-xs">
          {node.args.map((a, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted">#{i}</span>
              <Badge>{a.type}</Badge>
              <JsonInline value={a.json as never} />
            </li>
          ))}
        </ol>
      )}
      {node.subInvocations.length > 0 && (
        <ul className="ml-2 space-y-2 border-l border-border pl-3">
          {node.subInvocations.map((s, i) => (
            <Invocation key={i} node={s} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Entry({ entry, index, source }: { entry: AuthEntryInfo; index: number; source: string }) {
  const signer = entry.credentials === "source_account" ? source : entry.address!;
  return (
    <Card as="article" className="space-y-3 p-3" aria-labelledby={`auth-${index}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`auth-${index}`} className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <KeySquare aria-hidden className="size-4" /> Signer {index + 1}
          <Badge tone={entry.credentials === "source_account" ? "info" : "accent"}>
            {entry.credentials === "source_account" ? "transaction source" : "address credentials"}
          </Badge>
        </h3>
        <CopyButton text={entry.xdr} label="Copy entry XDR" />
      </header>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Address</dt>
        <dd>
          <Mono>{signer}</Mono>
        </dd>
        {entry.nonce !== undefined && (
          <>
            <dt className="text-muted">Nonce</dt>
            <dd>
              <Mono>{entry.nonce}</Mono>
            </dd>
          </>
        )}
        {entry.signatureExpirationLedger !== undefined && (
          <>
            <dt className="text-muted">Signature expiry</dt>
            <dd className="text-xs">
              {entry.signatureExpirationLedger === 0 ? "set by the signer when signing" : `ledger ${entry.signatureExpirationLedger}`}
            </dd>
          </>
        )}
      </dl>
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Authorizes</h4>
        <ul>
          <Invocation node={entry.invocation} />
        </ul>
      </div>
    </Card>
  );
}

export function AuthTab({ run }: { run: SimulationRun }) {
  const auth = run.report.auth;
  if (run.report.status === "error") {
    return <EmptyState title="No authorization data">Authorization is only reported for successful simulations.</EmptyState>;
  }
  if (auth.length === 0) {
    return (
      <EmptyState title="No signatures required">
        This call does not invoke <code className="font-mono">require_auth</code> for any address, so it could be submitted with only the fee payer&apos;s signature.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-muted">
        Recorded in <Mono>{run.authMode}</Mono> mode. Each entry below is what a wallet would be asked to sign before submission. Address
        credentials need a separate signature; source-account credentials are covered by the transaction signature.
      </p>
      {auth.map((a, i) => (
        <Entry key={a.xdr} entry={a} index={i} source={run.source.address} />
      ))}
    </div>
  );
}
