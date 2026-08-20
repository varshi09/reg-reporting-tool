"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import type { Brf01DetailRow } from "@/lib/brf01Detail";

function fmt(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

type DetailQuery = {
  timeKey: string;
  workingDay: string;
  entityGroups: string[];
  dataSources: string[];
  lineNo: string;
  resident: "RES" | "NONRES";
  currency: "AED" | "FCY";
};

function readQuery(): DetailQuery | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const lineNo = params.get("lineNo");
  const resident = params.get("resident");
  const currency = params.get("currency");
  if (!lineNo || (resident !== "RES" && resident !== "NONRES") || (currency !== "AED" && currency !== "FCY")) {
    return null;
  }
  return {
    timeKey: params.get("timeKey") ?? "",
    workingDay: params.get("workingDay") ?? "",
    entityGroups: params.getAll("entityGroup"),
    dataSources: params.getAll("dataSource"),
    lineNo,
    resident,
    currency,
  };
}

function buildParams(query: DetailQuery): URLSearchParams {
  const params = new URLSearchParams();
  query.entityGroups.forEach((eg) => params.append("entityGroup", eg));
  query.dataSources.forEach((ds) => params.append("dataSource", ds));
  if (query.timeKey) params.set("timeKey", query.timeKey);
  if (query.workingDay) params.set("workingDay", query.workingDay);
  params.set("lineNo", query.lineNo);
  params.set("resident", query.resident);
  params.set("currency", query.currency);
  return params;
}

const COLUMNS: { key: keyof Brf01DetailRow; header: string; align?: "right" }[] = [
  { key: "timeKey", header: "Time Key" },
  { key: "workingDay", header: "Working Day" },
  { key: "entityGroup", header: "Entity Group" },
  { key: "dataSource", header: "Data Source" },
  { key: "lineNo", header: "Line No" },
  { key: "lineDesc", header: "Line Description" },
  { key: "residentFlag", header: "Residence" },
  { key: "currencyCode", header: "Currency" },
  { key: "customerNumber", header: "Customer No." },
  { key: "contractNumber", header: "Contract No." },
  { key: "customerName", header: "Customer Name" },
  { key: "noOfAccounts", header: "No. of A/cs", align: "right" },
  { key: "closingBalanceAed", header: "Closing Balance (AED)", align: "right" },
  { key: "nationality", header: "Nationality" },
  { key: "nationalityDesc", header: "Nationality Desc." },
  { key: "emirates", header: "Emirate" },
  { key: "countryCode", header: "Country Code" },
  { key: "countryName", header: "Country" },
  { key: "glAccountId", header: "GL Account" },
  { key: "target", header: "Source" },
  { key: "sector", header: "Sector" },
];

export default function Brf01DetailPage() {
  const [query] = useState<DetailQuery | null>(readQuery);
  const [rows, setRows] = useState<Brf01DetailRow[] | null>(null);

  useEffect(() => {
    if (!query) return;
    fetch(`/api/brf01/detail?${buildParams(query).toString()}`)
      .then((r) => r.json())
      .then((data) => setRows(data.rows ?? []));
  }, [query]);

  if (!query) {
    return (
      <AppShell active="/reports" title="BRF 01 - Detail">
        <p className="text-sm text-red-600">Missing or invalid drill-down parameters.</p>
      </AppShell>
    );
  }

  const residentLabel = query.resident === "RES" ? "Resident" : "Non-Resident";
  const totalAccounts = rows?.reduce((sum, r) => sum + r.noOfAccounts, 0) ?? null;
  const totalAmount = rows?.reduce((sum, r) => sum + r.closingBalanceAed, 0) ?? null;

  return (
    <AppShell active="/reports" title="BRF 01 - Detail">
      <div className="flex flex-col gap-4">
        <a href="/reports/brf01" className="w-fit text-sm text-zinc-500 hover:text-black">
          ← Back to BRF 01 summary
        </a>

        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-black">
                Line {query.lineNo}
                {rows?.[0]?.lineDesc ? ` — ${rows[0].lineDesc}` : ""}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {residentLabel} · {query.currency} · {query.entityGroups.join(", ") || "All entities"} ·{" "}
                {query.dataSources.join(", ") || "All sources"}
                {query.timeKey ? ` · ${query.timeKey}` : ""}
                {rows?.[0]?.workingDay ? ` · ${rows[0].workingDay}` : ""}
              </p>
              {rows && (
                <p className="mt-1 text-sm text-zinc-500">
                  {rows.length} record{rows.length !== 1 ? "s" : ""} · {totalAccounts} a/cs · {fmt(totalAmount)} AED total
                </p>
              )}
            </div>
            <a
              href={`/api/brf01/detail/export?${buildParams(query).toString()}`}
              className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Download Report
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm p-5">
          {rows === null ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-zinc-500">No detail records for this cell.</p>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[1700px] border-collapse text-left text-sm text-zinc-900">
                <thead className="sticky top-0 z-10">
                  <tr>
                    {COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        className={`border border-sky-400 bg-sky-300 px-2 py-2 font-semibold text-sky-950 ${
                          c.align === "right" ? "text-right" : "text-left"
                        }`}
                      >
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.customerNumber}-${r.contractNumber}`} className="hover:bg-zinc-50 transition-colors">
                      {COLUMNS.map((c) => {
                        const value = r[c.key];
                        const display =
                          c.key === "closingBalanceAed" ? fmt(value as number) : (value ?? "");
                        return (
                          <td
                            key={c.key}
                            className={`border border-zinc-200 px-2 py-1 ${c.align === "right" ? "text-right" : ""}`}
                          >
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
