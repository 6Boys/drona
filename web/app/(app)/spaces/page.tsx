"use client";

import Link from "next/link";
import { PageBody, TopBar } from "@/components/app-shell/TopBar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useApi } from "@/lib/use-api";
import type { Items, Space } from "@/lib/types";

export default function SpacesPage() {
  const { data, loading } = useApi<Items<Space>>("/v1/spaces");
  const spaces = data?.items ?? [];

  return (
    <>
      <TopBar title="Spaces" subtitle="Every corner of campus, sorted by what it's for" />

      <PageBody width="md">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24 rounded-[var(--r-lg)]" />
            ))}
          </div>
        ) : !spaces.length ? (
          <EmptyState title="No spaces yet" body="Your campus admin hasn't opened any spaces." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {spaces.map((space) => (
              <Link
                key={space.id}
                href={`/spaces/${space.slug}`}
                className="card group p-4 transition-colors hover:border-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <span aria-hidden className="text-xl">
                    {space.icon || "#"}
                  </span>
                  {space.isDefault && (
                    <Badge tone="neutral" mono>
                      default
                    </Badge>
                  )}
                </div>

                <h2 className="mt-2.5 text-[0.9375rem] font-medium text-text">{space.name}</h2>
                <p className="mt-0.5 font-mono text-[0.6875rem] text-faint">#{space.slug}</p>
                {space.description && (
                  <p className="mt-1.5 line-clamp-2 text-[0.8125rem] text-muted">{space.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
