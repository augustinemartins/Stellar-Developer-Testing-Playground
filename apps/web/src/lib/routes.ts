export function workspaceHref(opts: { contractId?: string; sample?: string; method?: string; scenario?: string }): string {
  const q = new URLSearchParams();
  if (opts.contractId) q.set("contract", opts.contractId);
  if (opts.sample) q.set("sample", opts.sample);
  if (opts.method) q.set("fn", opts.method);
  if (opts.scenario) q.set("scenario", opts.scenario);
  return `/workspace?${q.toString()}`;
}
