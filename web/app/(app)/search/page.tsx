"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PageBody, TopBar } from "@/components/app-shell/TopBar";
import { VanishInput } from "@/components/fx/VanishInput";
import { DotBackdrop } from "@/components/fx/Backdrops";
import { Glow } from "@/components/fx/Glow";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { OwlRankBadge } from "@/components/ui/OwlRankBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useApi } from "@/lib/use-api";
import type { Items, Space, User } from "@/lib/types";

const PLACEHOLDERS = [
  "Who's in your lab section?",
  "Find the ECE placements space",
  "Search a handle — @zoya",
  "Third-year Mechanical, anyone",
  "The club that runs the open mics",
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");

  // Typing applies after a beat; emptying the box does not. Submitting makes
  // the text dissolve out of the field, and wiping the results it just fetched
  // would make that feel like a mistake rather than an effect.
  useEffect(() => {
    const term = query.trim();
    if (!term) return;
    const id = setTimeout(() => setApplied(term), 250);
    return () => clearTimeout(id);
  }, [query]);

  const people = useApi<Items<User>>("/v1/search/users", { q: applied, limit: 20 }, applied.length > 1);
  const spaces = useApi<Items<Space>>("/v1/spaces");

  const matchedSpaces = (spaces.data?.items ?? []).filter((s) =>
    applied.length > 1
      ? `${s.name} ${s.slug} ${s.description ?? ""}`.toLowerCase().includes(applied.toLowerCase())
      : false,
  );

  return (
    <>
      <TopBar title="Search" subtitle="People and spaces on your campus" />

      <PageBody width="sm">
        <div className="relative">
          <DotBackdrop className="-inset-x-8 -inset-y-10" size={18} />
          <div className="relative">
            <VanishInput
              autoFocus
              placeholders={PLACEHOLDERS}
              value={query}
              onChange={setQuery}
              /* The query stays applied after the text dissolves — the results
                 below are the answer, so clearing them too would be a prank. */
              onSubmit={setApplied}
              ariaLabel="Search people and spaces"
            />
          </div>
        </div>

        {applied.length <= 1 ? (
          <EmptyState
            title="Find someone"
            body="Type at least two characters. Everyone here is a verified student on your campus."
          />
        ) : (
          <div className="mt-6 space-y-6">
            {matchedSpaces.length > 0 && (
              <section>
                <h2 className="mono-label mb-2.5">spaces</h2>
                <ul className="space-y-2">
                  {matchedSpaces.map((space, i) => (
                    <motion.li
                      key={space.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.3 }}
                    >
                      <Link
                        href={`/spaces/${space.slug}`}
                        className="card-lit relative flex items-center gap-3 p-3.5 transition-shadow duration-300 hover:shadow-[var(--sh-pop)]"
                      >
                        <Glow />
                        <span aria-hidden className="relative text-lg">
                          {space.icon || "#"}
                        </span>
                        <span className="relative min-w-0 flex-1">
                          <span className="block truncate text-[0.8125rem] font-medium text-text">
                            {space.name}
                          </span>
                          <span className="block truncate font-mono text-[0.6875rem] text-faint">
                            #{space.slug}
                          </span>
                        </span>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="mono-label mb-2.5">people</h2>
              {people.loading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 rounded-[var(--r-lg)]" />
                  ))}
                </div>
              ) : !people.data?.items.length ? (
                <EmptyState compact title="No matches" body="Try a different spelling." />
              ) : (
                <ul className="space-y-2">
                  {people.data.items.map((user, i) => (
                    <motion.li
                      key={user.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.035, duration: 0.3 }}
                    >
                      <Link
                        href={`/profile/${user.handle}`}
                        className="card-lit relative flex items-center gap-3 p-3.5 transition-shadow duration-300 hover:shadow-[var(--sh-pop)]"
                      >
                        <Glow />
                        <Avatar user={user} size={38} className="relative" />
                        <span className="relative min-w-0 flex-1">
                          <span className="block truncate text-[0.8125rem] font-medium text-text">
                            {user.displayName}
                          </span>
                          <span className="block truncate text-xs text-faint">
                            @{user.handle}
                            {user.branch ? ` · ${user.branch}` : ""}
                            {user.batch ? ` · ${user.batch}` : ""}
                          </span>
                        </span>
                        <span className="relative">
                          {user.isBuddy ? (
                            <Badge tone="accent" mono>
                              buddy
                            </Badge>
                          ) : (
                            <OwlRankBadge rank={user.owlRank} label={user.owlRankLabel} />
                          )}
                        </span>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </PageBody>
    </>
  );
}
